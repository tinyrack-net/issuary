import type { UserEntity } from '@/entities/user.entity.js';
import type { InternalAppConfig } from '@/lib/config/index.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';
import type { Loaded } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import type { EmailVerificationService } from './email-verification.service.js';
import type { EmailService } from './email.service.js';

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
    private readonly config: InternalAppConfig,
    private readonly emailService: EmailService,
    private readonly emailVerificationService?: EmailVerificationService,
  ) {}

  public async userEntityToSessionUser(
    user: Loaded<
      UserEntity,
      'password_hash' | 'passkeys' | 'totps',
      '*',
      never
    >,
  ): Promise<z.infer<typeof r.UserSession>> {
    return {
      id: user.id,
      managed_by: user.managed_by,
      email: user.email,
      email_verified: user.email_verified,
      email_verification_required: this.userEmailVerificationRequired(user),
      has_password: user.hasPassword(),
      totp_registered: user.totps.length > 0,
      second_factor_required: this.user2FASetupRequired(user),
      passkey_count: user.passkeys.length,
    };
  }

  public async register(params: { email: string; password: string }): Promise<
    z.infer<typeof r.UserSession>
  > {
    const user = await this.mikro.user.register({
      email: params.email,
      password: params.password,
    });

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

  private async emailExists(email: string) {
    const count = await this.mikro.user.count({ email: email });
    return count > 0;
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
    return this.config.basic_authentication_methods.password.second_factor
      .required;
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
    if (this.config.basic_authentication_methods.password.totp.enabled) {
      methods.push('totp');
    }
    if (this.config.basic_authentication_methods.passkey.enabled) {
      methods.push('passkey');
    }
    return methods;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const userService = new UserService(
      fastify.mikro,
      fastify.config,
      fastify.emailService,
      fastify.emailVerificationService,
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
      'secure-session-plugin',
      'email-service-plugin',
    ],
  },
);
