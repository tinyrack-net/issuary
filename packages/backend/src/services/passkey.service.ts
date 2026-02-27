import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { UserEntity } from '#backend/entities/user.entity.js';
import {
  type IUserPasskeyEntity,
  UserPasskeyEntitySchema,
} from '#backend/entities/user-passkey.entity.js';
import type { ResolvedAppConfig } from '#backend/lib/config/index.js';
import { e } from '#backend/schemas/error.js';
import type { MikroService } from '#backend/services/mikro.service.js';

/**
 * Passkey information for user passkey list
 * Used to display registered passkeys to the user
 */
export interface PasskeyInfo {
  /** Passkey entity ID */
  id: string;
  /** WebAuthn credential ID */
  credential_id: string;
  /** User-defined name for the passkey */
  name: string | null;
  /** Device type: single device or multi-device (synced) */
  device_type: 'singleDevice' | 'multiDevice';
  /** Whether the passkey is backed up (synced to cloud) */
  backed_up: boolean;
  /** When the passkey was registered */
  created_at: Date;
}

export class PasskeyService {
  private readonly rpName: string = 'TinyRack Auth';

  private readonly mikro: MikroService;
  private readonly config: ResolvedAppConfig;
  public constructor(mikro: MikroService, config: ResolvedAppConfig) {
    this.mikro = mikro;
    this.config = config;
  }

  /**
   * Get rpId from config or extract from app.host hostname
   */
  private getRpId(): string {
    const passkeyConfig = this.config.auth.passkey;
    if (passkeyConfig.rp_id) {
      return passkeyConfig.rp_id;
    }
    const hostUrl = new URL(this.config.app.host);
    return hostUrl.hostname;
  }

  /**
   * Get allowed origins from config or use app.host
   */
  private getOrigins(): string[] {
    const passkeyConfig = this.config.auth.passkey;
    if (passkeyConfig.origins && passkeyConfig.origins.length > 0) {
      return passkeyConfig.origins;
    }
    return [this.config.app.host];
  }

  /**
   * Generate registration options for a user
   */
  public async generateRegistrationOptions(
    user: UserEntity,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    // Get existing passkeys to exclude
    const existingPasskeys = await this.mikro.userPasskey.findByUserSub(
      user.sub,
    );

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.getRpId(),
      userName: user.email,
      userDisplayName: user.email,
      // Don't prompt for additional authenticator info
      attestationType: 'none',
      // Prevent re-registering existing credentials
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credential_id,
        transports: passkey.transports ?? undefined,
      })),
      authenticatorSelection: {
        // Prefer resident keys for passwordless authentication
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    return options;
  }

  /**
   * Verify registration response and save passkey
   */
  public async verifyRegistration(
    user: UserEntity,
    response: RegistrationResponseJSON,
    expectedChallenge: string,
    passkeyName?: string,
  ): Promise<IUserPasskeyEntity> {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.getOrigins(),
      expectedRPID: this.getRpId(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new e.PasskeyVerificationFailed.Error();
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Check if credential already exists
    const exists = await this.mikro.userPasskey.existsByCredentialId(
      credential.id,
    );
    if (exists) {
      throw new e.PasskeyAlreadyExists.Error();
    }

    // Create and save passkey
    const passkey = this.mikro.em.create(UserPasskeyEntitySchema, {
      user: user.sub,
      credential_id: credential.id,
      public_key: isoBase64URL.fromBuffer(credential.publicKey),
      counter: Number(credential.counter),
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: response.response.transports ?? null,
      name: passkeyName ?? null,
      aaguid: verification.registrationInfo.aaguid ?? null,
    });

    this.mikro.em.persist(passkey);
    await this.mikro.em.flush();

    return passkey;
  }

  /**
   * Generate authentication options
   * If userSub is provided, allow only that user's passkeys
   * If not provided, allow discoverable credentials (usernameless)
   */
  public async generateAuthenticationOptions(
    userSub?: string,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    let allowCredentials:
      | { id: string; transports?: AuthenticatorTransportFuture[] }[]
      | undefined;

    if (userSub) {
      const userPasskeys = await this.mikro.userPasskey.findByUserSub(userSub);
      allowCredentials = userPasskeys.map((passkey) => ({
        id: passkey.credential_id,
        ...(passkey.transports && {
          transports: passkey.transports,
        }),
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: this.getRpId(),
      userVerification: 'preferred',
      // Empty array allows discoverable credentials
      allowCredentials: allowCredentials || [],
    });

    return options;
  }

  /**
   * Verify authentication response
   * Returns the user if verification succeeds
   */
  public async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
  ): Promise<UserEntity> {
    // Find the passkey by credential ID
    const passkey = await this.mikro.userPasskey.findByCredentialId(
      response.id,
    );

    if (!passkey) {
      throw new e.PasskeyNotFound.Error();
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.getOrigins(),
      expectedRPID: this.getRpId(),
      credential: {
        id: passkey.credential_id,
        publicKey: isoBase64URL.toBuffer(passkey.public_key),
        counter: passkey.counter,
        ...(passkey.transports && {
          transports: passkey.transports,
        }),
      },
    });

    if (!verification.verified) {
      throw new e.PasskeyVerificationFailed.Error();
    }

    // Update counter for replay attack prevention
    passkey.counter = verification.authenticationInfo.newCounter;
    await this.mikro.em.flush();

    return passkey.user.getEntity();
  }

  /**
   * Get all passkeys for a user
   */
  public async getUserPasskeys(userSub: string): Promise<PasskeyInfo[]> {
    const passkeys = await this.mikro.userPasskey.findByUserSub(userSub);
    return passkeys.map((p) => ({
      id: p.id,
      credential_id: p.credential_id,
      name: p.name,
      device_type: p.device_type,
      backed_up: p.backed_up,
      created_at: p.created_at,
    }));
  }

  /**
   * Delete a passkey
   */
  public async deletePasskey(
    userSub: string,
    passkeyId: string,
    options: {
      hasOtherAuthMethods: boolean;
      secondFactorRequired: boolean;
      hasOtherSecondFactor: boolean;
    },
  ): Promise<void> {
    const passkey = await this.mikro.userPasskey.findByUserSubAndId(
      userSub,
      passkeyId,
    );

    if (!passkey) {
      throw new e.PasskeyNotFound.Error();
    }

    const passkeyCount = await this.mikro.userPasskey.countByUserSub(userSub);

    // Check if this is the last auth method
    if (passkeyCount === 1 && !options.hasOtherAuthMethods) {
      throw new e.CannotRemoveLastPasskey.Error();
    }

    // Prevent deleting last passkey when 2FA is required and no TOTP exists
    if (options.secondFactorRequired) {
      const willHaveNoPasskeys = passkeyCount === 1;
      if (willHaveNoPasskeys && !options.hasOtherSecondFactor) {
        throw new e.CannotRemoveLastSecondFactor.Error();
      }
    }

    await this.mikro.userPasskey.deleteByUserSubAndId(userSub, passkeyId);
  }

  /**
   * Rename a passkey
   */
  public async renamePasskey(
    userSub: string,
    passkeyId: string,
    name: string,
  ): Promise<void> {
    const passkey = await this.mikro.userPasskey.findByUserSubAndId(
      userSub,
      passkeyId,
    );

    if (!passkey) {
      throw new e.PasskeyNotFound.Error();
    }

    passkey.name = name;
    await this.mikro.em.flush();
  }
}
