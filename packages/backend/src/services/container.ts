import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { seedConfig } from '@backend/seeders/config.seeder.js';
import { CleanupService } from '@backend/services/cleanup.service.js';
import { EmailService } from '@backend/services/email.service.js';
import { JwtService } from '@backend/services/jwt.service.js';
import { MikroService } from '@backend/services/mikro.service.js';
import { OAuthAuthorizeService } from '@backend/services/oauth-authorize.service.js';
import { OAuthClientService } from '@backend/services/oauth-client.service.js';
import { OAuthConnectService } from '@backend/services/oauth-connect.service.js';
import { OAuthTokenService } from '@backend/services/oauth-token.service.js';
import { PasskeyService } from '@backend/services/passkey.service.js';
import { PasswordResetService } from '@backend/services/password-reset.service.js';
import { TermsService } from '@backend/services/terms.service.js';
import { TotpService } from '@backend/services/totp.service.js';
import { UserService } from '@backend/services/user.service.js';
import { UserConsentService } from '@backend/services/user-consent.service.js';
import { Cron } from 'croner';

export interface ServiceContainer {
  config: ResolvedAppConfig;
  mikro: MikroService;
  scheduler: {
    cleanupJob: Cron | null;
    start: () => void;
    stop: () => void;
  };
  emailService: EmailService;
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
  silent: boolean;
}

export interface InitResult {
  services: ServiceContainer;
  cleanup: () => Promise<void>;
}

export async function initializeServices(
  config: ResolvedAppConfig,
  serverOptions: ServerOptions,
): Promise<InitResult> {
  // 1. Initialize MikroORM
  const mikro = await MikroService.initialize(config, {
    silent: serverOptions.silent,
  });

  // 2. Bootstrap: seed config users/clients
  await seedConfig(mikro.orm.em.fork(), config);
  if (!serverOptions.silent) {
    console.info(
      'Bootstrap complete (users: %d, clients: %d)',
      config.users.length,
      config.clients.length,
    );
  }

  // 3. Create services (respecting dependency order)
  const emailService = new EmailService(config, mikro, {
    silent: serverOptions.silent,
  });
  const jwtService = new JwtService(config, mikro);
  const passwordResetService = new PasswordResetService(mikro);
  const termsService = new TermsService(mikro);
  const userConsentService = new UserConsentService(mikro);
  const oauthClientService = new OAuthClientService(mikro);
  const totpService = new TotpService(mikro, config);
  const passkeyService = new PasskeyService(mikro, config);
  const userService = new UserService(
    mikro,
    config,
    emailService,
    termsService,
  );
  const oauthAuthorizeService = new OAuthAuthorizeService(
    config,
    mikro,
    oauthClientService,
    userConsentService,
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
  );
  const cleanupService = new CleanupService(config, mikro, jwtService);

  // 4. Scheduler
  const scheduler: ServiceContainer['scheduler'] = {
    cleanupJob: null,
    start: () => {
      const { enabled, cron } = config.scheduler;
      if (!enabled || scheduler.cleanupJob) return;
      const job = new Cron(cron, async () => {
        try {
          await cleanupService.runAll({
            dryRun: false,
            verbose: false,
          });
        } catch (error) {
          console.error(
            'Scheduled cleanup failed:',
            error instanceof Error ? error.message : String(error),
          );
        }
      });
      scheduler.cleanupJob = job;
    },
    stop: () => {
      if (scheduler.cleanupJob) {
        scheduler.cleanupJob.stop();
        scheduler.cleanupJob = null;
      }
    },
  };

  if (!serverOptions.silent) {
    console.info(
      'Scheduler initialized (enabled: %s, cron: %s)',
      config.scheduler.enabled,
      config.scheduler.cron,
    );
  }

  const services: ServiceContainer = {
    config,
    mikro,
    scheduler,
    emailService,
    jwtService,
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
  };

  const cleanup = async () => {
    scheduler.stop();
    await mikro.close();
  };

  return { services, cleanup };
}
