/**
 * Type augmentation for Vitest's `inject()` in e2e tests.
 *
 * Each e2e globalSetup provides `backendUrl` via `project.provide()`.
 * This declaration makes `inject('backendUrl')` type-safe in test files.
 *
 * The `export {}` at the bottom is critical: without it, TypeScript
 * treats this as a script (not a module), and `declare module 'vitest'`
 * becomes an ambient module declaration that *replaces* vitest's types
 * instead of augmenting them — causing all vitest exports to disappear.
 */
declare module 'vitest' {
  export interface ProvidedContext {
    backendUrl: string;
  }
}

export {};
