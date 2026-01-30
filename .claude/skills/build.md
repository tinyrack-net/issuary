# build

Build project packages for production.

## Usage

```
/build [options]
```

## Options

- (none): Build all packages
- `--backend`: Build only backend
- `--frontend`: Build only frontend
- `--homepage`: Build only homepage (Astro docs)

## Instructions

When the user invokes this skill:

1. Parse the arguments to determine which package(s) to build
2. Run the appropriate build command:

### Build all packages
```bash
pnpm build
```

### Build backend only
```bash
pnpm --filter @tinyauth/backend build
```

### Build frontend only
```bash
pnpm --filter @tinyauth/frontend build
```

### Build homepage only
```bash
pnpm --filter @tinyauth/homepage build
```

3. Report build status and any errors
4. Note the output locations:
   - Backend: `packages/backend/dist/`
   - Frontend: `packages/backend/public/` (embedded in backend)
   - Homepage: `packages/homepage/dist/`

## Notes

- Frontend builds to `packages/backend/public/` for single-server deployment
- Backend build includes TypeScript compilation + path alias resolution
- Build uses `tsc && tsc-alias` for backend
- Build uses Vite for frontend
