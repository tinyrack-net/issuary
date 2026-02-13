import type { OpenAPIHono } from '@hono/zod-openapi';
import type { MikroORM } from '@mikro-orm/core';
import type { Cron } from 'croner';
import type nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type z from 'zod';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
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
import type { r } from '@/schemas/response.js';
import type { CleanupService } from '@/services/cleanup.service.js';
import type { EmailService } from '@/services/email.service.js';
import type { EmailVerificationService } from '@/services/email-verification.service.js';
import type { JwtService } from '@/services/jwt.service.js';
import type { OAuthAuthorizeService } from '@/services/oauth-authorize.service.js';
import type { OAuthClientService } from '@/services/oauth-client.service.js';
import type { OAuthConnectService } from '@/services/oauth-connect.service.js';
import type { OAuthTokenService } from '@/services/oauth-token.service.js';
import type { PasskeyService } from '@/services/passkey.service.js';
import type { PasswordResetService } from '@/services/password-reset.service.js';
import type { TermsService } from '@/services/terms.service.js';
import type { TotpService } from '@/services/totp.service.js';
import type { UserService } from '@/services/user.service.js';
import type { UserConsentService } from '@/services/user-consent.service.js';

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

export interface SessionData {
  user?: {
    id: string;
    authenticated_at: number;
  };
  pending2FAUser?: {
    id: string;
    authenticated_at: number;
  };
  pending2FASetup?: {
    id: string;
  };
  oauth?: {
    state: string;
    codeVerifier: string;
    providerId: string;
    mode: 'login' | 'register' | 'link';
    returnUrl?: string | undefined;
  };
  pendingOAuthRegistration?: {
    providerId: string;
    tokens: {
      access_token: string;
      refresh_token?: string | undefined;
      expires_in?: number | undefined;
      token_type: string;
    };
    userInfo: {
      id: string;
      email: string;
      email_verified: boolean;
      name?: string | undefined;
      picture?: string | undefined;
    };
    returnUrl?: string | undefined;
    expiresAt: number;
  };
  passkey_challenge?: string;
}

export interface SessionHelper {
  get<K extends keyof SessionData>(key: K): SessionData[K];
  set<K extends keyof SessionData>(key: K, value: SessionData[K]): void;
  delete(): void;
  setUserSession(userId: string, authenticatedAt?: number): void;
  setPending2FASession(userId: string, authenticatedAt?: number): void;
  setPending2FASetupSession(userId: string): void;
  clearAuthSessions(): void;
}

export interface AuthHelper {
  verify: () => Promise<z.infer<typeof r.UserSession>>;
  verifyPending2FAUser: () => Promise<z.infer<typeof r.UserSession>>;
  verifyPending2FASetupUser: () => Promise<z.infer<typeof r.UserSession>>;
}

export interface ServiceContainer {
  config: ResolvedAppConfig;
  mikro: MikroService;
  mail: nodemailer.Transporter<
    SMTPTransport.SentMessageInfo,
    SMTPTransport.Options
  > | null;
  scheduler: {
    cleanupJob: Cron | null;
    start: () => void;
    stop: () => void;
  };
  emailService: EmailService;
  emailVerificationService: EmailVerificationService | undefined;
  jwtService: JwtService;
  passwordResetService: PasswordResetService;
  termsService: TermsService;
  userConsentService: UserConsentService;
  oauthClientService: OAuthClientService;
  totpService: TotpService;
  passkeyService: PasskeyService;
  userService: UserService;
  oauthAuthorizeService: OAuthAuthorizeService;
  oauthConnectService: OAuthConnectService;
  oauthTokenService: OAuthTokenService;
  cleanupService: CleanupService;
}

export interface ServerOptions {
  skipListen: boolean;
  cliMode: boolean;
  silent: boolean;
}

export type AppVariables = {
  services: ServiceContainer;
  session: SessionHelper;
  auth: AuthHelper;
  serverOptions: ServerOptions;
};

export type AppEnv = { Variables: AppVariables };

export type AppType = OpenAPIHono<AppEnv>;
