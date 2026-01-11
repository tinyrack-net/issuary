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
    fastify.setErrorHandler(async (error, request, reply) => {
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
          case 'FST_ERR_CTP_EMPTY_JSON_BODY':
            // Empty JSON body - treat as validation error
            return sendError(
              reply,
              e.ValidationError.Status,
              new e.ValidationError.Error(
                'Request body cannot be empty when Content-Type is application/json',
              ).toJson(),
            );
        }
      }

      // Log unexpected errors for debugging
      request.log.error(
        { err: error, stack: error.stack },
        'Unexpected error occurred',
      );

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
