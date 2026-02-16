import type { UserEntity } from '@backend/entities/user.entity.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import type { Locale } from '@backend/lib/locale.js';
import { e } from '@backend/schemas/error.js';
import type { r } from '@backend/schemas/response.js';
import type { MikroService } from '@backend/services/mikro.service.js';
import type { Loaded } from '@mikro-orm/core';
import type z from 'zod';
import type { EmailService } from './email.service.js';
import type { TermsService } from './terms.service.js';

export class UserService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: ResolvedAppConfig,
    private readonly emailService: EmailService,
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
    locale?: Locale | undefined;
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

    // 3. Generate email verification token and send email
    if (this.config.smtp) {
      const verification = await this.emailService.generateToken({
        userId: user.id,
      });
      await this.mikro.em.flush();
      this.emailService.sendVerificationEmailAsync({
        email: user.email,
        token: verification.token,
        locale: params.locale,
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
}
