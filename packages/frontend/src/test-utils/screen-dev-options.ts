export type ScreenDevOptions = {
  help: boolean;
  list: boolean;
  scenario?: string;
  variant?: string;
};

export type ScreenDevMode =
  | { type: 'help' }
  | { type: 'list' }
  | { type: 'interactive' }
  | { type: 'run'; scenario: string; variant?: string }
  | { type: 'missing-scenario' };

export function resolveScreenDevMode(
  options: ScreenDevOptions,
  interactive: boolean,
): ScreenDevMode {
  if (options.help) {
    return { type: 'help' };
  }
  if (options.list) {
    return { type: 'list' };
  }
  if (options.scenario) {
    return {
      type: 'run',
      scenario: options.scenario,
      ...(options.variant ? { variant: options.variant } : {}),
    };
  }
  return interactive ? { type: 'interactive' } : { type: 'missing-scenario' };
}

export function normalizeScreenDevArgs(args: readonly string[]): string[] {
  return args[0] === '--' ? args.slice(1) : [...args];
}
