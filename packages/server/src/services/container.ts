import {
  isSchedulerConfigResolver,
  type TinyAuthRuntimeConfig,
} from '../lib/config/index.ts';
import type { Logger } from '../lib/logger.ts';
import {
  type ConfigSeedMode,
  seedConfigIfNeeded,
} from '../seeders/config.seeder.ts';
import { AdminAuditService } from './admin-audit.service.ts';
import { CleanupService } from './cleanup.service.ts';
import { EmailService } from './email.service.ts';
import { JwtService } from './jwt.service.ts';
import { MikroService } from './mikro.service.ts';
import { OAuthAuthorizeService } from './oauth-authorize.service.ts';
import { OAuthClientService } from './oauth-client.service.ts';
import { OAuthConnectService } from './oauth-connect.service.ts';
import { OAuthTokenService } from './oauth-token.service.ts';
import { PasskeyService } from './passkey.service.ts';
import { PasswordAuthService } from './password-auth.service.ts';
import { PasswordResetService } from './password-reset.service.ts';
import { SchedulerService } from './scheduler.service.ts';
import { SecurityService } from './security.service.ts';
import { TermsService } from './terms.service.ts';
import { TotpService } from './totp.service.ts';
import { UserService } from './user.service.ts';
import { UserConsentService } from './user-consent.service.ts';

export interface InitializeServicesOptions {
  seedConfig?: ConfigSeedMode;
}

export async function initializeServices(
  config: TinyAuthRuntimeConfig,
  logger: Logger,
  options: InitializeServicesOptions = {},
) {
  const securityService = new SecurityService(config);

  // 1. Initialize MikroORM
  const mikroLogger = logger.child({ service: 'mikro' });
  const mikro = await MikroService.initialize(config, mikroLogger);

  // 2. Bootstrap: seed config users/clients
  const seeded = await seedConfigIfNeeded(
    mikro.orm.em.fork(),
    config,
    securityService,
    options.seedConfig,
  );
  logger.info(
    {
      users: config.users.length,
      clients: config.clients.length,
      seeded,
    },
    'Bootstrap complete',
  );

  // 3. Create services (respecting dependency order)
  const emailLogger = logger.child({ service: 'email' });
  const emailService = new EmailService(config, mikro, emailLogger);
  const jwtService = new JwtService(config, mikro);
  const passwordAuthService = new PasswordAuthService(
    mikro,
    securityService,
    config.auth.password.policy,
  );
  const passwordResetService = new PasswordResetService(
    mikro,
    passwordAuthService,
  );
  const termsService = new TermsService(mikro);
  const userConsentService = new UserConsentService(mikro);
  const oauthClientService = new OAuthClientService(mikro, securityService);
  const totpService = new TotpService(mikro, config, securityService);
  const passkeyService = new PasskeyService(mikro, config);
  const userService = new UserService(
    mikro,
    config,
    emailService,
    passwordAuthService,
    termsService,
  );
  const oauthAuthorizeService = new OAuthAuthorizeService(
    config,
    mikro,
    oauthClientService,
    userConsentService,
    securityService,
  );
  const oauthConnectService = new OAuthConnectService(
    config,
    userService,
    mikro,
    termsService,
  );
  const oauthTokenService = new OAuthTokenService(
    config,
    mikro,
    userService,
    oauthClientService,
    jwtService,
    securityService,
  );
  const cleanupService = new CleanupService(config, mikro, jwtService);
  const adminAuditService = new AdminAuditService(mikro);

  // 4. Scheduler
  const schedulerLogger = logger.child({ service: 'scheduler' });
  const schedulerConfig = config.scheduler
    ? isSchedulerConfigResolver(config.scheduler)
      ? config.scheduler({ mikro })
      : config.scheduler
    : undefined;
  const scheduler = new SchedulerService(
    schedulerConfig,
    cleanupService,
    schedulerLogger,
  );

  const services = {
    config,
    securityService,
    mikro,
    scheduler,
    emailService,
    jwtService,
    passwordAuthService,
    passwordResetService,
    termsService,
    userConsentService,
    oauthClientService,
    totpService,
    passkeyService,
    userService,
    oauthAuthorizeService,
    oauthConnectService,
    oauthTokenService,
    cleanupService,
    adminAuditService,
  };

  const cleanup = async () => {
    await scheduler.stop();
    await mikro.close();
  };

  return { services, cleanup };
}

export type InitResult = Awaited<ReturnType<typeof initializeServices>>;
export type ServiceContainer = InitResult['services'];
