# lint

Run Biome for linting and code formatting.

## Usage

```
/lint [path] [options]
```

## Arguments

- `<path>`: (optional) Specific file or directory to check

## Options

- `--fix`: Apply safe fixes automatically

## Instructions

When the user invokes this skill:

1. Parse the arguments
2. Run the appropriate Biome command:

### Check all files
```bash
pnpm biome check .
```

### Apply fixes
```bash
pnpm biome check . --write
```

### Check specific path
```bash
pnpm biome check <path>
```

### Check and fix specific path
```bash
pnpm biome check <path> --write
```

3. Report any linting errors or formatting issues
4. If `--fix` was used, report what was fixed

## Notes

- Biome configuration is in `biome.json`
- Biome replaces both Prettier (formatting) and ESLint (linting)
- Settings:
  - Line width: 80 characters
  - Indent: 2 spaces
  - Quote style: Single quotes
- Some files have special overrides (see `biome.json`)

## Common Issues

If Biome reports errors:
1. Import ordering issues - use `--fix` to auto-sort
2. Unused variables - remove or prefix with `_`
3. Tailwind class sorting - use `--fix` to auto-sort
