import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import type { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';
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
   */
  public async verifyUserById(
    id: string,
  ): Promise<z.infer<typeof r.UserSession>> {
    const appConfigUser = AppConfigs.users?.find((u) => u.id === id);
    if (appConfigUser) {
      return {
        id: appConfigUser.id,
        managed: 'config',
        email: appConfigUser.email,
        email_verified: true,
      };
    }
    const dbUser = await this.mikro.user.findOneOrFail({ id: id });
    return {
      id: dbUser.id,
      managed: 'database',
      email: dbUser.email,
      email_verified: dbUser.email_verified,
    };
  }

  /**
   * @description
   * Logs in a user with the provided email and password.
   */
  public async login(params: {
    email: string;
    password: string;
  }): Promise<z.infer<typeof r.UserSession>> {
    const appConfigUser = AppConfigs.users?.find(
      (u) => u.email === params.email,
    );

    if (appConfigUser) {
      if (appConfigUser.password === params.password) {
        return {
          id: appConfigUser.id,
          managed: 'config',
          email: appConfigUser.email,
          email_verified: true,
        };
      } else {
        throw new e.InvalidEmailOrPassword.Error();
      }
    }

    const user = await this.mikro.user.findOneOrFail(
      {
        email: params.email,
      },
      {
        populate: ['password_hash'],
        failHandler: () => new e.InvalidEmailOrPassword.Error(),
      },
    );

    if (await user.verifyPassword(params.password)) {
      return {
        id: user.id,
        managed: 'database',
        email: user.email,
        email_verified: user.email_verified,
      };
    }

    throw new e.InvalidEmailOrPassword.Error();
  }

  public async register(params: { email: string; password: string }): Promise<{
    user: UserEntity;
  }> {
    const appConfigUser = AppConfigs.users?.find(
      (u) => u.email === params.email,
    );
    if (appConfigUser) {
      throw new e.EmailAlreadyExists.Error();
    }

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
    dependencies: ['base-service-plugin'],
  },
);
