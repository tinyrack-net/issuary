import fastifyPlugin from 'fastify-plugin';
import type { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import type { UserEntity } from '@/entities/user.entity.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';

declare module 'fastify' {
  interface FastifyInstance {
    passwordResetService: PasswordResetService;
  }
}

export class PasswordResetService {
  public constructor(private readonly mikro: MikroService) {}

  /**
   * Generate password reset token for a user
   * Invalidates all previous unused tokens
   */
  async generateToken(params: {
    userId: string;
    expiresInHours?: number;
  }): Promise<PasswordResetEntity> {
    const token = await this.mikro.passwordReset.generateToken({
      userId: params.userId,
      expiresInHours: params.expiresInHours || 1,
    });

    return token;
  }

  /**
   * Request password reset for an email
   * Returns token entity if user exists and is database-managed
   */
  async requestPasswordReset(
    email: string,
  ): Promise<PasswordResetEntity | null> {
    const user = await this.mikro.user.findOneOrFail(
      { email },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

    if (user.managed_by !== 'database') {
      throw new e.UserNotEditable.Error();
    }

    const token = await this.generateToken({ userId: user.id });
    await this.mikro.em.flush();

    return token;
  }

  /**
   * Reset password with token
   * Verifies token and updates user password
   */
  async resetPassword(params: {
    token: string;
    password: string;
  }): Promise<UserEntity> {
    const resetEntity = await this.mikro.passwordReset.verifyToken(
      params.token,
    );

    if (!resetEntity) {
      throw new e.InvalidPasswordResetToken.Error();
    }

    const user = await resetEntity.user.loadOrFail({
      failHandler: () => new e.UserNotFound.Error(),
    });

    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    user.password_hash = params.password;
    await this.mikro.em.flush();

    return user;
  }

  /**
   * Validate a password reset token without using it
   */
  async validateToken(token: string): Promise<boolean> {
    const entity = await this.mikro.passwordReset.findValidToken(token);
    return entity !== null;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const service = new PasswordResetService(fastify.mikro);
    fastify.decorate('passwordResetService', service);
  },
  {
    name: 'password-reset-service-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
