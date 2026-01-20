import fastifyPlugin from 'fastify-plugin';
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import type z from 'zod/v4';
import type { UserEntity } from '@/entities/user.entity.js';
import { UserTotpEntity } from '@/entities/user-totp.entity.js';
import type { InternalAppConfig } from '@/lib/config/index.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { totpSchema } from '@/schemas/totp.js';

declare module 'fastify' {
  interface FastifyInstance {
    totpService: TotpService;
  }
}

export class TotpService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: InternalAppConfig,
  ) {}

  /**
   * Generate a new TOTP secret for a user
   */
  public generateSecret(): string {
    return generateSecret();
  }

  /**
   * Generate OTP auth URL for QR code
   */
  public generateOtpAuthUrl(email: string, secret: string): string {
    return generateURI({
      issuer:
        this.config.basic_authentication_methods.password.totp.issuer ||
        this.config.app.host,
      label: email,
      secret,
    });
  }

  /**
   * Generate QR code data URL from OTP auth URL
   */
  public async generateQrCode(otpauthUrl: string): Promise<string> {
    return qrcode.toDataURL(otpauthUrl);
  }

  /**
   * Verify a TOTP token against a secret
   */
  public verifyToken(token: string, secret: string): boolean {
    try {
      const result = verifySync({ token, secret, epochTolerance: 1 });
      if (!result.valid) {
        throw new e.InvalidTotpCode.Error();
      }
      return result.valid;
    } catch {
      throw new e.InvalidTotpCode.Error();
    }
  }

  /**
   * Generate a TOTP token for a secret (used for testing)
   */
  public generateToken(secret: string): string {
    return generateSync({ secret });
  }

  /**
   * Start TOTP setup for a user
   * Creates or updates unverified TOTP record
   */
  public async startSetup(
    user: UserEntity,
  ): Promise<z.infer<typeof totpSchema.TotpSetupData>> {
    const existingTotp = await this.mikro.userTotp.findByUserId(user.id);

    if (existingTotp?.verified) {
      throw new e.TotpAlreadyEnabled.Error();
    }

    const secret = this.generateSecret();
    const otpauthUrl = this.generateOtpAuthUrl(user.email, secret);
    const qrCodeDataUrl = await this.generateQrCode(otpauthUrl);

    // If there's an existing unverified TOTP, delete it first to avoid
    // unique constraint violation (handles race conditions and retries)
    if (existingTotp) {
      await this.mikro.userTotp.nativeDelete({ user: { id: user.id } });
      this.mikro.em.clear();
    }

    // Create new TOTP record
    const totp = new UserTotpEntity({ user, secret });
    this.mikro.em.persist(totp);
    await this.mikro.em.flush();

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verify and complete TOTP setup
   */
  public async verifySetup(userId: string, token: string): Promise<void> {
    const totp = await this.mikro.userTotp.findByUserId(userId);
    if (!totp) {
      throw new e.TotpNotSetup.Error();
    }

    if (totp.verified) {
      throw new e.TotpAlreadyEnabled.Error();
    }

    if (!this.verifyToken(token, totp.secret)) {
      throw new e.InvalidTotpCode.Error();
    }

    totp.verified = true;
    await this.mikro.em.flush();
  }

  /**
   * Check if TOTP is enabled for a user
   */
  public async isEnabled(userId: string): Promise<boolean> {
    return this.mikro.userTotp.isRegistered(userId);
  }

  /**
   * Disable TOTP for a user
   */
  public async disable(userId: string, token: string): Promise<void> {
    const totp = await this.mikro.userTotp.findVerifiedByUserId(userId);
    if (!totp) {
      throw new e.TotpNotEnabled.Error();
    }

    if (!this.verifyToken(token, totp.secret)) {
      throw new e.InvalidTotpCode.Error();
    }

    await this.mikro.userTotp.deleteByUserId(userId);
  }

  public async verifyForAuth(userId: string, token: string): Promise<void> {
    const totp = await this.mikro.userTotp.findVerifiedByUserId(userId);
    if (!totp) {
      throw new e.TotpNotEnabled.Error();
    }
    await this.verifyToken(token, totp.secret);
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const totpService = new TotpService(fastify.mikro, fastify.config);
    fastify.decorate('totpService', totpService);
  },
  {
    name: 'totp-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);
