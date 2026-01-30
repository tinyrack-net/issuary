# doctor

Check project health and environment setup.

## Usage

```
/doctor [options]
```

## Options

- (none): Run all health checks
- `--fix`: Attempt to fix issues (install dependencies, etc.)

## Instructions

When the user invokes this skill, run the following checks:

### 1. Check Node.js version
```bash
node --version
```
- Required: >= 20.x
- Report: Pass/Fail with version number

### 2. Check pnpm installation
```bash
pnpm --version
```
- Report: Pass/Fail with version number

### 3. Check dependencies installed
```bash
ls node_modules/.pnpm 2>/dev/null && echo "Dependencies installed" || echo "Dependencies NOT installed"
```
- If `--fix` and dependencies missing: run `pnpm install`

### 4. Check config file exists
```bash
ls packages/backend/config.yaml 2>/dev/null && echo "Config exists" || echo "Config MISSING"
```
- Report: Pass/Fail
- If missing, suggest creating from example or template

### 5. TypeScript compilation check
```bash
pnpm build 2>&1 | head -50
```
- Report: Pass/Fail with any errors

### 6. Biome check
```bash
pnpm biome check . 2>&1 | head -50
```
- Report: Pass/Fail with issue count

## Output Format

Report results as a checklist:
```
Project Health Check
====================
[ ] Node.js version: v22.x (>= 20 required)
[ ] pnpm installed: v9.x
[ ] Dependencies installed
[ ] Config file exists
[ ] TypeScript compiles
[ ] Biome passes

Overall: X/6 checks passed
```

## Common Issues

1. **Node.js too old**: Install Node.js 20+ via nvm or fnm
2. **pnpm not found**: Install with `npm install -g pnpm`
3. **Dependencies missing**: Run `pnpm install`
4. **Config missing**: Copy from example or create new
