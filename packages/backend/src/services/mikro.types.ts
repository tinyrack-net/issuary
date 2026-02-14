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
import type { MikroORM } from '@mikro-orm/core';

export interface MikroService {
  orm: MikroORM;
  em: MikroORM['em'];
  user: UserRepository;
  userOAuth: UserOAuthRepository;
  oauthCode: OAuthCodeRepository;
  oauthClient: OAuthClientRepository;
  emailVerification: EmailVerificationRepository;
  passwordReset: PasswordResetRepository;
  jwtKey: JwtKeyRepository;
  revokedToken: RevokedTokenRepository;
  userConsent: UserConsentRepository;
  userTermsConsent: UserTermsConsentRepository;
  userTotp: UserTotpRepository;
  userTotpRecoveryCode: UserTotpRecoveryCodeRepository;
  userPasskey: UserPasskeyRepository;
  terms: TermsRepository;
  termsContent: TermsContentRepository;
}
