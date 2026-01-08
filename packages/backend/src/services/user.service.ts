import fastifyPlugin from 'fastify-plugin';
import type { FastifyWithZodInstance } from '@/server.js';

declare module 'fastify' {
  interface FastifyInstance {
    userService: UserService;
  }
}

class UserService {
  public constructor(private readonly fastify: FastifyWithZodInstance) { }

  async login(params: { email: string; password: string }) {
    const err = new Error('Invalid combination of email and password');
    const user = await this.fastify.mikro.user.findOneOrFail(
      {
        email: params.email,
      },
      {
        populate: ['password_hash'],
        failHandler: () => err,
      },
    );

    if (await user.verifyPassword(params.password)) {
      return user;
    }
    throw err;
  }

  async exists(email: string) {
    const count = await this.fastify.mikro.user.count({ email: email });
    return count > 0;
  }

  async register(params: { email: string; password: string }) {
    const emailExists = await this.exists(params.email);
    if (emailExists) {
      throw new Error('Email already exists');
    }

    const user = this.fastify.mikro.user.create({
      email: params.email,
      password_hash: params.password,
    });

    await this.fastify.mikro.user.getEntityManager().persist(user).flush();
    return user;
  }

}

export default fastifyPlugin(
  async (fastify) => {
    const userService = new UserService(fastify);
    fastify.decorate('userService', userService);
  },
  {
    name: 'user-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);
