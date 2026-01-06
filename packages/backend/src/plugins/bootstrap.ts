import fastifyPlugin from 'fastify-plugin';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';

export default fastifyPlugin(
  async (fastify) => {
    const em = fastify.mikro.orm.em.fork();
    const userRepository = em.getRepository(UserEntity);

    const users = await userRepository.findAll({
      where: {
        id: {
          $in: AppConfigs.users?.map((u) => u.id) || [],
        },
      },
    });

    const staticOAuthClients = Object.values(AppConfigs.providers || {});

    const oauthClients = await em.getRepository(OAuthClientEntity).findAll({
      where: {
        id: {
          $in: staticOAuthClients.map((c) => c.id) || [],
        },
      },
    });

    await userRepository.upsertMany(
      AppConfigs.users?.map((user) => {
        const existingUser = users.find((u) => u.id === user.id);
        if (existingUser) {
          existingUser.email = user.email;
          existingUser.password_hash = user.password;
          existingUser.totp_secret = user.totp_secret || null;
          existingUser.totp_backup_codes = user.totp_backup_codes || null;
          existingUser.editable = false;
          existingUser.email_verified = true;
          return existingUser;
        } else {
          const newUser = new UserEntity({
            email: user.email,
            password_hash: user.password,
          });
          newUser.id = user.id;
          newUser.totp_secret = user.totp_secret || null;
          newUser.totp_backup_codes = user.totp_backup_codes || null;
          newUser.editable = false;
          newUser.email_verified = true;
          return newUser;
        }
      }) || [],
    );

    await em.getRepository(OAuthClientEntity).upsertMany(
      staticOAuthClients.map((client) => {
        const existingClient = oauthClients.find((c) => c.id === client.id);
        if (existingClient) {
          existingClient.name = client.name;
          existingClient.clientId = client.client_id;
          existingClient.clientSecretHash = client.client_secret;
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
            clientSecretHash: client.client_secret,
          });
          newClient.redirectUris = client.redirect_uris;
          newClient.grantTypes = client.grant_types;
          newClient.responseTypes = client.response_types;
          newClient.scopes = client.scope.split(' ');
          newClient.editable = false;
          return newClient;
        }
      }),
    );

    await em.flush();
  },
  {
    name: 'bootstrap-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
