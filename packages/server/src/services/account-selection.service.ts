import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { SessionAccount } from '../middleware/session.ts';

type PromptValue = 'none' | 'login' | 'consent' | 'select_account';
type EffectiveAccountSelectionMode =
  | 'disabled'
  | 'oidc_prompt'
  | 'smart'
  | 'always';

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

    const mode = this.resolveMode(
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

    if (
      mode === 'disabled' ||
      params.accountSelected ||
      (params.freshReauthentication && params.prompts.includes('login'))
    ) {
      return { type: 'continue', selectedSub: activeUserSub };
    }

    const hintedAccount = this.findLoginHintMatch(
      params.rememberedAccounts,
      params.loginHint,
    );
    const explicitlyRequiresChooser =
      params.prompts.includes('select_account') || mode === 'always';

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

  private resolveMode(
    enabled: boolean,
    globalMode: EffectiveAccountSelectionMode,
    clientMode:
      | 'inherit'
      | 'never'
      | 'oidc_prompt'
      | 'smart'
      | 'always'
      | undefined,
  ): EffectiveAccountSelectionMode {
    if (!enabled || globalMode === 'disabled' || clientMode === 'never') {
      return 'disabled';
    }
    if (!clientMode || clientMode === 'inherit') {
      return globalMode;
    }
    return clientMode;
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
