import z from 'zod/v4';

export const zz = {
  PORT: z
    .string()
    .or(z.number())
    .transform((val) => (typeof val === 'string' ? Number(val) : val))
    .refine((val) => val > 0 && val < 65536, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),
};
