import fastifyPlugin from 'fastify-plugin';
import type { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import type { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';
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
   * Check if user is from config (not editable)
   */
  private isConfigUser(email: string): boolean {
    return AppConfigs.users.some((u) => u.email === email);
  }

  /**
   * Generate password reset token for a user
   * Invalidates all previous unused tokens
   */
  async generateToken(params: {
    user: UserEntity;
    expiresInHours?: number;
  }): Promise<PasswordResetEntity> {
    const token = await this.mikro.passwordReset.generateToken({
      user: params.user,
      expiresInHours: params.expiresInHours || 1,
    });

    return token;
  }

  /**
   * Request password reset for an email
   * Returns token entity if user exists and is editable
   * Returns null if user doesn't exist (to prevent email enumeration)
   * Throws error if user is not editable (config user)
   */
  async requestPasswordReset(
    email: string,
  ): Promise<PasswordResetEntity | null> {
    // Check if this is a config user (not editable)
    if (this.isConfigUser(email)) {
      throw new e.UserNotEditable.Error();
    }

    // Try to find user in database
    const user = await this.mikro.user.findOne({ email });

    if (!user) {
      // Return null to prevent email enumeration
      // The route handler should still return success
      return null;
    }

    // Check if user is editable
    if (!user.editable) {
      throw new e.UserNotEditable.Error();
    }

    // Generate token (this invalidates old ones)
    const token = await this.generateToken({ user });

    // Ensure changes are persisted
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

    // Check if this is a config user (not editable)
    if (this.isConfigUser(resetEntity.user.email)) {
      throw new e.UserNotEditable.Error();
    }

    // Check if user is editable
    if (!resetEntity.user.editable) {
      throw new e.UserNotEditable.Error();
    }

    // Update user password
    resetEntity.user.password_hash = params.password;
    await this.mikro.em.flush();

    return resetEntity.user;
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
