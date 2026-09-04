export type ScreenScenarioGroup =
  | 'public'
  | 'account'
  | 'security'
  | 'oauth'
  | 'admin';

export type ScreenScenarioLocale = 'en' | 'ko' | 'ja';
export type ScreenScenarioColorScheme = 'light' | 'dark';
export type ScreenScenarioViewport = 'desktop' | 'mobile';

export type ScreenScenarioVariant = {
  id: string;
  locale: ScreenScenarioLocale;
  colorScheme: ScreenScenarioColorScheme;
  viewport: ScreenScenarioViewport;
};

type ScreenScenarioBase = {
  id: string;
  title: string;
  description: string;
  group: ScreenScenarioGroup;
  entryPath: string;
  readySelector: string;
  variants: readonly ScreenScenarioVariant[];
  maskSelectors?: readonly string[];
};

export type RouteScreenScenarioDefinition = ScreenScenarioBase & {
  runtime: 'route';
  expectedText: string;
};

export type ServerScreenScenarioDefinition = ScreenScenarioBase & {
  runtime: 'server';
};

export type ScreenScenarioDefinition =
  | RouteScreenScenarioDefinition
  | ServerScreenScenarioDefinition;

const DESKTOP_VARIANT: ScreenScenarioVariant = {
  id: 'desktop',
  locale: 'en',
  colorScheme: 'light',
  viewport: 'desktop',
};

const MOBILE_VARIANT: ScreenScenarioVariant = {
  id: 'mobile',
  locale: 'en',
  colorScheme: 'light',
  viewport: 'mobile',
};

function createVariants(
  mobile: boolean,
  additional: readonly ScreenScenarioVariant[] = [],
): readonly ScreenScenarioVariant[] {
  return [DESKTOP_VARIANT, ...(mobile ? [MOBILE_VARIANT] : []), ...additional];
}

function defineScreenScenarios<
  const T extends readonly ScreenScenarioDefinition[],
>(scenarios: T): T {
  return scenarios;
}

