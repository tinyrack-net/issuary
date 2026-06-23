import type { Loaded } from '@mikro-orm/core';
import type z from 'zod';
import type { UserEntity } from '../entities/user.entity.ts';
import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { Locale } from '../lib/locale.ts';
import { e } from '../schemas/error.ts';
import type { r } from '../schemas/response.ts';
import type { EmailService } from './email.service.ts';
import type { MikroService } from './mikro.service.ts';
import type { PasswordAuthService } from './password-auth.service.ts';
import type { TermsService } from './terms.service.ts';

export class UserService {
  private readonly mikro: MikroService;
  private readonly config: TinyAuthRuntimeConfig;
  private readonly emailService: EmailService;
  private readonly passwordAuthService: PasswordAuthService;
  private readonly termsService?: TermsService | undefined;
  public constructor(
    mikro: MikroService,
    config: TinyAuthRuntimeConfig,
    emailService: EmailService,
    passwordAuthService: PasswordAuthService,
    termsService?: TermsService,
  ) {
    this.mikro = mikro;
    this.config = config;
    this.emailService = emailService;
    this.passwordAuthService = passwordAuthService;
    this.termsService = termsService;
  }

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

    return this.buildSessionUser({
      user,
      totpRegistered: totpFullyRegistered,
      passkeyCount: user.passkeys.length,
    });
  }

  public async getSessionUserBySub(
    userSub: string,
  ): Promise<z.infer<typeof r.UserSession>> {
    const user = await this.mikro.user.verifyBySub(userSub);
    return this.userEntityToSessionUser(user);
  }

  public async buildSessionUser(params: {
    user: Pick<
      UserEntity,
      'sub' | 'managed_by' | 'email' | 'role' | 'email_verified'
    > & {
      hasPassword(): boolean;
    };
    totpRegistered: boolean;
    passkeyCount: number;
  }): Promise<z.infer<typeof r.UserSession>> {
    const { user, totpRegistered, passkeyCount } = params;
    const recoveryCodeCount = totpRegistered
      ? await this.mikro.userTotpRecoveryCode.countUnusedByUserSub(user.sub)
      : 0;

    return {
      sub: user.sub,
      managed_by: user.managed_by,
      email: user.email,
      role: user.role,
      email_verified: user.email_verified,
      email_verification_required: this.userEmailVerificationRequired(user),
      has_password: user.hasPassword(),
      totp_registered: totpRegistered,
      totp_recovery_codes_missing: totpRegistered && recoveryCodeCount === 0,
      second_factor_required: this.user2FASetupRequired(user),
      passkey_count: passkeyCount,
    };
  }

  public async adminUserEntityToResponse(
    user: Loaded<
      UserEntity,
      'password_hash' | 'passkeys' | 'totps',
      '*',
      never
    >,
  ): Promise<z.infer<typeof r.AdminUser>> {
    const sessionUser = await this.userEntityToSessionUser(user);
    return {
      ...sessionUser,
      deleted_at: user.deleted_at?.toISOString() ?? null,
    };
  }

  public async listAdminUsers(params: {
    query?: string | undefined;
    page: number;
    pageSize: number;
    includeDeleted: boolean;
    managedBy?: UserEntity['managed_by'] | undefined;
    role?: UserEntity['role'] | undefined;
  }): Promise<z.infer<typeof r.AdminUserListResponse>> {
    const where: Record<string, unknown> = {};
    if (!params.includeDeleted) {
      where['deleted_at'] = null;
    }
    if (params.managedBy) {
      where['managed_by'] = params.managedBy;
    }
    if (params.role) {
      where['role'] = params.role;
    }

    const query = params.query?.trim();
    if (query) {
      where['$or'] = [
        { email: { $like: `%${query}%` } },
        { sub: { $like: `%${query}%` } },
      ];
    }

    const [users, total] = await this.mikro.user.findAndCount(where, {
      populate: ['password_hash', 'totps', 'passkeys'],
      populateWhere: {
        totps: { verified: true },
        passkeys: {},
      },
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
      orderBy: { email: 'ASC' },
    });

    return {
      users: await Promise.all(
        users.map((user) => this.adminUserEntityToResponse(user)),
      ),
      pagination: {
        page: params.page,
        page_size: params.pageSize,
        total,
      },
    };
  }

  public async getAdminUser(sub: string): Promise<z.infer<typeof r.AdminUser>> {
    const user = await this.mikro.user.verifyBySubIncludingDeleted(sub);
    return this.adminUserEntityToResponse(user);
  }

  public async createAdminUser(params: {
    email: string;
    password: string;
    role?: UserEntity['role'] | undefined;
    emailVerified?: boolean | undefined;
  }): Promise<z.infer<typeof r.AdminUser>> {
    const user = await this.passwordAuthService.createDatabaseUser({
      email: params.email,
      password: params.password,
    });
    user.role = params.role ?? 'user';
    user.email_verified = params.emailVerified ?? false;
    await this.mikro.em.flush();

    return this.getAdminUser(user.sub);
  }

  public async updateAdminUser(params: {
    sub: string;
    actorSub: string;
    email?: string | undefined;
    role?: UserEntity['role'] | undefined;
    emailVerified?: boolean | undefined;
  }): Promise<z.infer<typeof r.AdminUser>> {
    const user = await this.mikro.user.verifyBySub(params.sub);

    if (params.sub === params.actorSub && params.role === 'user') {
      throw new e.Forbidden.Error();
    }

    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    if (user.deleted_at) {
      throw new e.UserNotFound.Error();
    }

    if (params.email !== undefined && params.email !== user.email) {
      const existing = await this.mikro.user.findOne({
        email: params.email,
        sub: { $ne: params.sub },
      });
      if (existing) {
        throw new e.EmailAlreadyExists.Error();
      }
      user.email = params.email;
    }
    if (params.role !== undefined) {
      user.role = params.role;
    }
    if (params.emailVerified !== undefined) {
      user.email_verified = params.emailVerified;
    }
    await this.mikro.em.flush();

    return this.getAdminUser(user.sub);
  }

  public async deleteAdminUser(params: {
    sub: string;
    actorSub: string;
  }): Promise<z.infer<typeof r.AdminUser>> {
    if (params.sub === params.actorSub) {
      throw new e.Forbidden.Error();
    }

    const user = await this.mikro.user.verifyBySub(params.sub);
    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }
    if (!user.deleted_at) {
      user.deleted_at = new Date();
      await this.mikro.em.flush();
    }

    return this.adminUserEntityToResponse(user);
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
    const user = await this.passwordAuthService.createDatabaseUser({
      email: params.email,
      password: params.password,
    });

    // 3. Generate email verification token and send email
    if (this.config.email) {
      const verification = await this.emailService.generateToken({
        userSub: user.sub,
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
          userSub: user.sub,
          consents: params.consents,
          terms,
        });
      }

      // Record implicit consents for terms with implicit consent mode
      await this.termsService.recordImplicitConsents({
        userSub: user.sub,
        terms,
      });
    }

    // 5. Return session info
    return {
      sub: user.sub,
      managed_by: 'database',
      email: user.email,
      role: user.role,
      email_verified: user.email_verified,
      email_verification_required: this.userEmailVerificationRequired(user),
      has_password: user.hasPassword(),
      totp_registered: false,
      totp_recovery_codes_missing: false,
      second_factor_required: this.user2FASetupRequired(user),
      passkey_count: 0,
    };
  }

  /**
   * @description
   * Request account deletion (soft delete).
   * Config-managed users cannot be deleted.
   */
  public async requestDeletion(userSub: string): Promise<{
    deleted_at: Date;
  }> {
    // Check if user exists and is not config-managed
    const user = await this.mikro.user.findOneOrFail(
      { sub: userSub, deleted_at: null },
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
    return (
      userLike.managed_by !== 'config' &&
      this.config.registration.email_verification_required &&
      !!this.config.email
    );
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
    return this.config.auth.password.two_factor.enrollment_required;
  }

  public async userRegistered2FAMethods(
    userSub: string,
  ): Promise<('totp' | 'passkey')[]> {
    const user = await this.mikro.user.findOneOrFail({
      sub: userSub,
    });
    const methods: ('totp' | 'passkey')[] = [];
    const totpEnabled = await this.mikro.userTotp.isRegistered(user.sub);
    if (totpEnabled) {
      methods.push('totp');
    }
    const passkeyCount = await this.mikro.userPasskey.countByUserSub(user.sub);
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
