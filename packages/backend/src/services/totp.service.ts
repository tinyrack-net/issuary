import type { UserEntity } from '@backend/entities/user.entity.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { e } from '@backend/schemas/error.js';
import type { MikroService } from '@backend/services/mikro.types.js';
import { hash, verify } from '@node-rs/argon2';
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';

/**
 * TOTP setup data returned when initiating 2FA setup
 * Contains all information needed to display QR code and manual entry
 */
export interface TotpSetupData {
  /** Base32-encoded TOTP secret key */
  secret: string;
  /** OTPAuth URL for authenticator apps (otpauth://totp/...) */
  otpauthUrl: string;
  /** QR code as data URL (data:image/png;base64,...) */
  qrCodeDataUrl: string;
}

/** Number of recovery codes to generate */
const RECOVERY_CODE_COUNT = 8;

export class TotpService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: ResolvedAppConfig,
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
      issuer: this.config.auth.password.totp.issuer || this.config.app.host,
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
  public async startSetup(user: UserEntity): Promise<TotpSetupData> {
    const existingTotp = await this.mikro.userTotp.findByUserId(user.id);

    // Only throw if TOTP is fully registered (verified AND recovery confirmed)
    // If user verified but didn't confirm recovery codes, allow re-setup
    if (existingTotp?.verified && existingTotp?.recovery_confirmed) {
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
    const totp = await this.mikro.userTotp.create({
      user: user.id,
      secret: secret,
    });
    this.mikro.em.persist(totp);
    await this.mikro.em.flush();

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verify and complete TOTP setup.
   * Also generates recovery codes upon successful verification.
   *
   * @returns Array of plain-text recovery codes (shown only once)
   */
  public async verifySetup(userId: string, token: string): Promise<string[]> {
    const totp = await this.mikro.userTotp.findByUserId(userId);
    if (!totp) {
      throw new e.TotpNotSetup.Error();
    }

    // Only throw if TOTP is fully registered (verified AND recovery confirmed)
    // If user verified but didn't confirm recovery codes, allow re-verification
    if (totp.verified && totp.recovery_confirmed) {
      throw new e.TotpAlreadyEnabled.Error();
    }

    if (!this.verifyToken(token, totp.secret)) {
      throw new e.InvalidTotpCode.Error();
    }

    // Flush verified status before generating recovery codes,
    // because generateRecoveryCodes calls em.clear() which
    // would discard the pending verified change.
    totp.verified = true;
    await this.mikro.em.flush();

    // Generate recovery codes on TOTP setup completion
    const user = await this.mikro.user.findOneOrFail({
      id: userId,
    });
    const recoveryCodes = await this.generateRecoveryCodes(user);

    return recoveryCodes;
  }

  /**
   * Confirm TOTP setup by acknowledging recovery codes.
   * This marks the TOTP setup as fully complete.
   */
  public async confirmSetup(userId: string): Promise<void> {
    const totp = await this.mikro.userTotp.findVerifiedByUserId(userId);
    if (!totp) {
      throw new e.TotpNotSetup.Error();
    }

    if (totp.recovery_confirmed) {
      throw new e.TotpAlreadyEnabled.Error();
    }

    totp.recovery_confirmed = true;
    await this.mikro.em.flush();
  }

  /**
   * Disable TOTP for a user
   * Also deletes all recovery codes
   */
  public async disable(
    userId: string,
    token: string,
    options: {
      secondFactorRequired: boolean;
      hasOtherSecondFactor: boolean;
    },
  ): Promise<void> {
    const totp = await this.mikro.userTotp.findFullyRegisteredByUserId(userId);
    if (!totp) {
      throw new e.TotpNotEnabled.Error();
    }

    if (!this.verifyToken(token, totp.secret)) {
      throw new e.InvalidTotpCode.Error();
    }

    // Prevent disabling TOTP when 2FA is required and no other 2FA method exists
    if (options.secondFactorRequired && !options.hasOtherSecondFactor) {
      throw new e.CannotRemoveLastSecondFactor.Error();
    }

    await this.mikro.userTotp.deleteByUserId(userId);
    await this.mikro.userTotpRecoveryCode.deleteByUserId(userId);
  }

  public async verifyForAuth(userId: string, token: string): Promise<void> {
    const totp = await this.mikro.userTotp.findFullyRegisteredByUserId(userId);
    if (!totp) {
      throw new e.TotpNotEnabled.Error();
    }
    await this.verifyToken(token, totp.secret);
  }

  /**
   * Generate a single recovery code in the format xxxx-xxxx
   * Uses lowercase alphanumeric characters (a-z, 0-9)
   */
  public generateRecoveryCodeString(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    const code = Array.from(array)
      .map((byte) => chars[byte % chars.length])
      .join('');
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  /**
   * Generate recovery codes for a user.
   * Deletes any existing recovery codes first, then creates new ones.
   *
   * @returns Array of plain-text recovery codes (shown only once)
   */
  public async generateRecoveryCodes(user: UserEntity): Promise<string[]> {
    // Delete any existing recovery codes
    await this.mikro.userTotpRecoveryCode.deleteByUserId(user.id);
    this.mikro.em.clear();

    // Re-fetch user after clearing identity map
    const freshUser = await this.mikro.user.findOneOrFail({
      id: user.id,
    });

    const plainCodes: string[] = [];

    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const code = this.generateRecoveryCodeString();
      plainCodes.push(code);

      const codeHash = await hash(code);
      const entity = this.mikro.userTotpRecoveryCode.create({
        user: freshUser.id,
        code_hash: codeHash,
      });
      this.mikro.em.persist(entity);
    }

    await this.mikro.em.flush();

    return plainCodes;
  }

  /**
   * Verify a recovery code for authentication.
   * The code is single-use: once verified, it is marked as used.
   */
  public async verifyRecoveryCode(userId: string, code: string): Promise<void> {
    // Ensure TOTP is actually fully enabled for this user
    const totp = await this.mikro.userTotp.findFullyRegisteredByUserId(userId);
    if (!totp) {
      throw new e.TotpNotEnabled.Error();
    }

    const unusedCodes =
      await this.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);

    if (unusedCodes.length === 0) {
      throw new e.NoRecoveryCodesAvailable.Error();
    }

    // Try each unused code (argon2 verify is needed since codes
    // are hashed)
    for (const recoveryCode of unusedCodes) {
      const isMatch = await verify(recoveryCode.code_hash, code);
      if (isMatch) {
        recoveryCode.used = true;
        recoveryCode.used_at = new Date();
        await this.mikro.em.flush();
        return;
      }
    }

    throw new e.InvalidRecoveryCode.Error();
  }
}
