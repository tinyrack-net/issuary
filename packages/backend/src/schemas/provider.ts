import z from 'zod/v4';

/**
 * Coerce a string or boolean value to boolean.
 * Handles "true"/"1" as true, everything else as false.
 * Passes native booleans through unchanged.
 */
const CoerceBoolean = z.union([z.boolean(), z.string()]).transform((val) => {
  if (typeof val === 'string') {
    return val === 'true' || val === '1';
  }
  return val;
});

/**
 * Create a coerced integer schema that accepts both string and number.
 * Useful for config fields that may come from env var interpolation.
 */
const coerceInt = () =>
  z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === 'string' ? Number(val) : val));

export const zz = {
  PORT: z
    .string()
    .or(z.number())
    .transform((val) => (typeof val === 'string' ? Number(val) : val))
    .refine((val) => val > 0 && val < 65536, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),
  COERCE_BOOLEAN: CoerceBoolean,
  coerceInt,
};
