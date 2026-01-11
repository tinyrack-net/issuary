import type { FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ApiError, e } from '@/schemas/error.js';

/**
 * Helper to send error response without schema serialization
 * This bypasses the response schema validation to avoid serialization errors
 */
const sendError = (reply: FastifyReply, status: number, body: object) => {
  return reply
    .code(status)
    .serializer((data: unknown) => JSON.stringify(data))
    .send(body);
};

export default fastifyPlugin(
  (fastify) => {
    fastify.setErrorHandler(async (error, _request, reply) => {
      // Handle custom ApiError instances
      if (error instanceof ApiError) {
        return sendError(reply, error.status, error.toJson());
      }

      // Handle Fastify validation errors (FST_ERR_VALIDATION)
      if (error instanceof Error && 'code' in error) {
        switch (error.code) {
          case 'FST_ERR_VALIDATION':
            return sendError(
              reply,
              e.ValidationError.Status,
              new e.ValidationError.Error(error.message).toJson(),
            );
        }
      }

      // Default to internal server error
      return sendError(
        reply,
        e.InternalServerError.Status,
        new e.InternalServerError.Error().toJson(),
      );
    });
  },
  {
    name: 'api-error-handler-plugin',
    dependencies: [],
  },
);
