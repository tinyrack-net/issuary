import fastifyPlugin from 'fastify-plugin';
import { seedConfig } from '@/seeders/config.seeder.js';

export default fastifyPlugin(
  async (fastify) => {
    // Sync config users and OAuth clients to database on server startup
    await seedConfig(fastify.mikro.em.fork(), fastify.config);

    if (!fastify.serverOptions.silent) {
      console.info(
        'Bootstrap plugin registered (users: %d, clients: %d)',
        fastify.config.users.length,
        fastify.config.clients.length,
      );
    }
  },
  {
    name: 'bootstrap-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
