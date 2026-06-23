import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { requireAdmin } from '../../../../middleware/auth.ts';
import { e } from '../../../../schemas/error.ts';
import { f } from '../../../../schemas/field.ts';
import { r } from '../../../../schemas/response.ts';

const QueryBoolean = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}, z.boolean());

const AdminUsersQuery = z.object({
  query: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  include_deleted: QueryBoolean.default(false),
  managed_by: z.enum(['database', 'config']).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

const AdminCreateUserBody = z.object({
  email: f.userEmail,
  password: f.userPassword,
  role: z.enum(['user', 'admin']).default('user'),
  email_verified: z.boolean().default(false),
});

const AdminUpdateUserBody = z
  .object({
    email: f.userEmail.optional(),
    role: z.enum(['user', 'admin']).optional(),
    email_verified: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

const adminUserResponses = {
  200: {
    content: {
      'application/json': { schema: resolver(r.AdminUserResponse) },
    },
    description: 'Success',
  },
  401: {
    content: {
      'application/json': { schema: resolver(e.Unauthorized.Schema) },
    },
    description: 'Unauthorized',
  },
  403: {
    content: {
      'application/json': {
        schema: resolver(
          z.union([e.Forbidden.Schema, e.UserNotEditable.Schema]),
        ),
      },
    },
    description: 'Forbidden or not editable',
  },
  404: {
    content: {
      'application/json': { schema: resolver(e.UserNotFound.Schema) },
    },
    description: 'User not found',
  },
  409: {
    content: {
      'application/json': { schema: resolver(e.EmailAlreadyExists.Schema) },
    },
    description: 'Email already exists',
  },
};

export const adminUsersRoutes = new Hono<AppEnv>()
  .get(
    '/admin/users',
    describeRoute({
      tags: [TAGS.ADMIN],
      security: OPENAPI_SECURITY.cookieSession,
      summary: 'List admin users',
      description: 'List users for the admin console.',
      responses: {
        200: {
          content: {
            'application/json': { schema: resolver(r.AdminUserListResponse) },
          },
          description: 'Success',
        },
      },
    }),
    requireAdmin(),
    validator('query', AdminUsersQuery),
    async (c) => {
      const query = c.req.valid('query');
      const result = await c.var.services.userService.listAdminUsers({
        query: query.query,
        page: query.page,
        pageSize: query.page_size,
        includeDeleted: query.include_deleted,
        managedBy: query.managed_by,
        role: query.role,
      });
      return c.json(result, 200);
    },
  )
  .post(
    '/admin/users',
    describeRoute({
      tags: [TAGS.ADMIN],
      security: OPENAPI_SECURITY.cookieSession,
      summary: 'Create admin-managed user',
      description: 'Create a database-managed user from the admin console.',
      responses: {
        201: {
          content: {
            'application/json': { schema: resolver(r.AdminUserResponse) },
          },
          description: 'Created',
        },
        ...adminUserResponses,
      },
    }),
    requireAdmin(),
    validator('json', AdminCreateUserBody),
    async (c) => {
      const body = c.req.valid('json');
      const user = await c.var.services.userService.createAdminUser({
        email: body.email,
        password: body.password,
        role: body.role,
        emailVerified: body.email_verified,
      });
      return c.json({ user }, 201);
    },
  )
  .get(
    '/admin/users/:sub',
    describeRoute({
      tags: [TAGS.ADMIN],
      security: OPENAPI_SECURITY.cookieSession,
      summary: 'Get admin user',
      description: 'Get a user for the admin console.',
      responses: adminUserResponses,
    }),
    requireAdmin(),
    async (c) => {
      const user = await c.var.services.userService.getAdminUser(
        c.req.param('sub'),
      );
      return c.json({ user }, 200);
    },
  )
  .patch(
    '/admin/users/:sub',
    describeRoute({
      tags: [TAGS.ADMIN],
      security: OPENAPI_SECURITY.cookieSession,
      summary: 'Update admin-managed user',
      description: 'Update a database-managed user from the admin console.',
      responses: adminUserResponses,
    }),
    requireAdmin(),
    validator('json', AdminUpdateUserBody),
    async (c) => {
      const body = c.req.valid('json');
      const user = await c.var.services.userService.updateAdminUser({
        sub: c.req.param('sub'),
        actorSub: c.var.verifiedUser.user.sub,
        email: body.email,
        role: body.role,
        emailVerified: body.email_verified,
      });
      return c.json({ user }, 200);
    },
  )
  .delete(
    '/admin/users/:sub',
    describeRoute({
      tags: [TAGS.ADMIN],
      security: OPENAPI_SECURITY.cookieSession,
      summary: 'Delete admin-managed user',
      description:
        'Soft-delete a database-managed user from the admin console.',
      responses: adminUserResponses,
    }),
    requireAdmin(),
    async (c) => {
      const user = await c.var.services.userService.deleteAdminUser({
        sub: c.req.param('sub'),
        actorSub: c.var.verifiedUser.user.sub,
      });
      return c.json({ user }, 200);
    },
  );
