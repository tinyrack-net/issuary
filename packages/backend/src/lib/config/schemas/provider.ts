import z from 'zod/v4';

export const AppConfigProvider = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  logo_uri: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(),
  redirect_uris: z.array(z.string()).min(1),
  response_types: z.array(z.string()).min(1),
  grant_types: z.array(z.string()).min(1),
  scope: z.string().min(1),
});

export type AppConfigProvider = z.infer<typeof AppConfigProvider>;
