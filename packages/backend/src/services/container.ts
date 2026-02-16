import { getDbConfigs } from '@backend/db/index.js';
import { EmailVerificationEntitySchema } from '@backend/entities/email-verification.entity.js';
import {
  JwtKeyEntity,
  JwtKeyStatus,
} from '@backend/entities/jwt-key.entity.js';
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
import { seedConfig } from '@backend/seeders/config.seeder.js';
import { CleanupService } from '@backend/services/cleanup.service.js';
import { EmailService } from '@backend/services/email.service.js';
import { EmailVerificationService } from '@backend/services/email-verification.service.js';
import { JwtService } from '@backend/services/jwt.service.js';
import type { MikroService } from '@backend/services/mikro.types.js';
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
import { MikroORM, type Options } from '@mikro-orm/core';
import { Cron } from 'croner';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

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
  if (!serverOptions.silent) {
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

  if (!serverOptions.silent) {
    console.info('MikroORM initialized (database: %s)', config.database.type);
  }

  const mikro: MikroService = {
    orm,
    em: orm.em,
    user: orm.em.getRepository(UserEntity),
    userOAuth: orm.em.getRepository(UserOAuthEntitySchema),
    oauthCode: orm.em.getRepository(OAuthCodeEntitySchema),
    oauthClient: orm.em.getRepository(OAuthClientEntitySchema),
    emailVerification: orm.em.getRepository(EmailVerificationEntitySchema),
    passwordReset: orm.em.getRepository(PasswordResetEntitySchema),
    jwtKey: orm.em.getRepository(JwtKeyEntity),
    revokedToken: orm.em.getRepository(RevokedTokenEntitySchema),
    userConsent: orm.em.getRepository(UserConsentEntity),
    userTermsConsent: orm.em.getRepository(UserTermsConsentEntity),
    userTotp: orm.em.getRepository(UserTotpEntitySchema),
    userTotpRecoveryCode: orm.em.getRepository(
      UserTotpRecoveryCodeEntitySchema,
    ),
    userPasskey: orm.em.getRepository(UserPasskeyEntitySchema),
    terms: orm.em.getRepository(TermsEntitySchema),
    termsContent: orm.em.getRepository(TermsContentEntitySchema),
  };

  // 2. Initialize Nodemailer
  let mail: ServiceContainer['mail'] = null;
  if (config.smtp) {
    mail = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
    if (!serverOptions.silent) {
      console.info(
        'Nodemailer initialized (host: %s, port: %d)',
        config.smtp.host,
        config.smtp.port,
      );
    }
  } else {
    if (!serverOptions.silent) {
      console.warn('Nodemailer: no SMTP config, emails disabled');
    }
  }

  // 3. Bootstrap: seed config users/clients
  await seedConfig(orm.em.fork(), config);
  if (!serverOptions.silent) {
    console.info(
      'Bootstrap complete (users: %d, clients: %d)',
      config.users.length,
      config.clients.length,
    );
  }

  // 4. Create services (respecting dependency order)
  const emailService = new EmailService(config, mail);
  const emailVerificationService = config.smtp
    ? new EmailVerificationService(mikro)
    : undefined;
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
    emailVerificationService,
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

  // 5. JWT key bootstrap (ensure active key)
  {
    const em = orm.em.fork();
    const jwtKeyRepo = em.getRepository(JwtKeyEntity);
    const activeKey = await jwtKeyRepo.findOne({
      status: JwtKeyStatus.ACTIVE,
    });
    if (!activeKey) {
      const nextKey = await jwtKeyRepo.findOne({
        status: JwtKeyStatus.NEXT,
      });
      if (nextKey) {
        nextKey.status = JwtKeyStatus.ACTIVE;
        nextKey.activated_at = new Date();
        await em.flush();
      } else {
        const keyPair = await jwtService.generateKeyPair();
        const rotationDays = config.app.jwt_key_rotation_days ?? 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + rotationDays);
        const entity = em.create(JwtKeyEntity, {
          kid: keyPair.kid,
          private_key: keyPair.privateKey,
          public_key: keyPair.publicKey,
          algorithm: keyPair.algorithm,
          status: JwtKeyStatus.ACTIVE,
          activated_at: new Date(),
          expires_at: expiresAt,
        });
        await em.persist(entity).flush();
      }
    }
    jwtService.clearActiveKeyCache();
  }

  // 6. Scheduler
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
    mail,
    scheduler,
    emailService,
    emailVerificationService,
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
    await orm.close();
  };

  return { services, cleanup };
}
