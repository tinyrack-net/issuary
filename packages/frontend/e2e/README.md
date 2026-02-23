# Frontend E2E Config Coverage Matrix

This document maps backend `/api/config` behavior to frontend E2E coverage.

## Coverage Status

| Config / flow area | Status | Notes | Primary E2E coverage |
| --- | --- | --- | --- |
| `app.allowed_signup_emails` and signup gating | Covered | Allows and blocks registration by pattern | `tests/registration-disabled/register-disabled.test.ts`, `tests/minimal/register.test.ts`, `tests/terms/register-terms.test.ts`, `tests/oauth-providers-mixed/oauth-providers-mixed.test.ts` |
| `auth.password.enabled` | Covered | Password login paths enabled/disabled | `tests/minimal/login.test.ts`, `tests/password-disabled/password-disabled.test.ts` |
| `smtp.enabled` | Covered | Forgot-password link and reset flow | `tests/minimal/login.test.ts`, `tests/email-verification/forgot-password.test.ts`, `tests/email-verification/reset-password.test.ts` |
| `auth.password.email_verification` | Covered | Registration/login verification routing | `tests/email-verification/register-email-verify.test.ts`, `tests/email-verification/login-email-verify.test.ts`, `tests/email-verification-2fa-required/email-verify-2fa.test.ts` |
| `auth.password.second_factor.required` | Covered | Required setup and verification routing | `tests/totp-required/*.test.ts`, `tests/passkey-required/passkey-flow.test.ts`, `tests/dual-2fa/choose-2fa.test.ts`, `tests/email-verification-2fa-required/email-verify-2fa.test.ts` |
| `auth.password.totp.enabled` | Covered | TOTP-only and mixed second-factor flows | `tests/totp-required/*.test.ts`, `tests/totp-optional/*.test.ts`, `tests/dual-2fa/choose-2fa.test.ts` |
| `auth.passkey.enabled` | Covered | Passkey-only and mixed second-factor flows | `tests/passkey-required/passkey-flow.test.ts`, `tests/passkey-optional/*.test.ts`, `tests/dual-2fa/choose-2fa.test.ts` |
| OAuth/OIDC continuity (`client_id`, `redirect_uri`, `state`, PKCE params) | Covered | OAuth params preserved through login/register/verify/setup/consent | `tests/journey-oauth-2fa/journey-oauth-2fa.test.ts`, `tests/minimal/oauth-client-auth-flow.test.ts`, `tests/terms/oauth-client-auth-flow.test.ts` |
| OAuth provider callback success/error mapping | Covered | Query + `form_post` callbacks, known/unknown oauth errors, callback API failures | `tests/oauth-providers-mixed/oauth-providers-mixed.test.ts`, `tests/oauth-providers-specific/oauth-providers-specific.test.ts`, `tests/oauth-providers-specific/oauth-callback-errors.test.ts` |
| `identity_providers[*].enabled` visibility | Covered | Enabled providers visible, disabled hidden | `tests/oauth-providers/oauth-providers.test.ts`, `tests/oauth-providers-mixed/oauth-providers-mixed.test.ts` |
| OAuth callback branching with terms | Covered | New user complete-registration vs existing user branch | `tests/oauth-providers-terms/oauth-branching.test.ts`, `tests/oauth-providers-terms/oauth-client-terms-continuity.test.ts` |
| `app.signup_implicit_terms` and explicit term consent | Covered | Register UX and submit validation | `tests/terms/register-terms.test.ts`, `tests/oauth-providers-terms/register-terms-ux.test.ts`, `tests/terms/terms-content-modal.test.ts` |
| `terms` complete-registration mode | Partial | Core flow and invalid token covered; broader retry/recovery matrix still thin | `tests/terms-complete-registration/terms-complete-registration.test.ts`, `tests/oauth-providers-terms/oauth-client-terms-continuity.test.ts` |
| Branding (`app.title/subtitle/icon_url/background_url`) | Covered | Auth layout branding render checks | `tests/ui-branding-locale-theme/ui-config.test.ts`, `tests/theme-system-multilang/theme-system-multilang.test.ts` |
| Locale config (`supported/default/fallback`) | Covered | Selector behavior and fallback rendering | `tests/ui-branding-locale-theme/ui-config.test.ts`, `tests/theme-system-multilang/theme-system-multilang.test.ts` |
| Theme config (`theme_mode`, light/dark themes) | Covered | Fixed light, fixed dark, and system toggle behavior | `tests/ui-branding-locale-theme/ui-config.test.ts`, `tests/theme-system-multilang/theme-system-multilang.test.ts`, `tests/theme-dark-fixed/theme-dark-fixed.test.ts` |
| `app.account_deletion` + retention messaging | Covered | Enable/disable, retention text, post-delete login failure | `tests/account-deletion/delete-account.test.ts`, `tests/account-deletion-disabled/account-deletion-disabled.test.ts`, `tests/config-managed-profile/config-managed-profile.test.ts` |
| Config-managed account restrictions (`managed_by=config`) | Covered | Profile security controls restricted | `tests/config-managed-profile/config-managed-profile.test.ts` |

## Known Gaps

- Real external provider behavior is still stub-based; no live third-party OAuth contract tests.
- Pairwise interaction depth is still limited for `terms + 2FA + oauth callback failure` combinations.
- `oauth-providers` now includes callback error smoke, but deep callback branching is still concentrated in `oauth-providers-mixed` and `oauth-providers-specific`.

## OAuth Stub Notes

OAuth stub endpoints live in `e2e/setup/create-server.ts` under
`/test/oauth-stub/*`. They support deterministic callback scenarios for:

- success
- access denied
- server and temporary errors
- unknown callback errors
- missing callback parameters
- token/userinfo endpoint failures
