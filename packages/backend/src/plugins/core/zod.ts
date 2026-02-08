import fastifyPlugin from 'fastify-plugin';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

export default fastifyPlugin(
  (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    if (!fastify.serverOptions.silent) {
      console.info('Zod plugin registered');
    }
  },
  {
    name: 'zod-plugin',
    dependencies: [],
  },
);
