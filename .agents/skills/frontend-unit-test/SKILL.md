---
name: frontend-unit-test
description: >-
  Create, update, and debug Vitest browser-based unit/component tests for the
  tinyauth frontend package. Use when working on
  `packages/frontend/src/**/*.test.{ts,tsx}`, adding coverage for React
  components/hooks/libs, fixing failing or flaky frontend unit tests, updating
  test helpers under `packages/frontend/src/test-utils`, or running targeted
  unit test projects such as `vitest --project unit`.
---

# Frontend Unit Test

## Overview

Implement repository-aligned frontend unit/component tests in
`packages/frontend/src` with Vitest browser mode and
`vitest-browser-react`.

## Execute Workflow

1. Place tests next to the source file.
- Follow colocated naming: `component.tsx` ->
  `component.test.tsx`, `hook.ts` -> `hook.test.ts`.
- Keep test scope focused on one behavior per test.

2. Reuse existing test runtime and helpers.
- Import `render` from `vitest-browser-react`.
- Use `expect.element(...)` for UI visibility checks.
- Initialize i18n once with `initTestI18n()` in `beforeAll` when
  testing translated components.

3. Prefer user-centric selectors and deterministic assertions.
- Query by role, label, or visible text before using class selectors.
- Mock side effects with `vi.fn()` / `vi.spyOn()` and assert exact
  call counts and arguments.
- Avoid timing-sensitive assertions; await UI updates explicitly.

4. Keep imports and style aligned with the repository.
- Prefer alias imports like `@frontend/test-utils/i18n` for shared
  utilities.
- Import colocated components/hooks directly from their local file.
- Keep TypeScript strict; avoid type assertions and non-null assertions.

5. Run focused checks first, then broader verification.
- Iterate with a single file:
  `pnpm test:unit -- --project unit src/.../file.test.tsx`
- Run the unit project:
  `pnpm test:unit -- --project unit`
- Run repository verification before handoff:
  `pnpm build`
  `pnpm test 2>&1 | tail -200`
  `pnpm biome check .`

## Use References

- Read `references/repo-layout.md` for frontend test file locations and
  command entry points.
- Read `references/test-patterns.md` for canonical test snippets and
  assertion patterns used in this repository.
