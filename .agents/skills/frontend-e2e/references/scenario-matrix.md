# Frontend E2E Scenario Matrix

Use this matrix to choose the right scenario before adding or updating
tests.

Each spec file within a scenario directory declares its own backend
config locally with `createScenarioFixture(...)`. There is no
scenario-level config or fixture module anymore.

| Scenario | Test directory | Primary coverage |
| --- | --- | --- |
| `minimal` | `e2e/tests/minimal` | Baseline login, register, consent, profile, error page |
| `totp-required` | `e2e/tests/totp-required` | Required TOTP setup, verify, recovery, profile TOTP flows |
| `email-verification` | `e2e/tests/email-verification` | Email verification during login/register/reset password |
| `registration-disabled` | `e2e/tests/registration-disabled` | Signup disabled behavior |
| `terms` | `e2e/tests/terms` | Terms acceptance and standalone terms view |
| `account-deletion` | `e2e/tests/account-deletion` | Account deletion flow enabled |
| `passkey-required` | `e2e/tests/passkey-required` | Required passkey flow |
| `dual-2fa` | `e2e/tests/dual-2fa` | Multiple second-factor choices |
| `password-disabled` | `e2e/tests/password-disabled` | Password auth disabled |
| `account-deletion-disabled` | `e2e/tests/account-deletion-disabled` | Account deletion hidden/blocked |
| `oauth-providers` | `e2e/tests/oauth-providers` | External provider login and error handling with stub endpoints |
| `oauth-providers-mixed` | `e2e/tests/oauth-providers-mixed` | Mixed enabled/disabled provider behavior and OAuth callback outcomes |
| `ui-branding-locale-theme` | `e2e/tests/ui-branding-locale-theme` | Branding, locale, and theme rendering |
| `theme-system-multilang` | `e2e/tests/theme-system-multilang` | System theme mode and language selector state |
| `totp-optional` | `e2e/tests/totp-optional` | Optional TOTP verification and method visibility |
| `config-managed-profile` | `e2e/tests/config-managed-profile` | Config-managed account restrictions in profile UI |
| `passkey-optional` | `e2e/tests/passkey-optional` | Optional passkey verification and passkey-only method visibility |
| `email-verification-2fa-required` | `e2e/tests/email-verification-2fa-required` | Email verification continuation into required 2FA setup |
| `journey-oauth-2fa` | `e2e/tests/journey-oauth-2fa` | OAuth continuation across email verification and 2FA |
| `oauth-providers-specific` | `e2e/tests/oauth-providers-specific` | Provider-specific OAuth mappings and callback error handling |
| `oauth-providers-terms` | `e2e/tests/oauth-providers-terms` | OAuth branching and terms continuity during complete registration |
| `terms-complete-registration` | `e2e/tests/terms-complete-registration` | Terms page behavior for `mode=complete_registration` |

## Project Naming Rule

Playwright project names are:

- `<scenario>:chromium`
- `<scenario>:firefox`

Examples:

- `minimal:chromium`
- `totp-required:firefox`

## Add New Scenario Checklist

1. Add tests in `e2e/tests/<scenario>/`.
2. Define local `createScenarioFixture(...)` usage in each new spec file.
3. Add scenario to the `configs` list in `playwright.config.ts`.
4. Run `pnpm test:e2e -- --project <scenario>:chromium`.
