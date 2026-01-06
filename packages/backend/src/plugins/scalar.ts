import fastifyScalar from '@scalar/fastify-api-reference';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    fastify.register(fastifyScalar, {
      routePrefix: '/docs',
      configuration: {
        layout: 'modern',
        darkMode: true,
        persistAuth: true,
        sources: [{ url: '/docs/json', title: 'Main API' }],
        authentication: {
          preferredSecurityScheme: 'bearerAuth',
          securitySchemes: {
            // Swagger / OpenAPI 표준 Bearer 스킴
            // bearerAuth: {
            //   token: 'sdf'
            // },
          },
        },
      },
    });
  },
  {
    name: 'scalar-plugin',
    dependencies: ['swagger-plugin'],
  },
);
