import type { Loaded } from '@mikro-orm/core';
import type { UserEntity } from '../entities/user.entity.ts';
import {
  assertPasswordPolicy,
  type PasswordPolicy,
} from '../lib/password-policy.ts';
import { e } from '../schemas/error.ts';
import type { MikroService } from './mikro.service.ts';
import type { SecurityService } from './security.service.ts';

export class PasswordAuthService {
  private readonly mikro: MikroService;
  private readonly securityService: SecurityService;
  private readonly passwordPolicy: PasswordPolicy;

  public constructor(
    mikro: MikroService,
    securityService: SecurityService,
    passwordPolicy: PasswordPolicy,
  ) {
    this.mikro = mikro;
    this.securityService = securityService;
    this.passwordPolicy = passwordPolicy;
  }

  public async authenticateByEmailAndPassword(params: {
    email: string;
    password: string;
  }): Promise<
    Loaded<UserEntity, 'password_hash' | 'passkeys' | 'totps', '*', never>
  > {
    const err = new e.InvalidEmailOrPassword.Error();
    const user = await this.mikro.user.findActiveByEmailForPasswordAuth(
      params.email,
    );

    if (!user.password_hash) {
      throw err;
    }

    const isValid = await this.securityService.verifyPassword(
      user.password_hash,
      params.password,
    );

    if (!isValid) {
      throw err;
    }

    return user;
  }

  public async createDatabaseUser(params: {
    email: string;
    password: string;
  }): Promise<UserEntity> {
    assertPasswordPolicy(params.password, this.passwordPolicy);

    const passwordHash = await this.securityService.hashPassword(
      params.password,
    );

    return this.mikro.user.register({
      email: params.email,
      passwordHash,
    });
  }

  public async setPasswordForUser(
    user: UserEntity,
    password: string,
  ): Promise<void> {
    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    await this.mikro.em.populate(user, ['password_hash']);

    if (user.hasPassword()) {
      throw new e.PasswordAlreadySet.Error();
    }

    await this.replacePassword(user, password);
  }

  public async changePassword(
    user: UserEntity,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    await this.mikro.em.populate(user, ['password_hash']);

    if (!user.password_hash) {
      throw new e.PasswordNotSet.Error();
    }

    const isValid = await this.securityService.verifyPassword(
      user.password_hash,
      currentPassword,
    );
    if (!isValid) {
      throw new e.InvalidCurrentPassword.Error();
    }

    await this.replacePassword(user, newPassword);
  }

  public async removePassword(
    user: UserEntity,
    currentPassword: string,
  ): Promise<void> {
    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    await this.mikro.em.populate(user, ['password_hash']);

    if (!user.password_hash) {
      throw new e.PasswordNotSet.Error();
    }

    const isValid = await this.securityService.verifyPassword(
      user.password_hash,
      currentPassword,
    );
    if (!isValid) {
      throw new e.InvalidCurrentPassword.Error();
    }

    const oauthCount = await this.mikro.userOAuth.countByUser(user.sub);
    const hasTotp = await this.mikro.userTotp.isRegistered(user.sub);
    const passkeyCount = await this.mikro.userPasskey.countByUserSub(user.sub);
    const hasSecondFactor = hasTotp || passkeyCount > 0;

    if (oauthCount === 0) {
      if (hasSecondFactor) {
        throw new e.CannotRemovePasswordWithSecondFactorOnly.Error();
      }
      throw new e.CannotRemoveLastAuthMethod.Error();
    }

    user.password_hash = null;
    await this.mikro.em.flush();
  }

  public async replacePassword(
    user: UserEntity,
    newPassword: string,
  ): Promise<void> {
    assertPasswordPolicy(newPassword, this.passwordPolicy);

    user.password_hash = await this.securityService.hashPassword(newPassword);
    await this.mikro.em.flush();
  }
}
