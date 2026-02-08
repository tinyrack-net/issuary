import fastifyScalar from '@scalar/fastify-api-reference';
import fastifyPlugin from 'fastify-plugin';

export default fastifyPlugin(
  (fastify) => {
    if (!fastify.serverOptions.silent) {
      console.info('Scalar API docs plugin registered (route: /api/docs)');
    }

    fastify.register(fastifyScalar, {
      routePrefix: '/api/docs',
      configuration: {
        layout: 'modern',
        darkMode: true,
        persistAuth: true,
        defaultOpenAllTags: true,
        sources: [{ url: '/api/docs/json', title: 'Main API' }],
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
