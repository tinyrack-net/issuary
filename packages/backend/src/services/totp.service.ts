import fastifyPlugin from 'fastify-plugin';
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import type { UserEntity } from '@/entities/user.entity.js';
import { UserTotpEntity } from '@/entities/user-totp.entity.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';

declare module 'fastify' {
  interface FastifyInstance {
    totpService: TotpService;
  }
}

export interface TotpSetupData {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export class TotpService {
  private readonly issuer: string;

  public constructor(
    private readonly mikro: MikroService,
    issuer: string,
  ) {
    this.issuer = issuer;
  }

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
      issuer: this.issuer,
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
      return result.valid;
    } catch {
      return false;
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
  public async startSetup(user: UserEntity): Promise<TotpSetupData> {
    // Check if user already has verified TOTP
    const existingTotp = await this.mikro.userTotp.findByUserId(user.id);
    if (existingTotp?.verified) {
      throw new e.TotpAlreadyEnabled.Error();
    }

    // Generate new secret
    const secret = this.generateSecret();
    const otpauthUrl = this.generateOtpAuthUrl(user.email, secret);
    const qrCodeDataUrl = await this.generateQrCode(otpauthUrl);

    // Create or update TOTP record
    if (existingTotp) {
      existingTotp.secret = secret;
      existingTotp.verified = false;
    } else {
      const totp = new UserTotpEntity({ user, secret });
      this.mikro.em.persist(totp);
    }

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
    return this.mikro.userTotp.isEnabled(userId);
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

  /**
   * Verify TOTP code for authentication (used during login)
   */
  public async verifyForAuth(userId: string, token: string): Promise<boolean> {
    const totp = await this.mikro.userTotp.findVerifiedByUserId(userId);
    if (!totp) {
      return true; // TOTP not enabled, skip verification
    }

    return this.verifyToken(token, totp.secret);
  }
}

export default fastifyPlugin(
  async (fastify) => {
    // Extract issuer from host URL (e.g., "http://localhost:3000" -> "localhost")
    const hostUrl = new URL(fastify.config.app.host);
    const issuer = hostUrl.hostname || 'TinyRack Auth';

    const totpService = new TotpService(fastify.mikro, issuer);
    fastify.decorate('totpService', totpService);
  },
  {
    name: 'totp-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);
