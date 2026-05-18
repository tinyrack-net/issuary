import type { EntityName } from '@mikro-orm/core';
import { AdminAuditEventEntitySchema } from '../../entities/admin-audit-event.entity.ts';
import { BackgroundJobEntitySchema } from '../../entities/background-job.entity.ts';
import { BootstrapStateEntitySchema } from '../../entities/bootstrap-state.entity.ts';
import { EmailVerificationEntitySchema } from '../../entities/email-verification.entity.ts';
import { JwtKeyEntitySchema } from '../../entities/jwt-key.entity.ts';
import { OAuthClientEntitySchema } from '../../entities/oauth-client.entity.ts';
import { OAuthCodeEntitySchema } from '../../entities/oauth-code.entity.ts';
import { PasswordResetEntitySchema } from '../../entities/password-reset.entity.ts';
import { PendingOAuthRegistrationEntitySchema } from '../../entities/pending-oauth-registration.entity.ts';
import { RevokedTokenEntitySchema } from '../../entities/revoked-token.entity.ts';
import { SchedulerJobEntitySchema } from '../../entities/scheduler-job.entity.ts';
import { TermsEntitySchema } from '../../entities/terms.entity.ts';
import { TermsContentEntitySchema } from '../../entities/terms-content.entity.ts';
import { UserEntitySchema } from '../../entities/user.entity.ts';
import { UserConsentEntitySchema } from '../../entities/user-consent.entity.ts';
import { UserOAuthEntitySchema } from '../../entities/user-oauth.entity.ts';
import { UserPasskeyEntitySchema } from '../../entities/user-passkey.entity.ts';
import { UserTermsConsentEntitySchema } from '../../entities/user-terms-consent.entity.ts';
import { UserTotpEntitySchema } from '../../entities/user-totp.entity.ts';
import { UserTotpRecoveryCodeEntitySchema } from '../../entities/user-totp-recovery-code.entity.ts';

export interface RuntimeDatabaseEntity {
  meta: {
    tableName: string;
    uniqueName: string;
  };
}

function createDatabaseEntities() {
  return [
    UserEntitySchema,
    OAuthClientEntitySchema,
    OAuthCodeEntitySchema,
    JwtKeyEntitySchema,
    EmailVerificationEntitySchema,
    PasswordResetEntitySchema,
    PendingOAuthRegistrationEntitySchema,
    RevokedTokenEntitySchema,
    BackgroundJobEntitySchema,
    SchedulerJobEntitySchema,
    TermsEntitySchema,
    TermsContentEntitySchema,
    UserConsentEntitySchema,
    UserOAuthEntitySchema,
    UserPasskeyEntitySchema,
    UserTermsConsentEntitySchema,
    UserTotpRecoveryCodeEntitySchema,
    UserTotpEntitySchema,
    BootstrapStateEntitySchema,
    AdminAuditEventEntitySchema,
  ];
}

export function getDatabaseEntities(): readonly EntityName[] {
  return createDatabaseEntities();
}

export function getDatabaseEntitiesWithMetadata(): readonly RuntimeDatabaseEntity[] {
  return createDatabaseEntities();
}
