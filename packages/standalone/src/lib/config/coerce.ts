import z from 'zod';

export const StandaloneBooleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }

    return value;
  });

export const StandalonePortSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'string') {
      return Number(value);
    }

    return value;
  })
  .pipe(z.number().int().min(1).max(65535));
