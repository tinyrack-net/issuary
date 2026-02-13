import type { FastifyInstance } from 'fastify';
import bootstrapPlugin from './bootstrap.js';
import mikroOrmPlugin from './mikro-orm.js';
import nodemailerPlugin from './nodemailer.js';
import schedulerPlugin from './scheduler.js';
import zodPlugin from './zod.js';

export async function registerCorePlugins(
  fastify: FastifyInstance,
): Promise<void> {
  await fastify.register(zodPlugin);
  await fastify.register(mikroOrmPlugin);
  await fastify.register(nodemailerPlugin);
  await fastify.register(bootstrapPlugin);
  await fastify.register(schedulerPlugin);
}
