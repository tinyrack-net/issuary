import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const SERVER_CONFIG_DEFAULT = {
  public_origin: 'http://localhost:8080',
  listen_port: 8080,
  trust_proxy: false,
} as const;

const TrustProxySchema = z
  .union([
    z.boolean(),
    z.string(),
    z.array(z.string()),
    z.number().int().min(0),
  ])
  .default(SERVER_CONFIG_DEFAULT.trust_proxy)
  .transform((value) => {
    if (typeof value === 'string') {
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      const num = Number(value);
      if (!Number.isNaN(num) && String(num) === value) {
        return num;
      }
    }
    return value;
  })
  .describe(
    'Trust proxy configuration for X-Forwarded-* headers. ' +
      'Can be true (trust all), false (trust none), ' +
      'IP/CIDR string, array of IPs, or number (nth hop)',
  );

export const ServerConfigSchema = z
  .object({
    public_origin: z
      .url()
      .default(SERVER_CONFIG_DEFAULT.public_origin)
      .describe(
        'Public origin for the auth service, used for redirects, emails, and CORS.',
      ),
    listen_port: zz.PORT.default(SERVER_CONFIG_DEFAULT.listen_port).describe(
      'TCP port to listen on.',
    ),
    trust_proxy: TrustProxySchema,
  })
  .strict()
  .default(SERVER_CONFIG_DEFAULT);

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
