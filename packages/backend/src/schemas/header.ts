import { z } from 'zod';

export const h = {
  BearerAuth: z.object({
    authorization: z
      .string()
      .min(1)
      .optional()
      .describe('Bearer token: "Bearer <access_token>"'),
  }),
};
