import z from 'zod/v4';

export const h = {
  BearerAuth: z.object({
    authorization: z
      .string()
      .min(1)
      .optional()
      .describe('Bearer token: "Bearer <access_token>"'),
  }),
};
