import fastifyPlugin from 'fastify-plugin';
import { ConfigSeeder } from '@/seeders/config.seeder.js';

export default fastifyPlugin(
  async (fastify) => {
    // Sync config users and OAuth clients to database on server startup
    await fastify.mikro.orm.seeder.seed(ConfigSeeder);
  },
  {
    name: 'bootstrap-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
