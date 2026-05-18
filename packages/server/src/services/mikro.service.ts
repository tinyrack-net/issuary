import { MikroORM } from '@mikro-orm/core';
import { BackgroundJobEntitySchema } from '../entities/background-job.entity.ts';
import { EmailVerificationEntitySchema } from '../entities/email-verification.entity.ts';
import { JwtKeyEntity } from '../entities/jwt-key.entity.ts';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.ts';
import { OAuthCodeEntitySchema } from '../entities/oauth-code.entity.ts';
import { OAuthProviderEntitySchema } from '../entities/oauth-provider.entity.ts';
import { PasswordResetEntitySchema } from '../entities/password-reset.entity.ts';
import { PendingOAuthRegistrationEntitySchema } from '../entities/pending-oauth-registration.entity.ts';
import { RevokedTokenEntitySchema } from '../entities/revoked-token.entity.ts';
import { SchedulerJobEntitySchema } from '../entities/scheduler-job.entity.ts';
import { TermsEntitySchema } from '../entities/terms.entity.ts';
import { TermsContentEntitySchema } from '../entities/terms-content.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';
import { UserConsentEntity } from '../entities/user-consent.entity.ts';
import { UserOAuthEntitySchema } from '../entities/user-oauth.entity.ts';
import { UserPasskeyEntitySchema } from '../entities/user-passkey.entity.ts';
import { UserTermsConsentEntity } from '../entities/user-terms-consent.entity.ts';
import { UserTotpEntitySchema } from '../entities/user-totp.entity.ts';
import { UserTotpRecoveryCodeEntitySchema } from '../entities/user-totp-recovery-code.entity.ts';
import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { Logger } from '../lib/logger.ts';
import type { BackgroundJobRepository } from '../repositories/background-job.repository.ts';
import type { EmailVerificationRepository } from '../repositories/email-verification.repository.ts';
import type { JwtKeyRepository } from '../repositories/jwt-key.repository.ts';
import type { OAuthClientRepository } from '../repositories/oauth-client.repository.ts';
import type { OAuthCodeRepository } from '../repositories/oauth-code.repository.ts';
import type { OAuthProviderRepository } from '../repositories/oauth-provider.repository.ts';
import type { PasswordResetRepository } from '../repositories/password-reset.repository.ts';
import type { PendingOAuthRegistrationRepository } from '../repositories/pending-oauth-registration.repository.ts';
import type { RevokedTokenRepository } from '../repositories/revoked-token.repository.ts';
import type { SchedulerJobRepository } from '../repositories/scheduler-job.repository.ts';
import type { TermsRepository } from '../repositories/terms.repository.ts';
import type { TermsContentRepository } from '../repositories/terms-content.repository.ts';
import type { UserRepository } from '../repositories/user.repository.ts';
import type { UserConsentRepository } from '../repositories/user-consent.repository.ts';
import type { UserOAuthRepository } from '../repositories/user-oauth.repository.ts';
import type { UserPasskeyRepository } from '../repositories/user-passkey.repository.ts';
import type { UserTermsConsentRepository } from '../repositories/user-terms-consent.repository.ts';
import type { UserTotpRepository } from '../repositories/user-totp.repository.ts';
import type { UserTotpRecoveryCodeRepository } from '../repositories/user-totp-recovery-code.repository.ts';

export class MikroService {
  public readonly orm: MikroORM;
  public readonly em: MikroORM['em'];
  public readonly user: UserRepository;
  public readonly userOAuth: UserOAuthRepository;
  public readonly oauthCode: OAuthCodeRepository;
  public readonly oauthClient: OAuthClientRepository;
  public readonly oauthProvider: OAuthProviderRepository;
  public readonly emailVerification: EmailVerificationRepository;
  public readonly passwordReset: PasswordResetRepository;
  public readonly pendingOAuthRegistration: PendingOAuthRegistrationRepository;
  public readonly jwtKey: JwtKeyRepository;
  public readonly revokedToken: RevokedTokenRepository;
  public readonly backgroundJob: BackgroundJobRepository;
  public readonly schedulerJob: SchedulerJobRepository;
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
    this.oauthProvider = orm.em.getRepository(OAuthProviderEntitySchema);
    this.emailVerification = orm.em.getRepository(
      EmailVerificationEntitySchema,
    );
    this.passwordReset = orm.em.getRepository(PasswordResetEntitySchema);
    this.pendingOAuthRegistration = orm.em.getRepository(
      PendingOAuthRegistrationEntitySchema,
    );
    this.jwtKey = orm.em.getRepository(JwtKeyEntity);
    this.revokedToken = orm.em.getRepository(RevokedTokenEntitySchema);
    this.backgroundJob = orm.em.getRepository(BackgroundJobEntitySchema);
    this.schedulerJob = orm.em.getRepository(SchedulerJobEntitySchema);
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
    config: TinyAuthRuntimeConfig,
    logger: Logger,
  ): Promise<MikroService> {
    logger.info('Initializing MikroORM...');
    const orm = await MikroORM.init(await config.database.getMikroOrmOptions());
    await config.database.initialize(orm);

    logger.info('MikroORM initialized');

    return new MikroService(orm);
  }

  public async close(): Promise<void> {
    await this.orm.close();
  }
}
