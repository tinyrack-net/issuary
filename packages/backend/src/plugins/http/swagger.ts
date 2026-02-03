import fastifySwagger from '@fastify/swagger';
import fastifyPlugin from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

export default fastifyPlugin(
  async (fastify) => {
    await fastify.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'Tinyauth API',
          description:
            'OpenID Connect (OIDC) Provider API for OAuth2 authentication and authorization',
          version: '1.0.0',
        },
        servers: [],
        components: {
          securitySchemes: {
            // Swagger / OpenAPI 표준 Bearer 스킴
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT', // 선택
            },
          },
        },
      },
      transform: jsonSchemaTransform,
    });

    // OpenAPI JSON 스키마 제공 라우트
    fastify.get('/api/docs/json', {
      schema: {
        hide: true,
      },
      handler: () => {
        return fastify.swagger();
      },
    });
  },
  {
    name: 'swagger-plugin',
    dependencies: ['zod-plugin'],
  },
);
