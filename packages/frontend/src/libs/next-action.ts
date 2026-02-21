import type { LoginResponse } from '@frontend/queries/login.js';
import {
  buildAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  type OAuthSearch,
} from './oauth-search.js';

type NextAction = LoginResponse['next_action'];

interface NavigateOptions {
  /** The next_action returned by the backend auth response */
  nextAction: NextAction;
  /** Current route search params (may contain OAuth params) */
  search: OAuthSearch;
  /** TanStack Router navigate function */
  navigate: (opts: { to: string; search?: Record<string, unknown> }) => void;
  /** Email address (used for verify_email redirect) */
  email?: string;
}

/**
 * Navigate the user to the appropriate page based on the
 * backend's `next_action` field from AuthResponse.
 *
 * This replaces the duplicated post-auth routing decision
 * tree that was previously in login, register, and
 * verify/email route handlers.
 */
export function navigateByNextAction({
  nextAction,
  search,
  navigate,
  email,
}: NavigateOptions): void {
  const oauthParams = extractOAuthParams(search);

  switch (nextAction.type) {
    case 'verify_email': {
      navigate({
        to: '/verify/email',
        search: { email, ...oauthParams },
      });
      return;
    }

    case 'setup_2fa': {
      if (nextAction.methods.length === 1) {
        const method = nextAction.methods[0];
        if (method === 'totp') {
          navigate({ to: '/setup/totp', search: oauthParams });
        } else {
          navigate({
            to: '/setup/passkey',
            search: { ...oauthParams, passkey_name: 'default' },
          });
        }
      } else {
        navigate({ to: '/setup/2fa', search: oauthParams });
      }
      return;
    }

    case 'verify_2fa': {
      if (nextAction.methods.length === 1) {
        const method = nextAction.methods[0];
        if (method === 'totp') {
          navigate({ to: '/verify/totp', search: oauthParams });
        } else {
          navigate({ to: '/verify/passkey', search: oauthParams });
        }
      } else {
        navigate({ to: '/verify/2fa', search: oauthParams });
      }
      return;
    }

    case 'complete': {
      if (isOAuthFlow(search)) {
        window.location.href = buildAuthorizeUrl(search);
      } else {
        navigate({ to: '/profile' });
      }
      return;
    }
  }
}
