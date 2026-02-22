# Frontend Unit Test Repo Layout

## Primary Paths

- `packages/frontend/src/**/*.test.tsx`: colocated component tests
- `packages/frontend/src/**/*.test.ts`: colocated hook/lib tests
- `packages/frontend/src/test-utils/i18n.ts`: deterministic i18n setup
- `packages/frontend/src/test-utils/vitest-browser-setup.ts`: browser
  test setup (CSS + shared runtime preparation)
- `packages/frontend/vitest.config.ts`: Vitest projects and browser
  providers
- `packages/frontend/package.json`: test scripts (`test:unit`,
  `test:unit:ui`, `test:unit:preview`)

## Commands

Run from `packages/frontend` unless noted:

- Single file:
  `pnpm test:unit -- --project unit src/components/ui/theme-toggle.test.tsx`
- Unit project:
  `pnpm test:unit -- --project unit`
- Browser preview mode:
  `pnpm test:unit:preview -- --project unit`

Run from repository root for final verification:

- `pnpm build`
- `pnpm test 2>&1 | tail -200`
- `pnpm biome check .`
