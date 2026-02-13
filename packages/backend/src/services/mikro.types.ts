import type { MikroORM } from '@mikro-orm/core';
import type { EmailVerificationRepository } from '@/repositories/email-verification.repository.js';
import type { JwtKeyRepository } from '@/repositories/jwt-key.repository.js';
import type { OAuthClientRepository } from '@/repositories/oauth-client.repository.js';
import type { OAuthCodeRepository } from '@/repositories/oauth-code.repository.js';
import type { PasswordResetRepository } from '@/repositories/password-reset.repository.js';
import type { RevokedTokenRepository } from '@/repositories/revoked-token.repository.js';
import type { TermsRepository } from '@/repositories/terms.repository.js';
import type { TermsContentRepository } from '@/repositories/terms-content.repository.js';
import type { UserRepository } from '@/repositories/user.repository.js';
import type { UserConsentRepository } from '@/repositories/user-consent.repository.js';
import type { UserOAuthRepository } from '@/repositories/user-oauth.repository.js';
import type { UserPasskeyRepository } from '@/repositories/user-passkey.repository.js';
import type { UserTermsConsentRepository } from '@/repositories/user-terms-consent.repository.js';
import type { UserTotpRepository } from '@/repositories/user-totp.repository.js';
import type { UserTotpRecoveryCodeRepository } from '@/repositories/user-totp-recovery-code.repository.js';

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
