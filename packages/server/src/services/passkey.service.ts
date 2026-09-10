import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
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
import type { UserEntity } from '../entities/user.entity.ts';
import {
  type IUserPasskeyEntity,
  UserPasskeyEntitySchema,
} from '../entities/user-passkey.entity.ts';
import type { IssuaryRuntimeConfig } from '../lib/config/index.ts';
import { e } from '../schemas/error.ts';
import type { MikroService } from './mikro.service.ts';
import {
  authenticationMethods,
  withUserSecurity,
} from './user-security.service.js';

function isAuthenticatorTransport(
  transport: string,
): transport is AuthenticatorTransport {
  return (
    transport === 'ble' ||
    transport === 'hybrid' ||
    transport === 'internal' ||
    transport === 'nfc' ||
    transport === 'usb'
  );
}

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
  private readonly config: IssuaryRuntimeConfig;
  public constructor(mikro: MikroService, config: IssuaryRuntimeConfig) {
    this.mikro = mikro;
    this.config = config;
  }

  /**
   * Get rpId from config or extract from server.public_origin hostname
   */
  private getRpId(): string {
    const passkeyConfig = this.config.auth.passkey;
    if (passkeyConfig.rp_id) {
      return passkeyConfig.rp_id;
    }
    const hostUrl = new URL(this.config.server.public_origin);
    return hostUrl.hostname;
  }

  /**
   * Get allowed origins from config or use server.public_origin
   */
  private getOrigins(): string[] {
    const passkeyConfig = this.config.auth.passkey;
    if (passkeyConfig.origins && passkeyConfig.origins.length > 0) {
      return passkeyConfig.origins;
    }
    return [this.config.server.public_origin];
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
        ...(passkey.transports ? { transports: passkey.transports } : {}),
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
  public async prepareRegistration(
    _user: UserEntity,
    response: RegistrationResponseJSON,
    expectedChallenge: string,
    _passkeyName?: string,
  ) {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.getOrigins(),
      expectedRPID: this.getRpId(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new e.PasskeyVerificationFailed.Error();
    }

    return verification;
  }

  public async verifyRegistration(
    user: UserEntity,
    response: RegistrationResponseJSON,
    expectedChallenge: string,
    passkeyName?: string,
    prepared?: Awaited<ReturnType<PasskeyService['prepareRegistration']>>,
  ): Promise<IUserPasskeyEntity> {
    const verification =
      prepared ??
      (await this.prepareRegistration(
        user,
        response,
        expectedChallenge,
        passkeyName,
      ));
    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;
    return withUserSecurity(this.mikro, user.sub, async (freshUser) => {
      user = freshUser; // Check if credential already exists
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
        transports:
          response.response.transports?.filter(isAuthenticatorTransport) ??
          null,
        name: passkeyName ?? null,
        aaguid: verification.registrationInfo.aaguid ?? null,
      });

      this.mikro.em.persist(passkey);
      await this.mikro.em.flush();

      return passkey;
    });
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
      | { id: string; transports?: AuthenticatorTransport[] }[]
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
  public async prepareAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    expectedUserSub?: string,
  ) {
    // Find the passkey by credential ID
    const passkey = await this.mikro.userPasskey.findByCredentialId(
      response.id,
    );

    if (!passkey) {
      throw new e.PasskeyNotFound.Error();
    }

    const userEpoch = passkey.user.getEntity().token_epoch;
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

    const passkeyUser = passkey.user.getEntity();
    if (expectedUserSub && passkeyUser.sub !== expectedUserSub) {
      throw new e.PasskeyUserMismatch.Error();
    }

    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter < passkey.counter) {
      throw new e.PasskeyVerificationFailed.Error();
    }

    return {
      userSub: passkeyUser.sub,
      userEpoch,
      credentialId: passkey.credential_id,
      counter: passkey.counter,
      newCounter,
    };
  }

  public async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    expectedUserSub?: string,
    prepared?: Awaited<ReturnType<PasskeyService['prepareAuthentication']>>,
  ): Promise<UserEntity> {
    const proof =
      prepared ??
      (await this.prepareAuthentication(
        response,
        expectedChallenge,
        expectedUserSub,
      ));
    if (expectedUserSub && expectedUserSub !== proof.userSub)
      throw new e.PasskeyUserMismatch.Error();
    return withUserSecurity(this.mikro, proof.userSub, async (user) => {
      if (user.token_epoch !== proof.userEpoch)
        throw new e.Unauthorized.Error();
      const changed = await this.mikro.userPasskey.nativeUpdate(
        {
          user: user.sub,
          credential_id: proof.credentialId,
          counter: proof.counter,
        },
        { counter: proof.newCounter },
      );
      if (changed !== 1) throw new e.PasskeyVerificationFailed.Error();
      return user;
    });
  }

  /**
   * Get all passkeys for a user
   */
  public async getUserPasskeys(userSub: string): Promise<PasskeyInfo[]> {
    const passkeys = await this.mikro.userPasskey.findByUserSub(userSub);
    return passkeys.map((p) => ({
      id: p.id,
      credential_id: p.credential_id,
      name: p.name ?? null,
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
  ): Promise<void> {
    return withUserSecurity(this.mikro, userSub, async () => {
      const passkey = await this.mikro.userPasskey.findByUserSubAndId(
        userSub,
        passkeyId,
      );

      if (!passkey) {
        throw new e.PasskeyNotFound.Error();
      }

      const user = await this.mikro.user.findOneOrFail(
        { sub: userSub },
        { populate: ['password_hash'], refresh: true },
      );
      const methods = await authenticationMethods(
        this.mikro,
        this.config,
        user,
      );
      if (methods.passkeys <= 1 && !methods.password && methods.oauth === 0)
        throw new e.CannotRemoveLastPasskey.Error();
      if (
        this.config.auth.password.two_factor.enrollment_required &&
        methods.passkeys <= 1 &&
        !methods.totp
      )
        throw new e.CannotRemoveLastSecondFactor.Error();

      await this.mikro.userPasskey.deleteByUserSubAndId(userSub, passkeyId);
    });
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
