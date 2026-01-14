import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import type { UserEntity } from '@/entities/user.entity.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';

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
  public constructor(private readonly mikro: MikroService) {}

  /**
   * @description
   * Verifies a user by their ID.
   * Config users are now synced to DB, so we only need to query DB.
   */
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
      managed: user.managed_by,
      email: user.email,
      email_verified: user.email_verified,
      has_password: user.hasPassword(),
      totp_enabled: totpEnabled,
      totp_required: false,
      passkey_count: passkeyCount,
    };
  }

  /**
   * @description
   * Logs in a user with the provided email and password.
   * All users (including config users) are now in DB with hashed passwords.
   */
  public async login(params: {
    email: string;
    password: string;
  }): Promise<z.infer<typeof r.UserSession>> {
    const user = await this.mikro.user.findOneOrFail(
      { email: params.email },
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
      managed: user.managed_by,
      email: user.email,
      email_verified: user.email_verified,
      has_password: user.hasPassword(),
      totp_enabled: totpEnabled,
      totp_required: false,
      passkey_count: passkeyCount,
    };
  }

  /**
   * @description
   * Registers a new user with email and password.
   * Config users are already in DB, so email uniqueness is enforced by DB.
   */
  public async register(params: { email: string; password: string }): Promise<{
    user: UserEntity;
  }> {
    const emailExists = await this.exists(params.email);
    if (emailExists) {
      throw new e.EmailAlreadyExists.Error();
    }

    const user = this.mikro.user.create({
      email: params.email,
      password_hash: params.password,
    });

    await this.mikro.em.persist(user);

    return {
      user: user,
    };
  }

  private async exists(email: string) {
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
}

export default fastifyPlugin(
  async (fastify) => {
    const userService = new UserService(fastify.mikro);
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
    dependencies: ['base-service-plugin', 'secure-session-plugin'],
  },
);
