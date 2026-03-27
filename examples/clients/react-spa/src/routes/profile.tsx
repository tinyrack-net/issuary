import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useState } from 'react';
import { TokenDisplay } from '#example-react-spa/components/token-display.tsx';
import { UserInfo } from '#example-react-spa/components/user-info.tsx';
import {
  decodeIDToken,
  introspectToken,
  revokeToken,
} from '#example-react-spa/libs/oidc-client.ts';
import {
  clearTokens,
  getTokens,
} from '#example-react-spa/libs/token-storage.ts';
import type { IntrospectionResponse } from '#example-react-spa/types/oidc.ts';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
  beforeLoad: ({ context }) => {
    if (!context.tokens) {
      throw redirect({ to: '/' });
    }
  },
});

function ProfilePage() {
  const navigate = useNavigate();
  const tokens = getTokens();
  if (!tokens) {
    throw redirect({ to: '/' });
  }
  const idTokenPayload = tokens.id_token
    ? decodeIDToken(tokens.id_token)
    : null;

  const [introspectionResult, setIntrospectionResult] =
    useState<IntrospectionResponse | null>(null);
  const [introspectionError, setIntrospectionError] = useState<string | null>(
    null,
  );
  const [introspectionLoading, setIntrospectionLoading] = useState(false);

  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeSuccess, setRevokeSuccess] = useState(false);

  const handleLogout = () => {
    clearTokens();
    navigate({ to: '/' });
  };

  const handleIntrospect = async (
    token: string,
    tokenType: 'access_token' | 'refresh_token',
  ) => {
    setIntrospectionLoading(true);
    setIntrospectionError(null);
    setIntrospectionResult(null);

    try {
      const result = await introspectToken(token, tokenType);
      setIntrospectionResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setIntrospectionError(message);
    } finally {
      setIntrospectionLoading(false);
    }
  };

  const handleRevoke = async (
    token: string,
    tokenType: 'access_token' | 'refresh_token',
  ) => {
    setRevokeLoading(true);
    setRevokeError(null);
    setRevokeSuccess(false);

    try {
      await revokeToken(token, tokenType);
      setRevokeSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setRevokeError(message);
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-3xl">Authentication Successful</h1>
            <p className="text-base-content/70">
              You have successfully authenticated using OIDC with a Public
              Client (PKCE).
            </p>
          </div>
        </div>

        {idTokenPayload && <UserInfo payload={idTokenPayload} />}

        <TokenDisplay tokens={tokens} />

        {idTokenPayload && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">ID Token Payload (Decoded)</h2>
              <pre className="overflow-x-auto rounded bg-base-200 p-4 font-mono text-xs">
                {JSON.stringify(idTokenPayload, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Token Introspection</h2>
            <p className="text-base-content/70 text-sm">
              RFC 7662 - Check the active state of a token
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="btn btn-outline btn-sm"
                disabled={introspectionLoading}
                onClick={() =>
                  handleIntrospect(tokens.access_token, 'access_token')
                }
                type="button"
              >
                {introspectionLoading && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Introspect Access Token
              </button>
              {tokens.refresh_token && (
                <RefreshTokenIntrospectButton
                  loading={introspectionLoading}
                  onIntrospect={handleIntrospect}
                  refreshToken={tokens.refresh_token}
                />
              )}
            </div>

            {introspectionError && (
              <div className="alert alert-error mt-4">
                <span>{introspectionError}</span>
              </div>
            )}

            {introspectionResult && (
              <pre className="mt-4 overflow-x-auto rounded bg-base-200 p-4 font-mono text-xs">
                {JSON.stringify(introspectionResult, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Token Revocation</h2>
            <p className="text-base-content/70 text-sm">
              RFC 7009 - Revoke tokens to invalidate them
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="btn btn-error btn-outline btn-sm"
                disabled={revokeLoading}
                onClick={() =>
                  handleRevoke(tokens.access_token, 'access_token')
                }
                type="button"
              >
                {revokeLoading && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Revoke Access Token
              </button>
              {tokens.refresh_token && (
                <RefreshTokenRevokeButton
                  loading={revokeLoading}
                  onRevoke={handleRevoke}
                  refreshToken={tokens.refresh_token}
                />
              )}
            </div>

            {revokeError && (
              <div className="alert alert-error mt-4">
                <span>{revokeError}</span>
              </div>
            )}

            {revokeSuccess && (
              <div className="alert alert-success mt-4">
                <span>Token revoked successfully</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            className="btn btn-error"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
          <Link className="btn btn-outline" to="/discovery">
            Discovery Endpoints
          </Link>
          <Link className="btn btn-outline" to="/">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

interface RefreshTokenIntrospectButtonProps {
  refreshToken: string;
  onIntrospect: (
    token: string,
    tokenType: 'access_token' | 'refresh_token',
  ) => Promise<void>;
  loading: boolean;
}

function RefreshTokenIntrospectButton({
  refreshToken,
  onIntrospect,
  loading,
}: RefreshTokenIntrospectButtonProps) {
  return (
    <button
      className="btn btn-outline btn-sm"
      disabled={loading}
      onClick={() => onIntrospect(refreshToken, 'refresh_token')}
      type="button"
    >
      {loading && <span className="loading loading-spinner loading-xs" />}
      Introspect Refresh Token
    </button>
  );
}

interface RefreshTokenRevokeButtonProps {
  refreshToken: string;
  onRevoke: (
    token: string,
    tokenType: 'access_token' | 'refresh_token',
  ) => Promise<void>;
  loading: boolean;
}

function RefreshTokenRevokeButton({
  refreshToken,
  onRevoke,
  loading,
}: RefreshTokenRevokeButtonProps) {
  return (
    <button
      className="btn btn-error btn-outline btn-sm"
      disabled={loading}
      onClick={() => onRevoke(refreshToken, 'refresh_token')}
      type="button"
    >
      {loading && <span className="loading loading-spinner loading-xs" />}
      Revoke Refresh Token
    </button>
  );
}
