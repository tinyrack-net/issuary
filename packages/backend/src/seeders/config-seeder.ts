import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { hash } from 'argon2';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';

export class ConfigSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.seedUsers(em);
    await this.seedOAuthClients(em);
    await em.flush();
  }

  private async seedUsers(em: EntityManager): Promise<void> {
    const userRepository = em.getRepository(UserEntity);

    const users = await userRepository.findAll({
      where: {
        id: {
          $in: AppConfigs.users?.map((u) => u.id) || [],
        },
      },
    });

    await userRepository.upsertMany(
      await Promise.all(
        (AppConfigs.users || []).map(async (user) => {
          const existingUser = users.find((u) => u.id === user.id);
          const hashedPassword = await hash(user.password);

          if (existingUser) {
            existingUser.email = user.email;
            existingUser.password_hash = hashedPassword;
            existingUser.totp_secret = user.totp_secret || null;
            existingUser.totp_backup_codes = user.totp_backup_codes || null;
            existingUser.editable = false;
            existingUser.email_verified = true;
            return existingUser;
          } else {
            const newUser = new UserEntity({
              email: user.email,
              password_hash: hashedPassword,
            });
            newUser.id = user.id;
            newUser.totp_secret = user.totp_secret || null;
            newUser.totp_backup_codes = user.totp_backup_codes || null;
            newUser.editable = false;
            newUser.email_verified = true;
            return newUser;
          }
        }),
      ),
    );
  }

  private async seedOAuthClients(em: EntityManager): Promise<void> {
    const staticOAuthClients = Object.values(AppConfigs.providers || {});
    const oauthClientRepository = em.getRepository(OAuthClientEntity);

    const oauthClients = await oauthClientRepository.findAll({
      where: {
        id: {
          $in: staticOAuthClients.map((c) => c.id) || [],
        },
      },
    });

    await oauthClientRepository.upsertMany(
      await Promise.all(
        staticOAuthClients.map(async (client) => {
          const existingClient = oauthClients.find((c) => c.id === client.id);
          const hashedSecret = await hash(client.client_secret);

          if (existingClient) {
            existingClient.name = client.name;
            existingClient.clientId = client.client_id;
            existingClient.clientSecretHash = hashedSecret;
            existingClient.redirectUris = client.redirect_uris;
            existingClient.grantTypes = client.grant_types;
            existingClient.responseTypes = client.response_types;
            existingClient.scopes = client.scope.split(' ');
            existingClient.editable = false;
            return existingClient;
          } else {
            const newClient = new OAuthClientEntity({
              id: client.id,
              name: client.name,
              clientId: client.client_id,
              clientSecretHash: hashedSecret,
            });
            newClient.redirectUris = client.redirect_uris;
            newClient.grantTypes = client.grant_types;
            newClient.responseTypes = client.response_types;
            newClient.scopes = client.scope.split(' ');
            newClient.editable = false;
            return newClient;
          }
        }),
      ),
    );
  }
}
