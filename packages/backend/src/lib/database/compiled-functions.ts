import type { CompiledFunctions } from '@mikro-orm/core';
import type { RuntimeDatabaseEntity } from './entities.ts';

const compiledFunctionPrefixes = [
  'hydrator',
  'comparator',
  'snapshotGenerator',
  'pkGetter',
  'pkGetterConverted',
  'pkSerializer',
  'resultMapper',
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findCompiledUniqueName(
  functionKeys: string[],
  tableName: string,
): string | undefined {
  const matcher = new RegExp(`^pkGetter-(${escapeRegExp(tableName)}_\\d+)$`);

  for (const functionKey of functionKeys) {
    const match = functionKey.match(matcher);

    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function remapCompiledFunctionKey(
  functionKey: string,
  compiledUniqueName: string,
  runtimeUniqueName: string,
): string | undefined {
  const matcher = new RegExp(
    `^(${compiledFunctionPrefixes.join('|')})-${escapeRegExp(compiledUniqueName)}(.*)$`,
  );
  const match = functionKey.match(matcher);

  if (!match) {
    return undefined;
  }

  return `${match[1]}-${runtimeUniqueName}${match[2]}`;
}

/**
 * MikroORM v7 uses a counter-based metadata id inside `meta.uniqueName`.
 *
 * `mikro-orm compile` also keys generated functions by that value, so the
 * compiled keys can drift from runtime keys when entity metadata is created in
 * a different order during bundling or startup. In that case MikroORM falls
 * back to runtime code generation via `new Function(...)`, which breaks in
 * no-eval runtimes like Cloudflare Workers.
 *
 * To keep all database drivers on the same path, we remap the compiled keys by
 * stable table name to the runtime `uniqueName` before passing them to MikroORM.
 */
export function resolveCompiledFunctionsForEntities(
  entitySchemas: readonly RuntimeDatabaseEntity[],
  compiledFunctions: CompiledFunctions,
): CompiledFunctions {
  const runtimeCompiledFunctions = { ...compiledFunctions };
  const compiledFunctionEntries = Object.entries(compiledFunctions);
  const compiledFunctionKeys = Object.keys(compiledFunctions);

  for (const entitySchema of entitySchemas) {
    const runtimeUniqueName = entitySchema.meta.uniqueName;

    if (runtimeCompiledFunctions[`pkGetter-${runtimeUniqueName}`]) {
      continue;
    }

    const compiledUniqueName = findCompiledUniqueName(
      compiledFunctionKeys,
      entitySchema.meta.tableName,
    );

    if (!compiledUniqueName) {
      continue;
    }

    for (const [functionKey, compiledFunction] of compiledFunctionEntries) {
      const runtimeFunctionKey = remapCompiledFunctionKey(
        functionKey,
        compiledUniqueName,
        runtimeUniqueName,
      );

      if (!runtimeFunctionKey) {
        continue;
      }

      runtimeCompiledFunctions[runtimeFunctionKey] = compiledFunction;
    }
  }

  return runtimeCompiledFunctions;
}
