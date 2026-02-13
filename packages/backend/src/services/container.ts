import { MikroORM, type Options } from '@mikro-orm/core';
import { Cron } from 'croner';
import nodemailer from 'nodemailer';
import { getDbConfigs } from '@/db/index.js';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { JwtKeyEntity, JwtKeyStatus } from '@/entities/jwt-key.entity.js';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import { RevokedTokenEntity } from '@/entities/revoked-token.entity.js';
import { TermsEntity } from '@/entities/terms.entity.js';
import { TermsContentEntity } from '@/entities/terms-content.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { UserConsentEntity } from '@/entities/user-consent.entity.js';
import { UserOAuthEntity } from '@/entities/user-oauth.entity.js';
import { UserPasskeyEntity } from '@/entities/user-passkey.entity.js';
import { UserTermsConsentEntity } from '@/entities/user-terms-consent.entity.js';
import { UserTotpEntity } from '@/entities/user-totp.entity.js';
import { UserTotpRecoveryCodeEntity } from '@/entities/user-totp-recovery-code.entity.js';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
import { env } from '@/lib/env.js';

import type { UserOAuthRepository } from '@/repositories/user-oauth.repository.js';
import { seedConfig } from '@/seeders/config.seeder.js';
import { CleanupService } from '@/services/cleanup.service.js';
import { EmailService } from '@/services/email.service.js';
import { EmailVerificationService } from '@/services/email-verification.service.js';
import { JwtService } from '@/services/jwt.service.js';
import { OAuthAuthorizeService } from '@/services/oauth-authorize.service.js';
import { OAuthClientService } from '@/services/oauth-client.service.js';
import { OAuthConnectService } from '@/services/oauth-connect.service.js';
import { OAuthTokenService } from '@/services/oauth-token.service.js';
import { PasskeyService } from '@/services/passkey.service.js';
import { PasswordResetService } from '@/services/password-reset.service.js';
import { TermsService } from '@/services/terms.service.js';
import { TotpService } from '@/services/totp.service.js';
import { UserService } from '@/services/user.service.js';
import { UserConsentService } from '@/services/user-consent.service.js';
import type { MikroService, ServerOptions, ServiceContainer } from '@/types.js';

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
    await orm.schema.refreshDatabase();
  } else if (env.APP_ENV === 'development') {
    await orm.schema.updateSchema();
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
    userOAuth: orm.em.getRepository(
      UserOAuthEntity,
    ) as unknown as UserOAuthRepository,
    oauthCode: orm.em.getRepository(OAuthCodeEntity),
    oauthClient: orm.em.getRepository(OAuthClientEntity),
    emailVerification: orm.em.getRepository(EmailVerificationEntity),
    passwordReset: orm.em.getRepository(PasswordResetEntity),
    jwtKey: orm.em.getRepository(JwtKeyEntity),
    revokedToken: orm.em.getRepository(RevokedTokenEntity),
    userConsent: orm.em.getRepository(UserConsentEntity),
    userTermsConsent: orm.em.getRepository(UserTermsConsentEntity),
    userTotp: orm.em.getRepository(UserTotpEntity),
    userTotpRecoveryCode: orm.em.getRepository(UserTotpRecoveryCodeEntity),
    userPasskey: orm.em.getRepository(UserPasskeyEntity),
    terms: orm.em.getRepository(TermsEntity),
    termsContent: orm.em.getRepository(TermsContentEntity),
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
