# test-e2e

Run Playwright end-to-end tests for the frontend package.

## Usage

```
/test-e2e [spec] [options]
```

## Arguments

- `<spec>`: (optional) Specific spec file or pattern (e.g., `auth/login`)

## Options

- `--ui`: Open Playwright UI mode for interactive testing
- `--debug`: Run in debug mode with headed browser

## Instructions

When the user invokes this skill:

1. Parse the arguments
2. Run the appropriate Playwright command from the frontend directory:

### Run all E2E tests (headless)
```bash
cd packages/frontend && pnpm test:e2e
```

### Run with Playwright UI
```bash
cd packages/frontend && pnpm test:e2e:ui
```

### Run in debug mode
```bash
cd packages/frontend && pnpm test:e2e:debug
```

### Run specific spec file
```bash
cd packages/frontend && npx playwright test e2e/tests/<spec>.spec.ts
```

3. Report the test results to the user
4. If tests fail, check the HTML report at `packages/frontend/playwright-report/`

## Notes

- E2E tests require both backend (port 8080) and frontend (port 8081) running
- Playwright config automatically starts dev servers if needed
- Tests use Page Object Model pattern in `e2e/pages/`
- Test fixtures are in `e2e/fixtures/`
- Configuration: `packages/frontend/playwright.config.ts`

## Test Structure

```
packages/frontend/e2e/
  pages/           # Page Object Models
  fixtures/        # Test fixtures and helpers
  tests/
    auth/          # Login, register, logout tests
    password/      # Password forgot/reset tests
    verification/  # Email and TOTP verification
    profile/       # Profile management tests
    setup/         # TOTP setup tests
```
