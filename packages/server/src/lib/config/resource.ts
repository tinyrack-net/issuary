import z from 'zod';

const RESOURCE_INDICATOR_MAX_LENGTH = 2048;
const URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
// RFC 3986 URI characters (unreserved, reserved and percent-encoding).
const URI_CHARACTERS_PATTERN = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;

/**
 * Whether a value is a syntactically valid RFC 8707 resource indicator:
 * an absolute URI (RFC 3986 §4.3) without a fragment component.
 *
 * Values are compared exactly (no normalization), so a request must use the
 * identifier string exactly as configured.
 */
export function isValidResourceIndicator(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > RESOURCE_INDICATOR_MAX_LENGTH ||
    !URI_SCHEME_PATTERN.test(value) ||
    !URI_CHARACTERS_PATTERN.test(value) ||
    value.includes('#')
  ) {
    return false;
  }
  return URL.canParse(value);
}

export const ResourceIdentifierSchema = z
  .string()
  .refine(isValidResourceIndicator, {
    message:
      'Resource identifier must be an absolute URI without a fragment (RFC 8707 §2).',
  });

const AudienceSchema = z
  .string()
  .min(1)
  .max(RESOURCE_INDICATOR_MAX_LENGTH)
  .refine((value) => value.trim() === value && !/[\s]/.test(value), {
    message: 'Audience values must not contain whitespace.',
  });

/**
 * Protected resource (resource server) definition for RFC 8707 resource
 * indicators.
 */
export const ResourceConfigSchema = z
  .object({
    identifier: ResourceIdentifierSchema.describe(
      'RFC 8707 resource indicator value accepted in the `resource` request parameter. Must be an absolute URI without a fragment; matched exactly.',
    ),
    audiences: z
      .array(AudienceSchema)
      .nonempty()
      .optional()
      .describe(
        'Access token `aud` values issued for this resource. Defaults to `[identifier]`.',
      ),
  })
  .strict()
  .describe('Protected resource (resource server) definition.');

export type ResourceConfig = z.infer<typeof ResourceConfigSchema>;

export const RESOURCE_CONFIGS_DEFAULT: ResourceConfig[] = [];

export const ResourceConfigsSchema = z
  .array(ResourceConfigSchema)
  .superRefine((resources, ctx) => {
    const seen = new Map<string, number>();
    resources.forEach((resource, index) => {
      const first = seen.get(resource.identifier);
      if (first !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'identifier'],
          message: `Resource identifier must be unique. Duplicate value also appears at resources.${first}.identifier.`,
        });
      } else {
        seen.set(resource.identifier, index);
      }
    });
  })
  .default(RESOURCE_CONFIGS_DEFAULT)
  .describe('Protected resources that clients may request with RFC 8707.');

/**
 * Cross-field validation: every resource referenced by a client must be
 * defined in the top-level `resources` list.
 */
export function validateClientResourceReferences(
  config: {
    resources: ReadonlyArray<{ identifier: string }>;
    clients: ReadonlyArray<{ resources?: readonly string[] | undefined }>;
  },
  ctx: z.RefinementCtx,
): void {
  const defined = new Set(
    config.resources.map((resource) => resource.identifier),
  );
  config.clients.forEach((client, clientIndex) => {
    (client.resources ?? []).forEach((identifier, resourceIndex) => {
      if (!defined.has(identifier)) {
        ctx.addIssue({
          code: 'custom',
          path: ['clients', clientIndex, 'resources', resourceIndex],
          message: `Client resource "${identifier}" is not defined in the top-level resources list.`,
        });
      }
    });
  });
}
