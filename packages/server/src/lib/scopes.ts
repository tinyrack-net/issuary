/**
 * OIDC/OAuth2 scope definitions with descriptions
 *
 * These are used for consent page display and scope validation.
 */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Access your unique user identifier',
  profile: 'Access your profile information (name, picture, etc.)',
  email: 'Access your email address',
  address: 'Access your address information',
  phone: 'Access your phone number',
  offline_access: 'Maintain access when you are not present',
};

/**
 * Get description for a scope
 * @param scopeName - The scope name
 * @returns Description string, or a generic fallback
 */
const getScopeDescription = (scopeName: string): string => {
  return SCOPE_DESCRIPTIONS[scopeName] || `Access to ${scopeName} data`;
};

/**
 * Parse scope string into structured scope objects
 * @param scopeString - Space-delimited scope string
 * @returns Array of scope objects with name and description
 */
export const parseScopesWithDescriptions = (
  scopeString?: string,
): Array<{ name: string; description: string }> => {
  if (!scopeString) return [];

  return scopeString
    .split(' ')
    .filter((name) => name.length > 0)
    .map((name) => ({
      name,
      description: getScopeDescription(name),
    }));
};
