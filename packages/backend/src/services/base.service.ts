import fastifyPlugin from 'fastify-plugin';
// import { ConfigSeeder } from '@/seeders/config-seeder.js';

export default fastifyPlugin(
  async (_fastify) => {
    // await fastify.mikro.orm.seeder.seed(ConfigSeeder);
  },
  {
    name: 'base-service-plugin',
  },
);
