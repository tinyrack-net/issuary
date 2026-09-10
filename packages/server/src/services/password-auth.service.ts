import type { Loaded } from '@mikro-orm/core';
import type { UserEntity } from '../entities/user.entity.ts';
import type { IssuaryRuntimeConfig } from '../lib/config/index.js';
import {
  assertPasswordPolicy,
  type PasswordPolicy,
} from '../lib/password-policy.ts';
import { e } from '../schemas/error.ts';
import { invalidateUserAuthentication } from './authentication-epoch.js';
import type { MikroService } from './mikro.service.ts';
import type { SecurityService } from './security.service.ts';
import {
  authenticationMethods,
  withUserSecurity,
} from './user-security.service.js';

export class PasswordAuthService {
  private readonly mikro: MikroService;
  private readonly securityService: SecurityService;
  private readonly passwordPolicy: PasswordPolicy;
  private readonly config: IssuaryRuntimeConfig;
  private dummyPasswordHash: Promise<string> | undefined;

  public constructor(
    mikro: MikroService,
    securityService: SecurityService,
    passwordPolicy: PasswordPolicy,
    config: IssuaryRuntimeConfig,
  ) {
    this.config = config;
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
    this.dummyPasswordHash ??= this.securityService.hashPassword(
      crypto.randomUUID(),
    );
    const dummyHash = await this.dummyPasswordHash;
    let user:
      | Loaded<UserEntity, 'password_hash' | 'passkeys' | 'totps', '*', never>
      | undefined;
    try {
      user = await this.mikro.user.findActiveByEmailForPasswordAuth(
        params.email,
      );
    } catch (error) {
      if (!(error instanceof e.InvalidEmailOrPassword.Error)) throw error;
    }
    const isValid = await this.securityService.verifyPassword(
      user?.password_hash ?? dummyHash,
      params.password,
    );
    if (!user?.password_hash) throw err;
    if (!isValid) {
      throw err;
    }

    return user;
  }

  public async prepareDatabasePassword(password: string): Promise<string> {
    assertPasswordPolicy(password, this.passwordPolicy);
    return this.securityService.hashPassword(password);
  }

  public async createDatabaseUser(params: {
    email: string;
    password: string;
  }): Promise<UserEntity> {
    const passwordHash = await this.prepareDatabasePassword(params.password);

    return this.mikro.user.register({
      email: params.email,
      passwordHash,
    });
  }

  public async setPasswordForUser(
    user: UserEntity,
    password: string,
  ): Promise<void> {
    return withUserSecurity(this.mikro, user.sub, async (freshUser) => {
      user = freshUser;
      if (user.managed_by === 'config') {
        throw new e.UserNotEditable.Error();
      }

      await this.mikro.em.populate(user, ['password_hash']);

      if (user.hasPassword()) {
        throw new e.PasswordAlreadySet.Error();
      }

      await this.replacePassword(user, password);
    });
  }

  public async changePassword(
    user: UserEntity,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    return withUserSecurity(this.mikro, user.sub, async (freshUser) => {
      user = freshUser;
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
    });
  }

  public async removePassword(
    user: UserEntity,
    currentPassword: string,
  ): Promise<void> {
    return withUserSecurity(this.mikro, user.sub, async (freshUser) => {
      user = freshUser;
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

      const methods = await authenticationMethods(
        this.mikro,
        this.config,
        user,
      );
      if (methods.oauth === 0 && methods.passkeys === 0) {
        if (
          methods.totp ||
          (await this.mikro.userPasskey.countByUserSub(user.sub)) > 0
        )
          throw new e.CannotRemovePasswordWithSecondFactorOnly.Error();
        throw new e.CannotRemoveLastAuthMethod.Error();
      }

      await invalidateUserAuthentication(this.mikro.em, user);
      user.password_hash = null;
      await this.mikro.em.flush();
    });
  }

  public async replacePassword(
    user: UserEntity,
    newPassword: string,
  ): Promise<void> {
    return withUserSecurity(this.mikro, user.sub, async (freshUser) => {
      user = freshUser;
      assertPasswordPolicy(newPassword, this.passwordPolicy);

      user.password_hash = await this.securityService.hashPassword(newPassword);
      await invalidateUserAuthentication(this.mikro.em, user);
      await this.mikro.em.flush();
    });
  }
}
