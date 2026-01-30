# test

Run Vitest unit tests for the backend package.

## Usage

```
/test [file] [options]
```

## Arguments

- `<file>`: (optional) Specific test file or pattern to run

## Options

- `--watch`: Run tests in watch mode
- `--coverage`: Run with coverage report

## Instructions

When the user invokes this skill:

1. Parse the arguments
2. Run the appropriate test command from the backend directory:

### Run all tests
```bash
cd packages/backend && pnpm test 2>&1 | tail -200
```

### Run specific test file
```bash
cd packages/backend && pnpm test <file> 2>&1 | tail -200
```

### Run in watch mode
```bash
cd packages/backend && pnpm test --watch
```

### Run with coverage
```bash
cd packages/backend && pnpm test --coverage 2>&1 | tail -200
```

3. Report the test results to the user
4. If tests fail, highlight the failing tests and suggest fixes if obvious

## Notes

- Tests are colocated with source files (e.g., `post.ts` and `post.test.ts`)
- Output is piped through `tail -200` to manage large outputs
- Test configuration is in `packages/backend/vitest.config.ts`
