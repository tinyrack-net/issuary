import type { IPasswordResetEntity } from '#backend/entities/password-reset.entity.js';
import type { UserEntity } from '#backend/entities/user.entity.js';
import { e } from '#backend/schemas/error.js';
import type { MikroService } from '#backend/services/mikro.service.js';

export class PasswordResetService {
  private readonly mikro: MikroService;
  public constructor(mikro: MikroService) {
    this.mikro = mikro;
  }

  /**
   * Generate password reset token for a user
   * Invalidates all previous unused tokens
   */
  async generateToken(params: {
    userSub: string;
    expiresInHours?: number;
  }): Promise<IPasswordResetEntity> {
    const token = await this.mikro.passwordReset.generateToken({
      userSub: params.userSub,
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
  ): Promise<IPasswordResetEntity | null> {
    const user = await this.mikro.user.findOneOrFail(
      { email },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

    if (user.managed_by !== 'database') {
      throw new e.UserNotEditable.Error();
    }

    const token = await this.generateToken({ userSub: user.sub });
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
}
