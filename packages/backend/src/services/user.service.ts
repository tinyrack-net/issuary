import type { Loaded } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { UserConsentEntity } from '@/entities/user-consent.entity.js';
import { UserOAuthEntity } from '@/entities/user-oauth.entity.js';
import { UserPasskeyEntity } from '@/entities/user-passkey.entity.js';
import { UserTermsConsentEntity } from '@/entities/user-terms-consent.entity.js';
import { UserTotpEntity } from '@/entities/user-totp.entity.js';
import { UserTotpRecoveryCodeEntity } from '@/entities/user-totp-recovery-code.entity.js';
import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
import type { MikroService } from '@/plugins/core/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';
import type { EmailService } from './email.service.js';
import type { EmailVerificationService } from './email-verification.service.js';
import type { TermsService } from './terms.service.js';
import type { CleanupOptions, CleanupResult } from './types.js';

declare module 'fastify' {
  interface FastifyInstance {
    userService: UserService;
  }
  interface FastifyRequest {
    auth: {
      verify: () => Promise<z.infer<typeof r.UserSession>>;
      verifyPending2FAUser: () => Promise<z.infer<typeof r.UserSession>>;
      verifyPending2FASetupUser: () => Promise<z.infer<typeof r.UserSession>>;
    };
  }
}

