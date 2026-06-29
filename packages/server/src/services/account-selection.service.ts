import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { SessionAccount } from '../middleware/session.ts';

type PromptValue = 'none' | 'login' | 'consent' | 'select_account';
type EffectiveAccountSelectionMode =
  | 'disabled'
  | 'oidc_prompt'
  | 'smart'
  | 'always';
type ClientAccountSelectionMode = NonNullable<
  TinyAuthRuntimeConfig['clients'][number]['account_selection']
>['mode'];

type RememberedAccount = SessionAccount & { email?: string | undefined };

export type AccountSelectionDecision =
  | { type: 'continue'; selectedSub: string }
  | { type: 'show_chooser' }
  | { type: 'oauth_error'; error: string; errorDescription: string }
  | { type: 'reauthenticate' };

export interface AccountSelectionDecisionParams {
  clientId: string;
  prompts: PromptValue[];
  activeUserSub?: string | undefined;
  rememberedAccounts: RememberedAccount[];
  maxAge?: number | undefined;
  loginHint?: string | undefined;
  accountSelected?: boolean | undefined;
  freshReauthentication?: boolean | undefined;
}

export interface NormalizedAccountSelectionPolicy {
  enabled: boolean;
  mode: EffectiveAccountSelectionMode;
  rememberAccounts: boolean;
  maxAccounts: number;
  ttl: string;
  allowAddAccount: boolean;
  allowRemoveAccount: boolean;
  loginHintBehavior: 'ignore' | 'prefer' | 'require_match';
  promptNoneError: 'account_selection_required' | 'login_required';
}

export function normalizeAccountSelectionPolicy(
  config: TinyAuthRuntimeConfig,
  clientId?: string | undefined,
): NormalizedAccountSelectionPolicy {
  const globalConfig = config.auth.account_selection;
  const clientOverride = clientId
    ? config.clients.find((client) => client.client_id === clientId)
        ?.account_selection
    : undefined;
  const mode = resolveAccountSelectionMode(
    globalConfig.enabled,
    globalConfig.mode,
    clientOverride?.mode,
  );
  const enabled = mode !== 'disabled';

  return {
    enabled,
    mode,
    rememberAccounts: enabled && globalConfig.remember_accounts.enabled,
    maxAccounts: globalConfig.remember_accounts.max_accounts,
    ttl: globalConfig.remember_accounts.ttl,
    allowAddAccount:
      enabled &&
      (clientOverride?.allow_add_account ?? globalConfig.allow_add_account),
    allowRemoveAccount: enabled && globalConfig.allow_remove_account,
    loginHintBehavior: globalConfig.login_hint.behavior,
    promptNoneError: globalConfig.prompt_none_error,
  };
}

function resolveAccountSelectionMode(
  enabled: boolean,
  globalMode: EffectiveAccountSelectionMode,
  clientMode: ClientAccountSelectionMode | undefined,
): EffectiveAccountSelectionMode {
  if (!enabled || globalMode === 'disabled' || clientMode === 'never') {
    return 'disabled';
  }
  if (!clientMode || clientMode === 'inherit') {
    return globalMode;
  }
  return clientMode;
}

export class AccountSelectionService {
  private readonly config: TinyAuthRuntimeConfig;

  public constructor(config: TinyAuthRuntimeConfig) {
    this.config = config;
  }

  public decide(
    params: AccountSelectionDecisionParams,
  ): AccountSelectionDecision {
    const globalConfig = this.config.auth.account_selection;
    const clientOverride = this.config.clients.find(
      (client) => client.client_id === params.clientId,
    )?.account_selection;

    const mode = resolveAccountSelectionMode(
      globalConfig.enabled,
      globalConfig.mode,
      clientOverride?.mode,
    );
    const activeUserSub = params.activeUserSub;

    if (!activeUserSub) {
      return this.continueOrErrorForMissingSelection(params);
    }

    if (
      !params.freshReauthentication &&
      (params.prompts.includes('login') || params.maxAge === 0)
    ) {
      return { type: 'reauthenticate' };
    }

    const explicitlyRequestsAccountSelection =
      params.prompts.includes('select_account');

    if (mode === 'disabled' && explicitlyRequestsAccountSelection) {
      if (params.freshReauthentication && !params.prompts.includes('none')) {
        return { type: 'continue', selectedSub: activeUserSub };
      }
      return this.promptNoneOrReauthenticate(
        params,
        globalConfig.prompt_none_error,
      );
    }

    if (
      mode === 'disabled' ||
      params.accountSelected ||
      (params.freshReauthentication &&
        params.prompts.includes('login') &&
        !explicitlyRequestsAccountSelection)
    ) {
      return { type: 'continue', selectedSub: activeUserSub };
    }

    const hintedAccount = this.findLoginHintMatch(
      params.rememberedAccounts,
      params.loginHint,
    );
    const explicitlyRequiresChooser =
      explicitlyRequestsAccountSelection ||
      (mode === 'always' && params.rememberedAccounts.length > 0);

    if (explicitlyRequiresChooser) {
      return this.promptNoneOrChooser(params, globalConfig.prompt_none_error);
    }

    if (
      params.loginHint &&
      globalConfig.login_hint.behavior === 'require_match'
    ) {
      if (!hintedAccount) {
        return this.promptNoneOrChooser(params, globalConfig.prompt_none_error);
      }
      return { type: 'continue', selectedSub: hintedAccount.sub };
    }

    if (hintedAccount && globalConfig.login_hint.behavior === 'prefer') {
      return { type: 'continue', selectedSub: hintedAccount.sub };
    }

    if (mode === 'smart' && params.rememberedAccounts.length >= 2) {
      return this.promptNoneOrChooser(params, globalConfig.prompt_none_error);
    }

    return { type: 'continue', selectedSub: activeUserSub };
  }

  private findLoginHintMatch(
    accounts: RememberedAccount[],
    loginHint: string | undefined,
  ): RememberedAccount | undefined {
    if (!loginHint) {
      return undefined;
    }
    return accounts.find(
      (account) => account.sub === loginHint || account.email === loginHint,
    );
  }

  private promptNoneOrChooser(
    params: AccountSelectionDecisionParams,
    promptNoneError: 'account_selection_required' | 'login_required',
  ): AccountSelectionDecision {
    if (params.prompts.includes('none')) {
      return {
        type: 'oauth_error',
        error: promptNoneError,
        errorDescription:
          'The Authorization Server requires End-User account selection.',
      };
    }
    return { type: 'show_chooser' };
  }

  private promptNoneOrReauthenticate(
    params: AccountSelectionDecisionParams,
    promptNoneError: 'account_selection_required' | 'login_required',
  ): AccountSelectionDecision {
    if (params.prompts.includes('none')) {
      return {
        type: 'oauth_error',
        error: promptNoneError,
        errorDescription:
          'The Authorization Server requires End-User account selection.',
      };
    }
    return { type: 'reauthenticate' };
  }

  private continueOrErrorForMissingSelection(
    params: AccountSelectionDecisionParams,
  ): AccountSelectionDecision {
    if (params.prompts.includes('none')) {
      return {
        type: 'oauth_error',
        error: 'login_required',
        errorDescription:
          'The Authorization Server requires End-User authentication.',
      };
    }
    return { type: 'reauthenticate' };
  }
}
