# Frontend E2E Config Coverage Matrix

This document maps backend `/api/config` driven behavior to E2E coverage.

## Covered keys

| Config key | UI / flow impact | E2E coverage |
| --- | --- | --- |
| `app.allowed_signup_emails` -> `public_registration` | Register route/link enabled or redirected | `tests/registration-disabled/register-disabled.test.ts`, `tests/minimal/register.test.ts` |
| `auth.password.enabled` | Password login form and password routes | `tests/password-disabled/password-disabled.test.ts`, `tests/minimal/login.test.ts` |
| `smtp.enabled` | Forgot-password link visibility in login password page | `tests/minimal/login.test.ts`, `tests/email-verification/forgot-password.test.ts` |
| `auth.password.email_verification` | Email verification required after register/login | `tests/email-verification/register-email-verify.test.ts`, `tests/email-verification/login-email-verify.test.ts`, `tests/email-verification-2fa-required/email-verify-2fa.test.ts` |
| `auth.password.second_factor.required` | Setup 2FA routing and required setup flow | `tests/totp-required/register-totp-setup.test.ts`, `tests/dual-2fa/choose-2fa.test.ts`, `tests/passkey-required/passkey-flow.test.ts`, `tests/email-verification-2fa-required/email-verify-2fa.test.ts` |
| OAuth search param continuity (`client_id`, `redirect_uri`, `state`, PKCE fields) | Preserve OAuth/OIDC context across `/register`, `/login/password`, `/verify/email`, `/setup/*`, `/verify/*`, and `/consent` | `tests/journey-oauth-2fa/journey-oauth-2fa.test.ts` |
| `auth.password.totp.enabled` | TOTP setup/verify availability and profile section | `tests/totp-required/*.test.ts`, `tests/totp-optional/totp-optional.test.ts` |
| `auth.passkey.enabled` | Passkey setup/verify availability and profile section | `tests/passkey-required/passkey-flow.test.ts`, `tests/dual-2fa/choose-2fa.test.ts`, `tests/totp-optional/totp-optional.test.ts`, `tests/passkey-optional/passkey-optional.test.ts` |
| `identity_providers[*].enabled` | OAuth provider buttons and linked account providers | `tests/oauth-providers/oauth-providers.test.ts`, `tests/oauth-providers-mixed/oauth-providers-mixed.test.ts` |
| OAuth callback branching (`isNewUser` + explicit terms) | Existing user login vs new user complete-registration redirect behavior | `tests/oauth-providers-terms/oauth-branching.test.ts` |
| `app.signup_implicit_terms` | Implicit terms notice on auth pages | `tests/terms/register-terms.test.ts`, `tests/theme-system-multilang/theme-system-multilang.test.ts`, `tests/oauth-providers-terms/register-terms-ux.test.ts` |
| `app.title/subtitle/icon_url/background_url` | Branding on auth layout | `tests/ui-branding-locale-theme/ui-config.test.ts`, `tests/theme-system-multilang/theme-system-multilang.test.ts` |
| `app.supported_languages/default_language/fallback_language` | Language selector visibility and fallback text lookup | `tests/ui-branding-locale-theme/ui-config.test.ts`, `tests/theme-system-multilang/theme-system-multilang.test.ts` |
| `app.theme_mode/light_theme/dark_theme` | Theme toggle visibility and runtime theme switching | `tests/ui-branding-locale-theme/ui-config.test.ts`, `tests/theme-system-multilang/theme-system-multilang.test.ts` |
| `app.account_deletion` + `cleanup.deleted_users.retention` | Danger zone visibility and retention-based messaging | `tests/account-deletion/delete-account.test.ts`, `tests/account-deletion-disabled/account-deletion-disabled.test.ts`, `tests/config-managed-profile/config-managed-profile.test.ts` |
| Config-managed user (`managed_by=config`) | Restricted profile security controls | `tests/config-managed-profile/config-managed-profile.test.ts` |
| `terms` route mode (`mode=complete_registration`) | Unauthenticated terms flow for pending OAuth signup | `tests/terms-complete-registration/terms-complete-registration.test.ts`, `tests/oauth-providers-terms/oauth-branching.test.ts`, `tests/oauth-providers-terms/oauth-client-terms-continuity.test.ts` |

## OAuth stub notes

`tests/oauth-providers-mixed` uses deterministic provider stubs served by
`e2e/setup/create-server.ts` under `/test/oauth-stub/*` to avoid external OAuth
network dependencies while still exercising callback success and error paths.
