import fastifyPlugin from 'fastify-plugin';
import { ApiError, e } from '@/schemas/error.js';

export default fastifyPlugin(
  (fastify) => {
    fastify.setErrorHandler(async (error, _request, reply) => {
      console.log(error);
      if (error instanceof ApiError) {
        return reply.status(error.status).send(error.toJson());
      }

      if (error instanceof Error && 'code' in error) {
        switch (error.code) {
          case 'FST_ERR_VALIDATION':
            return reply
              .status(e.ValidationError.Status)
              .send(new e.ValidationError.Error(error.message).toJson());
        }
      }

      return reply
        .status(e.InternalServerError.Status)
        .send(new e.InternalServerError.Error().toJson());
    });
  },
  {
    name: 'api-error-handler-plugin',
    dependencies: [],
  },
);
