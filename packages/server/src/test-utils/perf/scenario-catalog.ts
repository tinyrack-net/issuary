export type PerfWorkloadKind = 'standard' | 'expensive';

export type PerfBudget = {
  minRps?: number | undefined;
  maxP95Ms?: number | undefined;
};

export type PerfScenarioDefinition = {
  id: string;
  name: string;
  source: string;
  expectedStatuses: readonly number[];
  workload: PerfWorkloadKind;
  budget: PerfBudget;
};

export type PerfWorkloadMinimums = {
  warmupRequests: number;
  requests: number;
};

function definePerfScenario(
  definition: PerfScenarioDefinition,
): PerfScenarioDefinition {
  return definition;
}

export const PERF_SCENARIO_CATALOG: readonly PerfScenarioDefinition[] = [
  definePerfScenario({
    id: 'post-oauth-revoke-access-token-smoke',
    name: 'POST /oauth/revoke access-token smoke',
    source: 'src/routes/oauth/revoke/revoke.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-oauth-revoke-refresh-token-smoke',
    name: 'POST /oauth/revoke refresh-token smoke',
    source: 'src/routes/oauth/revoke/revoke.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 2, maxP95Ms: 2500 },
  }),
  definePerfScenario({
    id: 'post-oauth-revoke-invalid-token-smoke',
    name: 'POST /oauth/revoke invalid token smoke',
    source: 'src/routes/oauth/revoke/revoke.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-well-known-openid-configuration-smoke',
    name: 'GET /.well-known/openid-configuration smoke',
    source:
      'src/routes/oauth/.well-known/openid-configuration/openid-configuration.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-oauth-well-known-openid-configuration-smoke',
    name: 'GET /oauth/.well-known/openid-configuration smoke',
    source:
      'src/routes/oauth/.well-known/openid-configuration/openid-configuration.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-well-known-openid-configuration-scaled-clients',
    name: 'GET /.well-known/openid-configuration scaled clients',
    source:
      'src/routes/oauth/.well-known/openid-configuration/openid-configuration.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 10, maxP95Ms: 500 },
  }),
  definePerfScenario({
    id: 'post-oauth-token-authorization-code-pkce-exchange-smoke',
    name: 'POST /oauth/token authorization-code PKCE exchange smoke',
    source: 'src/routes/oauth/token/token.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-oauth-token-client-credentials-smoke',
    name: 'POST /oauth/token client_credentials smoke',
    source: 'src/routes/oauth/token/token.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-oauth-token-refresh-token-rotation-smoke',
    name: 'POST /oauth/token refresh_token rotation smoke',
    source: 'src/routes/oauth/token/token.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 2, maxP95Ms: 2500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-accounts-select-smoke',
    name: 'POST /api/auth/accounts/select smoke',
    source: 'src/routes/api/auth/accounts/accounts-mutation.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-accounts-select-small-roster',
    name: 'POST /api/auth/accounts/select small roster',
    source: 'src/routes/api/auth/accounts/accounts-mutation.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: {},
  }),
  definePerfScenario({
    id: 'post-api-auth-accounts-select-large-roster',
    name: 'POST /api/auth/accounts/select large roster',
    source: 'src/routes/api/auth/accounts/accounts-mutation.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-accounts-select-not-remembered-smoke',
    name: 'POST /api/auth/accounts/select not-remembered smoke',
    source: 'src/routes/api/auth/accounts/accounts-mutation.perf.test.ts',
    expectedStatuses: [400],
    workload: 'expensive',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-accounts-remove-smoke',
    name: 'POST /api/auth/accounts/remove smoke',
    source: 'src/routes/api/auth/accounts/accounts-mutation.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-accounts-remove-active-account-smoke',
    name: 'POST /api/auth/accounts/remove active-account smoke',
    source: 'src/routes/api/auth/accounts/accounts-mutation.perf.test.ts',
    expectedStatuses: [400],
    workload: 'expensive',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-oauth-introspect-active-access-token-smoke',
    name: 'POST /oauth/introspect active access-token smoke',
    source: 'src/routes/oauth/introspect/introspect.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-oauth-introspect-active-refresh-token-smoke',
    name: 'POST /oauth/introspect active refresh-token smoke',
    source: 'src/routes/oauth/introspect/introspect.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-oauth-introspect-inactive-token-smoke',
    name: 'POST /oauth/introspect inactive token smoke',
    source: 'src/routes/oauth/introspect/introspect.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-login-config-user-smoke',
    name: 'POST /api/auth/login config-user smoke',
    source: 'src/routes/api/auth/login/login.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-login-database-user-pbkdf2-smoke',
    name: 'POST /api/auth/login database-user PBKDF2 smoke',
    source: 'src/routes/api/auth/login/login.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 5000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-logout-idempotent-smoke',
    name: 'POST /api/auth/logout idempotent smoke',
    source: 'src/routes/api/auth/login/login.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 10, maxP95Ms: 500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-logout-authenticated-sessions-smoke',
    name: 'POST /api/auth/logout authenticated sessions smoke',
    source: 'src/routes/api/auth/login/login.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-auth-accounts-authenticated-smoke',
    name: 'GET /api/auth/accounts authenticated smoke',
    source: 'src/routes/api/auth/accounts.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-auth-accounts-small-roster',
    name: 'GET /api/auth/accounts small roster',
    source: 'src/routes/api/auth/accounts.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: {},
  }),
  definePerfScenario({
    id: 'get-api-auth-accounts-large-roster',
    name: 'GET /api/auth/accounts large roster',
    source: 'src/routes/api/auth/accounts.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-api-auth-accounts-stale-roster-smoke',
    name: 'GET /api/auth/accounts stale roster smoke',
    source: 'src/routes/api/auth/accounts.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-register-smoke',
    name: 'POST /api/auth/register smoke',
    source: 'src/routes/api/auth/register/register-email.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-email-verify-smoke',
    name: 'POST /api/auth/email/verify smoke',
    source: 'src/routes/api/auth/register/register-email.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-email-resend-smoke',
    name: 'POST /api/auth/email/resend smoke',
    source: 'src/routes/api/auth/register/register-email.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-email-resend-token-backlog-smoke',
    name: 'POST /api/auth/email/resend token backlog smoke',
    source: 'src/routes/api/auth/register/register-email.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'get-api-admin-me-authenticated-smoke',
    name: 'GET /api/admin/me authenticated smoke',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 2, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-api-admin-users-authenticated-smoke',
    name: 'GET /api/admin/users authenticated smoke',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 2, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-api-admin-users-small-page',
    name: 'GET /api/admin/users small page',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: {},
  }),
  definePerfScenario({
    id: 'get-api-admin-users-larger-page',
    name: 'GET /api/admin/users larger page',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-admin-users-larger-table-filters',
    name: 'GET /api/admin/users larger table filters',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-admin-users-create-smoke',
    name: 'POST /api/admin/users create smoke',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [201],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-admin-users-sub-detail-smoke',
    name: 'GET /api/admin/users/:sub detail smoke',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 2, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'patch-api-admin-users-sub-update-smoke',
    name: 'PATCH /api/admin/users/:sub update smoke',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'delete-api-admin-users-sub-delete-smoke',
    name: 'DELETE /api/admin/users/:sub delete smoke',
    source: 'src/routes/api/admin/users/admin-users.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'post-api-user-password-smoke',
    name: 'POST /api/user/password smoke',
    source: 'src/routes/api/user/password/password.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'put-api-user-password-smoke',
    name: 'PUT /api/user/password smoke',
    source: 'src/routes/api/user/password/password.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'delete-api-user-password-smoke',
    name: 'DELETE /api/user/password smoke',
    source: 'src/routes/api/user/password/password.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-password-forgot-smoke',
    name: 'POST /api/auth/password/forgot smoke',
    source: 'src/routes/api/auth/password/password.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-password-forgot-token-backlog-smoke',
    name: 'POST /api/auth/password/forgot token backlog smoke',
    source: 'src/routes/api/auth/password/password.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 5000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-password-reset-smoke',
    name: 'POST /api/auth/password/reset smoke',
    source: 'src/routes/api/auth/password/password.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-password-reset-pbkdf2-concurrency-smoke',
    name: 'POST /api/auth/password/reset PBKDF2 concurrency smoke',
    source: 'src/routes/api/auth/password/password.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 10000 },
  }),
  definePerfScenario({
    id: 'get-api-user-oauth-accounts-smoke',
    name: 'GET /api/user/oauth-accounts smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-user-oauth-accounts-linked-smoke',
    name: 'GET /api/user/oauth-accounts linked smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-oauth-provider-authorize-smoke',
    name: 'GET /api/oauth/:provider/authorize smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [302],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-oauth-provider-callback-login-existing-user-success-smoke',
    name: 'GET /api/oauth/:provider/callback login existing-user success smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [302],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-oauth-provider-callback-link-success-smoke',
    name: 'GET /api/oauth/:provider/callback link success smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [302],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-oauth-provider-callback-invalid-request-smoke',
    name: 'GET /api/oauth/:provider/callback invalid request smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [400],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'post-api-oauth-provider-callback-apple-form-post-success-smoke',
    name: 'POST /api/oauth/:provider/callback Apple form_post success smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [302],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2500 },
  }),
  definePerfScenario({
    id: 'post-api-oauth-provider-callback-invalid-request-smoke',
    name: 'POST /api/oauth/:provider/callback invalid request smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [400],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'delete-api-oauth-provider-smoke',
    name: 'DELETE /api/oauth/:provider smoke',
    source: 'src/routes/api/oauth/oauth-provider.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-terms-public-smoke',
    name: 'GET /api/terms public smoke',
    source: 'src/routes/api/terms/terms.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-api-terms-consent-authenticated-smoke',
    name: 'POST /api/terms/consent authenticated smoke',
    source: 'src/routes/api/terms/terms.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-terms-authenticated-consent-history-smoke',
    name: 'GET /api/terms authenticated consent-history smoke',
    source: 'src/routes/api/terms/terms.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-api-terms-large-localized-text-smoke',
    name: 'GET /api/terms large localized text smoke',
    source: 'src/routes/api/terms/terms.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-user-totp-setup-smoke',
    name: 'POST /api/user/totp/setup smoke',
    source: 'src/routes/api/user/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'post-api-user-totp-setup-fresh-sessions-smoke',
    name: 'POST /api/user/totp/setup fresh sessions smoke',
    source: 'src/routes/api/user/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'post-api-user-totp-confirm-smoke',
    name: 'POST /api/user/totp/confirm smoke',
    source: 'src/routes/api/user/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-user-totp-verify-smoke',
    name: 'POST /api/user/totp/verify smoke',
    source: 'src/routes/api/user/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'post-api-user-totp-recovery-regenerate-smoke',
    name: 'POST /api/user/totp/recovery/regenerate smoke',
    source: 'src/routes/api/user/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'delete-api-user-totp-smoke',
    name: 'DELETE /api/user/totp smoke',
    source: 'src/routes/api/user/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'get-api-user-passkeys-smoke',
    name: 'GET /api/user/passkeys smoke',
    source: 'src/routes/api/user/passkeys/passkeys.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-user-passkeys-register-options-smoke',
    name: 'POST /api/user/passkeys/register/options smoke',
    source: 'src/routes/api/user/passkeys/passkeys.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-user-passkeys-register-verify-success-smoke',
    name: 'POST /api/user/passkeys/register/verify success smoke',
    source: 'src/routes/api/user/passkeys/passkeys.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-user-passkeys-register-verify-missing-challenge-smoke',
    name: 'POST /api/user/passkeys/register/verify missing-challenge smoke',
    source: 'src/routes/api/user/passkeys/passkeys.perf.test.ts',
    expectedStatuses: [400],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'patch-api-user-passkeys-id-smoke',
    name: 'PATCH /api/user/passkeys/:id smoke',
    source: 'src/routes/api/user/passkeys/passkeys.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'delete-api-user-passkeys-id-smoke',
    name: 'DELETE /api/user/passkeys/:id smoke',
    source: 'src/routes/api/user/passkeys/passkeys.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'get-oauth-device-invalid-user-code-smoke',
    name: 'GET /oauth/device invalid user-code smoke',
    source: 'src/routes/oauth/device/device.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-oauth-device-invalid-user-code-smoke',
    name: 'POST /oauth/device invalid user-code smoke',
    source: 'src/routes/oauth/device/device.perf.test.ts',
    expectedStatuses: [400],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-oauth-device-valid-user-code-smoke',
    name: 'GET /oauth/device valid user-code smoke',
    source: 'src/routes/oauth/device/device.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-oauth-device-valid-approval-smoke',
    name: 'POST /oauth/device valid approval smoke',
    source: 'src/routes/oauth/device/device.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-totp-verify-smoke',
    name: 'POST /api/auth/totp/verify smoke',
    source: 'src/routes/api/auth/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-totp-verify-invalid-code-smoke',
    name: 'POST /api/auth/totp/verify invalid-code smoke',
    source: 'src/routes/api/auth/totp/totp.perf.test.ts',
    expectedStatuses: [400],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-totp-recovery-verify-smoke',
    name: 'POST /api/auth/totp/recovery/verify smoke',
    source: 'src/routes/api/auth/totp/totp.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 4000 },
  }),
  definePerfScenario({
    id: 'post-oauth-device-authorization-valid-request-smoke',
    name: 'POST /oauth/device_authorization valid request smoke',
    source:
      'src/routes/oauth/device-authorization/device-authorization.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-oauth-userinfo-full-claims-smoke',
    name: 'GET /oauth/userinfo full claims smoke',
    source: 'src/routes/oauth/userinfo/userinfo.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-oauth-userinfo-openid-only-claims',
    name: 'GET /oauth/userinfo openid-only claims',
    source: 'src/routes/oauth/userinfo/userinfo.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: {},
  }),
  definePerfScenario({
    id: 'get-oauth-userinfo-full-claims-scaling',
    name: 'GET /oauth/userinfo full claims scaling',
    source: 'src/routes/oauth/userinfo/userinfo.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-oauth-userinfo-missing-bearer-smoke',
    name: 'GET /oauth/userinfo missing bearer smoke',
    source: 'src/routes/oauth/userinfo/userinfo.perf.test.ts',
    expectedStatuses: [401],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-oauth-userinfo-full-claims-smoke',
    name: 'POST /oauth/userinfo full claims smoke',
    source: 'src/routes/oauth/userinfo/userinfo.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'delete-api-user-authenticated-delete-smoke',
    name: 'DELETE /api/user authenticated delete smoke',
    source: 'src/routes/api/user/delete.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 2000 },
  }),
  definePerfScenario({
    id: 'get-oauth-authorize-authorization-code-redirect-smoke',
    name: 'GET /oauth/authorize authorization-code redirect smoke',
    source: 'src/routes/oauth/authorize/authorize.perf.test.ts',
    expectedStatuses: [302],
    workload: 'standard',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-oauth-authorize-login-redirect-smoke',
    name: 'GET /oauth/authorize login redirect smoke',
    source: 'src/routes/oauth/authorize/authorize.perf.test.ts',
    expectedStatuses: [302],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-oauth-authorize-consent-redirect-smoke',
    name: 'GET /oauth/authorize consent redirect smoke',
    source: 'src/routes/oauth/authorize/authorize.perf.test.ts',
    expectedStatuses: [302],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'post-api-auth-passkey-options-smoke',
    name: 'POST /api/auth/passkey/options smoke',
    source: 'src/routes/api/auth/passkey/passkey.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-passkey-verify-success-smoke',
    name: 'POST /api/auth/passkey/verify success smoke',
    source: 'src/routes/api/auth/passkey/passkey.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'post-api-auth-passkey-verify-missing-challenge-smoke',
    name: 'POST /api/auth/passkey/verify missing-challenge smoke',
    source: 'src/routes/api/auth/passkey/passkey.perf.test.ts',
    expectedStatuses: [400],
    workload: 'expensive',
    budget: { minRps: 1, maxP95Ms: 3000 },
  }),
  definePerfScenario({
    id: 'get-api-user-session-smoke',
    name: 'GET /api/user/session smoke',
    source: 'src/routes/api/user/session/session.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 10, maxP95Ms: 500 },
  }),
  definePerfScenario({
    id: 'get-api-user-session-authenticated-smoke',
    name: 'GET /api/user/session authenticated smoke',
    source: 'src/routes/api/user/session/session.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-user-session-database-2fa-user-smoke',
    name: 'GET /api/user/session database 2FA user smoke',
    source: 'src/routes/api/user/session/session.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-api-consent-authenticated-smoke',
    name: 'GET /api/consent authenticated smoke',
    source: 'src/routes/api/consent/consent.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'post-api-consent-allow-smoke',
    name: 'POST /api/consent allow smoke',
    source: 'src/routes/api/consent/consent.perf.test.ts',
    expectedStatuses: [200],
    workload: 'expensive',
    budget: { minRps: 3, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-api-docs-smoke',
    name: 'GET /api/docs smoke',
    source: 'src/routes/api/docs/docs.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-docs-json-smoke',
    name: 'GET /api/docs/json smoke',
    source: 'src/routes/api/docs/docs.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 10, maxP95Ms: 500 },
  }),
  definePerfScenario({
    id: 'get-oauth-well-known-jwks-smoke',
    name: 'GET /oauth/.well-known/jwks smoke',
    source: 'src/routes/oauth/.well-known/jwks/jwks.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-oauth-well-known-jwks-rotated-keys-smoke',
    name: 'GET /oauth/.well-known/jwks rotated keys smoke',
    source: 'src/routes/oauth/.well-known/jwks/jwks.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1500 },
  }),
  definePerfScenario({
    id: 'get-oauth-end-session-default-redirect-smoke',
    name: 'GET /oauth/end_session default redirect smoke',
    source: 'src/routes/oauth/end-session/end-session.perf.test.ts',
    expectedStatuses: [302],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-oauth-end-session-post-logout-redirect-smoke',
    name: 'GET /oauth/end_session post-logout redirect smoke',
    source: 'src/routes/oauth/end-session/end-session.perf.test.ts',
    expectedStatuses: [302],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-config-public-smoke',
    name: 'GET /api/config public smoke',
    source: 'src/routes/api/config/config.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-config-provider-scale-smoke',
    name: 'GET /api/config provider scale smoke',
    source: 'src/routes/api/config/config.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 10, maxP95Ms: 500 },
  }),
  definePerfScenario({
    id: 'get-api-health-smoke',
    name: 'GET /api/health smoke',
    source: 'src/routes/api/health/health.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-health-live-smoke',
    name: 'GET /api/health/live smoke',
    source: 'src/routes/api/health/health.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
  definePerfScenario({
    id: 'get-api-health-ready-smoke',
    name: 'GET /api/health/ready smoke',
    source: 'src/routes/api/health/health.perf.test.ts',
    expectedStatuses: [200],
    workload: 'standard',
    budget: { minRps: 5, maxP95Ms: 1000 },
  }),
];

export const PERF_EXPECTED_SCENARIO_COUNT = 107;

if (PERF_SCENARIO_CATALOG.length !== PERF_EXPECTED_SCENARIO_COUNT) {
  throw new Error(
    `Expected ${String(PERF_EXPECTED_SCENARIO_COUNT)} performance scenarios, received ${String(PERF_SCENARIO_CATALOG.length)}`,
  );
}

const scenariosByName = new Map<string, PerfScenarioDefinition>();
const scenariosById = new Map<string, PerfScenarioDefinition>();

for (const scenario of PERF_SCENARIO_CATALOG) {
  if (scenariosByName.has(scenario.name)) {
    throw new Error(`Duplicate performance scenario name: ${scenario.name}`);
  }

  if (scenariosById.has(scenario.id)) {
    throw new Error(`Duplicate performance scenario id: ${scenario.id}`);
  }

  scenariosByName.set(scenario.name, scenario);
  scenariosById.set(scenario.id, scenario);
}

export function getPerfScenarioByName(name: string): PerfScenarioDefinition {
  const scenario = scenariosByName.get(name);

  if (!scenario) {
    throw new Error(`Unknown performance scenario: ${name}`);
  }

  return scenario;
}

export function getPerfScenarioById(id: string): PerfScenarioDefinition {
  const scenario = scenariosById.get(id);

  if (!scenario) {
    throw new Error(`Unknown performance scenario id: ${id}`);
  }

  return scenario;
}

export function perfWorkloadMinimums(
  workload: PerfWorkloadKind,
): PerfWorkloadMinimums {
  if (workload === 'expensive') {
    return { warmupRequests: 4, requests: 20 };
  }

  return { warmupRequests: 10, requests: 50 };
}
