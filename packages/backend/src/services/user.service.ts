import type { UserEntity } from '@/entities/user.entity.js';
import type { AppConfig } from '@/lib/config/index.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';
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
    };
  }
}

export class UserService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: AppConfig,
    private readonly emailService: EmailService,
    private readonly emailVerificationService?: EmailVerificationService,
  ) {}

  public async verifyUserById(
    id: string,
  ): Promise<z.infer<typeof r.UserSession>> {
    const user = await this.mikro.user.findOneOrFail(
      { id },
      { populate: ['password_hash'] },
    );
    const totpEnabled = await this.mikro.userTotp.isEnabled(id);
    const passkeyCount = await this.mikro.userPasskey.countByUserId(id);

    return {
      id: user.id,
      managed_by: user.managed_by,
      email: user.email,
      email_verified: user.email_verified,
      has_password: user.hasPassword(),
      totp_enabled: totpEnabled,
      totp_required: this.userTotpRequired(user),
      passkey_count: passkeyCount,
    };
  }

  public async verifyUserByEmailAndPassword(params: {
    email: string;
    password: string;
  }): Promise<z.infer<typeof r.UserSession>> {
    const user = await this.mikro.user.findOneOrFail(
      { email: params.email, deleted_at: null },
      {
        populate: ['password_hash'],
        failHandler: () => new e.InvalidEmailOrPassword.Error(),
      },
    );

    if (!(await user.verifyPassword(params.password))) {
      throw new e.InvalidEmailOrPassword.Error();
    }

    const totpEnabled = await this.mikro.userTotp.isEnabled(user.id);
    const passkeyCount = await this.mikro.userPasskey.countByUserId(user.id);
    return {
      id: user.id,
      managed_by: user.managed_by,
      email: user.email,
      email_verified: user.email_verified,
      has_password: user.hasPassword(),
      totp_enabled: totpEnabled,
      totp_required: this.userTotpRequired(user),
      passkey_count: passkeyCount,
    };
  }

  public async register(params: { email: string; password: string }): Promise<{
    emailVerificationRequired: boolean;
    userSession: z.infer<typeof r.UserSession>;
  }> {
    const emailExists = await this.emailExists(params.email);
    if (emailExists) {
      throw new e.EmailAlreadyExists.Error();
    }

    const user = this.mikro.user.create({
      email: params.email,
      password_hash: params.password,
    });

    await this.mikro.em.persist(user);
    await this.mikro.em.flush();

    const totpRequired = this.userTotpRequired(user);

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
      emailVerificationRequired: !!this.emailVerificationService,
      userSession: {
        id: user.id,
        managed_by: 'database',
        email: user.email,
        email_verified: user.email_verified,
        has_password: user.hasPassword(),
        totp_enabled: false,
        totp_required: totpRequired,
        passkey_count: 0,
      },
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
      throw new e.ConfigManagedAccountCannotBeDeleted.Error();
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

  public userTotpRequired(userLike: {
    managed_by: UserEntity['managed_by'];
  }): boolean {
    return (
      userLike.managed_by !== 'config' &&
      this.config.basic_authentication_methods.password.totp.enabled &&
      this.config.basic_authentication_methods.password.totp.required
    );
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
          const user = await userService.verifyUserById(userId);
          return user;
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
