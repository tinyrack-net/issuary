import fastifyPlugin from 'fastify-plugin';
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
        }
      }
    });

    await userRepository.upsertMany(
      AppConfigs.users?.map((user) => {
        const existingUser = users.find((u) => u.id === user.id);
        if (existingUser) {
          existingUser.email = user.email;
          existingUser.password_hash = user.password;
          existingUser.totp_secret = user.totp_secret || null;
          existingUser.totp_backup_codes = user.totp_backup_codes || null;
          existingUser.ediable = false;
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
          newUser.ediable = false;
          newUser.email_verified = true;
          return newUser;
        }
      }) || []
    );

    await em.flush();
  },
  {
    name: 'bootstrap-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
