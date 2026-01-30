# verify

Run pre-commit verification checks (build, test, lint).

## Usage

```
/verify [options]
```

## Options

- (none): Run all checks (build, test, lint)
- `--fast`: Skip tests, run only build and lint

## Instructions

When the user invokes this skill:

1. Run verification steps sequentially:

### Full verification (default)
```bash
pnpm build && pnpm test 2>&1 | tail -200 && pnpm biome check .
```

### Fast verification (skip tests)
```bash
pnpm build && pnpm biome check .
```

2. Report results for each step:
   - Build: Success/Failure
   - Test: Pass count, fail count
   - Lint: Error count, warning count

3. If any step fails, stop and report the failure
4. Provide a summary at the end

## Verification Steps

1. **Build Check**: Ensures TypeScript compiles without errors
2. **Test Check**: Runs all unit tests (output limited to last 200 lines)
3. **Lint Check**: Runs Biome to check formatting and linting

## When to Use

- Before committing code
- Before creating a pull request
- After making significant changes
- During code review

## Notes

- This follows the verification process defined in AGENTS.md
- Test output is piped through `tail -200` to manage large outputs
- All checks must pass for the verification to succeed