export class UserService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: ResolvedAppConfig,
    private readonly emailService: EmailService,
    private readonly emailVerificationService?: EmailVerificationService,
    private readonly termsService?: TermsService,
  ) {}

  public async userEntityToSessionUser(
    user: Loaded<
      UserEntity,
      'password_hash' | 'passkeys' | 'totps',
      '*',
      never
    >,
  ): Promise<z.infer<typeof r.UserSession>> {
    // Check if TOTP is fully registered (verified AND recovery_confirmed)
    const totpFullyRegistered = user.totps
      .getItems()
      .some((totp) => totp.verified && totp.recovery_confirmed);

    return {
      id: user.id,
      managed_by: user.managed_by,
      email: user.email,
      email_verified: user.email_verified,
      email_verification_required: this.userEmailVerificationRequired(user),
      has_password: user.hasPassword(),
      totp_registered: totpFullyRegistered,
      second_factor_required: this.user2FASetupRequired(user),
      passkey_count: user.passkeys.length,
    };
  }

  public async register(params: {
    email: string;
    password: string;
    consents?: Array<{ termsId: string; agreed: boolean }>;
  }): Promise<z.infer<typeof r.UserSession>> {
    // 1. Validate explicit terms consent before user creation
    // Load terms once and reuse across validation and recording
    const terms = this.termsService
      ? await this.termsService.getGlobalTerms()
      : undefined;

    if (this.termsService && terms) {
      const explicitTerms = await this.termsService.getExplicitTerms(terms);
      const hasRequiredExplicitTerms = explicitTerms.some((t) => t.required);

      if (hasRequiredExplicitTerms) {
        if (!params.consents || params.consents.length === 0) {
          throw new e.ValidationError.Error(
            'Terms consent is required for registration',
          );
        }

        const validation = await this.termsService.validateExplicitConsents(
          params.consents,
          terms,
        );
        if (!validation.valid) {
          throw new e.ValidationError.Error(
            `Missing required terms: ${validation.missingTerms.join(', ')}`,
          );
        }
      }
    }

    // 2. Register the user
    const user = await this.mikro.user.register({
      email: params.email,
      password: params.password,
    });

    // 3. Generate email verification token
    if (this.emailVerificationService) {
      const verification = await this.emailVerificationService.generateToken({
        userId: user.id,
      });
      await this.mikro.em.flush();
      this.emailService.sendVerificationEmailAsync({
        email: user.email,
        token: verification.token,
      });
    }

    // 4. Record terms consent after successful registration
    if (this.termsService && terms) {
      // Record explicit consents provided by user
      if (params.consents && params.consents.length > 0) {
        await this.termsService.recordConsents({
          userId: user.id,
          consents: params.consents,
          terms,
        });
      }

      // Record implicit consents for terms with implicit consent mode
      await this.termsService.recordImplicitConsents({
        userId: user.id,
        terms,
      });
    }

    // 5. Return session info
    return {
      id: user.id,
      managed_by: 'database',
      email: user.email,
      email_verified: user.email_verified,
      email_verification_required: this.userEmailVerificationRequired(user),
      has_password: user.hasPassword(),
      totp_registered: false,
      second_factor_required: this.user2FASetupRequired(user),
      passkey_count: 0,
    };
  }

  /**
   * @description
   * Request account deletion (soft delete).
   * Config-managed users cannot be deleted.
   */
  public async requestDeletion(userId: string): Promise<{
    deleted_at: Date;
  }> {
    // Check if user exists and is not config-managed
    const user = await this.mikro.user.findOneOrFail(
      { id: userId, deleted_at: null },
      { failHandler: () => new e.UserNotFound.Error() },
    );

    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    // Soft delete the user
    user.deleted_at = new Date();
    await this.mikro.em.flush();

    return {
      deleted_at: user.deleted_at,
    };
  }

  public userEmailVerificationRequired(userLike: {
    managed_by: UserEntity['managed_by'];
  }): boolean {
    return userLike.managed_by !== 'config' && !!this.config.smtp;
  }

  /**
   * Determines if second factor setup is required for a user.
   */
  public user2FASetupRequired(userLike: {
    managed_by: UserEntity['managed_by'];
  }): boolean {
    if (userLike.managed_by === 'config') {
      return false;
    }
    return this.config.auth.password.second_factor.required;
  }

  public async userRegistered2FAMethods(
    userId: string,
  ): Promise<('totp' | 'passkey')[]> {
    const user = await this.mikro.user.findOneOrFail({
      id: userId,
    });
    const methods: ('totp' | 'passkey')[] = [];
    const totpEnabled = await this.mikro.userTotp.isRegistered(user.id);
    if (totpEnabled) {
      methods.push('totp');
    }
    const passkeyCount = await this.mikro.userPasskey.countByUserId(user.id);
    if (passkeyCount > 0) {
      methods.push('passkey');
    }
    return methods;
  }

  /**
   * Returns the available 2FA setup methods based on config.
   * Only returns methods that are enabled in config.
   */
  public getAvailable2FASetupMethods(): ('totp' | 'passkey')[] {
    const methods: ('totp' | 'passkey')[] = [];
    if (this.config.auth.password.totp.enabled) {
      methods.push('totp');
    }
    if (this.config.auth.passkey.enabled) {
      methods.push('passkey');
    }
    return methods;
  }

  /**
   * Permanently delete users marked for deletion whose retention period
   * has expired.
   *
   * This is a destructive operation that:
   * 1. Deletes all user-related data (OAuth accounts, TOTP, passkeys, consents)
   * 2. Removes the user record permanently
   *
   * The retention period is configured in cleanup.deleted_users.retention
   * (e.g., "30d", "90d").
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  public async purgeDeletedUsers(
    options: CleanupOptions,
  ): Promise<CleanupResult> {
    const config = this.config.cleanup.deleted_users;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    // Check if account deletion feature is enabled
    if (!this.config.app.account_deletion) {
      return {
        deletedCount: 0,
        skipped: true,
        message: 'Account deletion feature is disabled',
      };
    }

    const em = this.mikro.orm.em.fork();
    const userRepo = em.getRepository(UserEntity);
    const userOAuthRepo = em.getRepository(UserOAuthEntity);
    const userTotpRepo = em.getRepository(UserTotpEntity);
    const userTotpRecoveryCodeRepo = em.getRepository(
      UserTotpRecoveryCodeEntity,
    );
    const userPasskeyRepo = em.getRepository(UserPasskeyEntity);
    const userConsentRepo = em.getRepository(UserConsentEntity);
    const userTermsConsentRepo = em.getRepository(UserTermsConsentEntity);
    const emailVerificationRepo = em.getRepository(EmailVerificationEntity);
    const passwordResetRepo = em.getRepository(PasswordResetEntity);

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Find users marked for deletion whose retention period has expired
    const usersToDelete = await userRepo.find({
      deleted_at: { $ne: null, $lt: cutoffDate },
      managed_by: 'database', // Only delete database-managed users
    });

    if (usersToDelete.length === 0) {
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No users ready for permanent deletion',
      };
    }

    if (options.dryRun) {
      return {
        deletedCount: usersToDelete.length,
        skipped: false,
        message: `Would delete ${usersToDelete.length} users (retention: ${formatDuration(retentionMs)})`,
      };
    }

    let deletedCount = 0;

    for (const user of usersToDelete) {
      try {
        // Delete related entities first (cascading delete)
        // OAuth accounts
        const oauthAccounts = await userOAuthRepo.find({
          user: user.id,
        });
        for (const account of oauthAccounts) {
          em.remove(account);
        }

        // TOTP
        const totps = await userTotpRepo.find({ user: user.id });
        for (const totp of totps) {
          em.remove(totp);
        }

        // TOTP recovery codes
        const recoveryCodes = await userTotpRecoveryCodeRepo.find({
          user: user.id,
        });
        for (const code of recoveryCodes) {
          em.remove(code);
        }

        // Passkeys
        const passkeys = await userPasskeyRepo.find({
          user: user.id,
        });
        for (const passkey of passkeys) {
          em.remove(passkey);
        }

        // User consents
        const consents = await userConsentRepo.find({
          user: user.id,
        });
        for (const consent of consents) {
          em.remove(consent);
        }

        // User terms consents
        const termsConsents = await userTermsConsentRepo.find({
          user: user.id,
        });
        for (const consent of termsConsents) {
          em.remove(consent);
        }

        // Email verifications
        const verifications = await emailVerificationRepo.find({
          user: user.id,
        });
        for (const verification of verifications) {
          em.remove(verification);
        }

        // Password resets
        const passwordResets = await passwordResetRepo.find({
          user: user.id,
        });
        for (const reset of passwordResets) {
          em.remove(reset);
        }

        // Finally delete the user
        em.remove(user);
        deletedCount++;
      } catch {
        // Log error but continue with other users
        // Note: In production, consider adding a logger parameter
      }
    }

    await em.flush();

    return {
      deletedCount,
      skipped: false,
      message: `Retention: ${formatDuration(retentionMs)}`,
    };
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const userService = new UserService(
      fastify.mikro,
      fastify.config,
      fastify.emailService,
      fastify.emailVerificationService,
      fastify.termsService,
    );
    fastify.decorate('userService', userService);

    fastify.addHook('onRequest', async (req) => {
      req.auth = {
        verify: async () => {
          const userId = req.session.get('user')?.id;
          if (!userId) {
            throw new e.Unauthorized.Error();
          }
          const userEntity = await fastify.mikro.user.verifyById(userId);
          return userService.userEntityToSessionUser(userEntity);
        },
        verifyPending2FAUser: async () => {
          const userId = req.session.get('pending2FAUser')?.id;
          if (!userId) {
            throw new e.Unauthorized.Error();
          }
          const userEntity = await fastify.mikro.user.verifyById(userId);
          return userService.userEntityToSessionUser(userEntity);
        },
        verifyPending2FASetupUser: async () => {
          const userId = req.session.get('pending2FASetup')?.id;
          if (!userId) {
            throw new e.Unauthorized.Error();
          }
          const userEntity = await fastify.mikro.user.verifyById(userId);
          return userService.userEntityToSessionUser(userEntity);
        },
      };
    });
  },
  {
    name: 'user-service-plugin',
    dependencies: [
      'base-service-plugin',
      'email-service-plugin',
      'terms-service-plugin',
    ],
  },
);
