import { getDbConfigs } from '@backend/db/index.js';
import { EmailVerificationEntitySchema } from '@backend/entities/email-verification.entity.js';
import { JwtKeyEntity } from '@backend/entities/jwt-key.entity.js';
import { OAuthClientEntitySchema } from '@backend/entities/oauth-client.entity.js';
import { OAuthCodeEntitySchema } from '@backend/entities/oauth-code.entity.js';
import { PasswordResetEntitySchema } from '@backend/entities/password-reset.entity.js';
import { RevokedTokenEntitySchema } from '@backend/entities/revoked-token.entity.js';
import { TermsEntitySchema } from '@backend/entities/terms.entity.js';
import { TermsContentEntitySchema } from '@backend/entities/terms-content.entity.js';
import { UserEntity } from '@backend/entities/user.entity.js';
import { UserConsentEntity } from '@backend/entities/user-consent.entity.js';
import { UserOAuthEntitySchema } from '@backend/entities/user-oauth.entity.js';
import { UserPasskeyEntitySchema } from '@backend/entities/user-passkey.entity.js';
import { UserTermsConsentEntity } from '@backend/entities/user-terms-consent.entity.js';
import { UserTotpEntitySchema } from '@backend/entities/user-totp.entity.js';
import { UserTotpRecoveryCodeEntitySchema } from '@backend/entities/user-totp-recovery-code.entity.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { env } from '@backend/lib/env.js';
import type { EmailVerificationRepository } from '@backend/repositories/email-verification.repository.js';
import type { JwtKeyRepository } from '@backend/repositories/jwt-key.repository.js';
import type { OAuthClientRepository } from '@backend/repositories/oauth-client.repository.js';
import type { OAuthCodeRepository } from '@backend/repositories/oauth-code.repository.js';
import type { PasswordResetRepository } from '@backend/repositories/password-reset.repository.js';
import type { RevokedTokenRepository } from '@backend/repositories/revoked-token.repository.js';
import type { TermsRepository } from '@backend/repositories/terms.repository.js';
import type { TermsContentRepository } from '@backend/repositories/terms-content.repository.js';
import type { UserRepository } from '@backend/repositories/user.repository.js';
import type { UserConsentRepository } from '@backend/repositories/user-consent.repository.js';
import type { UserOAuthRepository } from '@backend/repositories/user-oauth.repository.js';
import type { UserPasskeyRepository } from '@backend/repositories/user-passkey.repository.js';
import type { UserTermsConsentRepository } from '@backend/repositories/user-terms-consent.repository.js';
import type { UserTotpRepository } from '@backend/repositories/user-totp.repository.js';
import type { UserTotpRecoveryCodeRepository } from '@backend/repositories/user-totp-recovery-code.repository.js';
import { MikroORM, type Options } from '@mikro-orm/core';

export interface MikroServiceOptions {
  silent?: boolean;
}

export class MikroService {
  public readonly orm: MikroORM;
  public readonly em: MikroORM['em'];
  public readonly user: UserRepository;
  public readonly userOAuth: UserOAuthRepository;
  public readonly oauthCode: OAuthCodeRepository;
  public readonly oauthClient: OAuthClientRepository;
  public readonly emailVerification: EmailVerificationRepository;
  public readonly passwordReset: PasswordResetRepository;
  public readonly jwtKey: JwtKeyRepository;
  public readonly revokedToken: RevokedTokenRepository;
  public readonly userConsent: UserConsentRepository;
  public readonly userTermsConsent: UserTermsConsentRepository;
  public readonly userTotp: UserTotpRepository;
  public readonly userTotpRecoveryCode: UserTotpRecoveryCodeRepository;
  public readonly userPasskey: UserPasskeyRepository;
  public readonly terms: TermsRepository;
  public readonly termsContent: TermsContentRepository;

  private constructor(orm: MikroORM) {
    this.orm = orm;
    this.em = orm.em;
    this.user = orm.em.getRepository(UserEntity);
    this.userOAuth = orm.em.getRepository(UserOAuthEntitySchema);
    this.oauthCode = orm.em.getRepository(OAuthCodeEntitySchema);
    this.oauthClient = orm.em.getRepository(OAuthClientEntitySchema);
    this.emailVerification = orm.em.getRepository(
      EmailVerificationEntitySchema,
    );
    this.passwordReset = orm.em.getRepository(PasswordResetEntitySchema);
    this.jwtKey = orm.em.getRepository(JwtKeyEntity);
    this.revokedToken = orm.em.getRepository(RevokedTokenEntitySchema);
    this.userConsent = orm.em.getRepository(UserConsentEntity);
    this.userTermsConsent = orm.em.getRepository(UserTermsConsentEntity);
    this.userTotp = orm.em.getRepository(UserTotpEntitySchema);
    this.userTotpRecoveryCode = orm.em.getRepository(
      UserTotpRecoveryCodeEntitySchema,
    );
    this.userPasskey = orm.em.getRepository(UserPasskeyEntitySchema);
    this.terms = orm.em.getRepository(TermsEntitySchema);
    this.termsContent = orm.em.getRepository(TermsContentEntitySchema);
  }

  public static async initialize(
    config: ResolvedAppConfig,
    options?: MikroServiceOptions,
  ): Promise<MikroService> {
    const silent = options?.silent ?? false;

    if (!silent) {
      console.info('Initializing MikroORM...');
    }

    const dbConfigs = getDbConfigs(config);
    const ormOptions: Options = {
      ...dbConfigs,
      debug: false,
      dynamicImportProvider: (id) => import(id),
    };
    const orm = await MikroORM.init(ormOptions);

    if (config.database.type === 'memory') {
      await orm.schema.refresh();
    } else if (env.APP_ENV === 'development') {
      await orm.schema.update();
    } else {
      await orm.migrator.up();
    }

    if (!silent) {
      console.info('MikroORM initialized (database: %s)', config.database.type);
    }

    return new MikroService(orm);
  }

  public async close(): Promise<void> {
    await this.orm.close();
  }
}