export const screenScenarioDefinitions = defineScreenScenarios([
  {
    id: 'login',
    title: 'Password login',
    description: 'Password-based login form.',
    group: 'public',
    runtime: 'route',
    entryPath: '/login/password',
    readySelector: 'input[name="email"]',
    expectedText: 'Log in',
    variants: createVariants(true, [
      {
        id: 'ko-light',
        locale: 'ko',
        colorScheme: 'light',
        viewport: 'desktop',
      },
      {
        id: 'ja-light',
        locale: 'ja',
        colorScheme: 'light',
        viewport: 'desktop',
      },
      {
        id: 'en-dark',
        locale: 'en',
        colorScheme: 'dark',
        viewport: 'desktop',
      },
    ]),
  },
  {
    id: 'register',
    title: 'Registration',
    description: 'Public password registration form.',
    group: 'public',
    runtime: 'route',
    entryPath: '/register',
    readySelector: 'input[name="email"]',
    expectedText: 'Create account',
    variants: createVariants(true),
  },
  {
    id: 'email-verification',
    title: 'Email verification',
    description: 'Pending email-verification token entry.',
    group: 'security',
    runtime: 'route',
    entryPath: '/verify/email?email=screen-lab-unverified%40example.com',
    readySelector: 'input[name="token"]',
    expectedText: 'Email Verification',
    variants: createVariants(true),
  },
  {
    id: 'password-reset',
    title: 'Password reset',
    description: 'Password reset form with a token supplied by URL.',
    group: 'security',
    runtime: 'route',
    entryPath: '/password/reset?token=screen-lab-reset-token',
    readySelector: 'input[name="password"]',
    expectedText: 'Reset Password',
    variants: createVariants(true),
  },
  {
    id: 'profile',
    title: 'Profile',
    description: 'Authenticated account and security overview.',
    group: 'account',
    runtime: 'server',
    entryPath: '/profile',
    readySelector: 'main',
    variants: createVariants(true),
  },
  {
    id: 'admin-overview',
    title: 'Admin overview',
    description: 'Current administrative status.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin',
    readySelector: 'main',
    variants: createVariants(true),
  },
  {
    id: 'admin-users',
    title: 'Admin users',
    description: 'Responsive administrative user table.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin/users',
    readySelector: 'table[aria-label="Users"]',
    variants: createVariants(true),
  },
  {
    id: 'admin-account-menu',
    title: 'Admin account menu',
    description: 'Header avatar account details and logout menu.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin/users',
    readySelector: '[role="menu"]',
    variants: createVariants(true),
  },
  {
    id: 'admin-users-selected',
    title: 'Admin user selection',
    description: 'Current-page selection and floating bulk actions.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin/users',
    readySelector: '[data-testid="admin-bulk-bar"]',
    variants: createVariants(true),
  },
  {
    id: 'admin-clients',
    title: 'Admin OAuth clients',
    description: 'Responsive OAuth client table.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin/clients',
    readySelector: '[data-layout="table"]',
    variants: createVariants(true),
  },
  {
    id: 'admin-terms',
    title: 'Admin terms',
    description: 'Responsive terms table.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin/terms',
    readySelector: '[data-layout="table"]',
    variants: createVariants(true),
  },
  {
    id: 'admin-system',
    title: 'Admin system policies',
    description: 'Read-only system policy tables.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin/system',
    readySelector: 'main',
    variants: createVariants(true),
  },
  {
    id: 'admin-settings',
    title: 'Admin settings',
    description: 'Language and theme preferences.',
    group: 'admin',
    runtime: 'server',
    entryPath: '/admin/settings',
    readySelector: 'main',
    variants: createVariants(true),
  },
  {
    id: 'oauth-consent',
    title: 'OAuth consent',
    description: 'Consent prompt for a configured OIDC client.',
    group: 'oauth',
    runtime: 'server',
    entryPath: '/oauth/authorize',
    readySelector: '[data-testid="consent-allow"]',
    variants: createVariants(true),
  },
  {
    id: 'account-selection',
    title: 'Account selection',
    description: 'Remembered-account chooser for an OIDC authorization.',
    group: 'oauth',
    runtime: 'server',
    entryPath: '/oauth/authorize',
    readySelector: '[data-testid="account-list"]',
    variants: createVariants(true, [
      {
        id: 'en-dark',
        locale: 'en',
        colorScheme: 'dark',
        viewport: 'desktop',
      },
    ]),
  },
  {
    id: 'totp-verification',
    title: 'TOTP verification',
    description: 'Second-factor challenge for a user with TOTP enabled.',
    group: 'security',
    runtime: 'server',
    entryPath: '/verify/totp',
    readySelector: 'input[inputMode="numeric"]',
    variants: createVariants(true),
  },
  {
    id: 'totp-setup',
    title: 'TOTP setup',
    description: 'Required TOTP enrollment at the QR-code step.',
    group: 'security',
    runtime: 'server',
    entryPath: '/setup/totp',
    readySelector: 'img[alt="TOTP QR Code"]',
    variants: createVariants(true),
    maskSelectors: ['img[alt="TOTP QR Code"]'],
  },
  {
    id: 'passkey-setup',
    title: 'Passkey setup',
    description: 'Required passkey enrollment screen.',
    group: 'security',
    runtime: 'server',
    entryPath: '/setup/passkey',
    readySelector: '#passkey-name',
    variants: createVariants(true),
  },
  {
    id: 'error',
    title: 'Error',
    description: 'Public protocol error presentation.',
    group: 'public',
    runtime: 'route',
    entryPath: '/error?code=SCREEN_LAB&message=Screen+Lab+example+error',
    readySelector: '[data-testid="error-code"]',
    expectedText: 'Screen Lab example error',
    variants: createVariants(true),
  },
]);

export type ScreenScenarioId = (typeof screenScenarioDefinitions)[number]['id'];

export type ServerScreenScenarioId = Extract<
  (typeof screenScenarioDefinitions)[number],
  { runtime: 'server' }
>['id'];

export function findScreenScenarioDefinition(
  id: string,
): (typeof screenScenarioDefinitions)[number] | undefined {
  return screenScenarioDefinitions.find((scenario) => scenario.id === id);
}

export function findScreenScenarioVariant(
  scenario: ScreenScenarioDefinition,
  variantId: string | undefined,
): ScreenScenarioVariant | undefined {
  const resolvedId = variantId ?? 'desktop';
  return scenario.variants.find((variant) => variant.id === resolvedId);
}
