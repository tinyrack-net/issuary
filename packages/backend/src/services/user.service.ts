import fastifyPlugin from 'fastify-plugin';
import { AppConfigs } from '@/lib/config.js';
import type { MikroService } from '@/plugins/mikro-orm.js';

declare module 'fastify' {
  interface FastifyInstance {
    userService: UserService;
  }
}

export class UserService {
  public constructor(private readonly mikro: MikroService) {}

  /**
   * @description
   * Logs in a user with the provided email and password.
   */
  public async login(params: { email: string; password: string }) {
    const appConfigUser = AppConfigs.users?.find(
      (u) => u.email === params.email,
    );

    if (appConfigUser) {
      if (appConfigUser.password === params.password) {
        return appConfigUser;
      } else {
        throw new Error('Invalid combination of email and password');
      }
    }

    const user = await this.mikro.user.findOneOrFail(
      {
        email: params.email,
      },
      {
        populate: ['password_hash'],
        failHandler: () =>
          new Error('Invalid combination of email and password'),
      },
    );

    if (await user.verifyPassword(params.password)) {
      return user;
    }

    throw new Error('Invalid combination of email and password');
  }

  public async register(params: { email: string; password: string }) {
    const appConfigUser = AppConfigs.users?.find(
      (u) => u.email === params.email,
    );
    if (appConfigUser) {
      throw new Error('Email already exists');
    }

    const emailExists = await this.exists(params.email);
    if (emailExists) {
      throw new Error('Email already exists');
    }

    const user = this.mikro.user.create({
      email: params.email,
      password_hash: params.password,
    });

    await this.mikro.em.persist(user).flush();
    return {
      id: user.id,
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
  },
  {
    name: 'user-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);
