# Frontend E2E Scenario Matrix

Use this matrix to choose the right scenario before adding or updating
tests.

| Scenario | Config | Fixture | Test directory | Primary coverage |
| --- | --- | --- | --- | --- |
| `minimal` | `e2e/configs/minimal.ts` | `e2e/fixtures/minimal.ts` | `e2e/tests/minimal` | Baseline login, register, consent, profile, error page |
| `totp-required` | `e2e/configs/totp-required.ts` | `e2e/fixtures/totp-required.ts` | `e2e/tests/totp-required` | Required TOTP setup, verify, recovery, profile TOTP flows |
| `email-verification` | `e2e/configs/email-verification.ts` | `e2e/fixtures/email-verification.ts` | `e2e/tests/email-verification` | Email verification during login/register/reset password |
| `registration-disabled` | `e2e/configs/registration-disabled.ts` | `e2e/fixtures/registration-disabled.ts` | `e2e/tests/registration-disabled` | Signup disabled behavior |
| `terms` | `e2e/configs/terms.ts` | `e2e/fixtures/terms.ts` | `e2e/tests/terms` | Terms acceptance and standalone terms view |
| `account-deletion` | `e2e/configs/account-deletion.ts` | `e2e/fixtures/account-deletion.ts` | `e2e/tests/account-deletion` | Account deletion flow enabled |
| `passkey-required` | `e2e/configs/passkey-required.ts` | `e2e/fixtures/passkey-required.ts` | `e2e/tests/passkey-required` | Required passkey flow |
| `dual-2fa` | `e2e/configs/dual-2fa.ts` | `e2e/fixtures/dual-2fa.ts` | `e2e/tests/dual-2fa` | Multiple second-factor choices |
| `password-disabled` | `e2e/configs/password-disabled.ts` | `e2e/fixtures/password-disabled.ts` | `e2e/tests/password-disabled` | Password auth disabled |
| `account-deletion-disabled` | `e2e/configs/account-deletion-disabled.ts` | `e2e/fixtures/account-deletion-disabled.ts` | `e2e/tests/account-deletion-disabled` | Account deletion hidden/blocked |
| `oauth-providers` | `e2e/configs/oauth-providers.ts` | `e2e/fixtures/oauth-providers.ts` | `e2e/tests/oauth-providers` | External provider login and error handling with stub endpoints |
| `ui-branding-locale-theme` | `e2e/configs/ui-branding-locale-theme.ts` | `e2e/fixtures/ui-branding-locale-theme.ts` | `e2e/tests/ui-branding-locale-theme` | Branding, locale, and theme rendering |

## Project Naming Rule

Playwright project names are:

- `<scenario>:chromium`
- `<scenario>:firefox`

Examples:

- `minimal:chromium`
- `totp-required:firefox`

## Add New Scenario Checklist

1. Add `e2e/configs/<scenario>.ts`.
2. Add `e2e/fixtures/<scenario>.ts`.
3. Add tests in `e2e/tests/<scenario>/`.
4. Add scenario to the `configs` list in `playwright.config.ts`.
5. Run `pnpm test:e2e -- --project <scenario>:chromium`.
