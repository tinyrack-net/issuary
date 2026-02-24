'use client';

import { useState } from 'react';
import type { IntrospectionResponse } from '#example-next-basic/types/oidc';

interface IntrospectSectionProps {
  accessToken: string;
  refreshToken?: string;
}

export function IntrospectSection({
  accessToken,
  refreshToken,
}: IntrospectSectionProps) {
  const [accessTokenResult, setAccessTokenResult] =
    useState<IntrospectionResponse | null>(null);
  const [refreshTokenResult, setRefreshTokenResult] =
    useState<IntrospectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const introspectAccessToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/introspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accessToken,
          token_type_hint: 'access_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Introspection failed');
      }

      const result = await response.json();
      setAccessTokenResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const introspectRefreshToken = async () => {
    if (!refreshToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/introspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Introspection failed');
      }

      const result = await response.json();
      setRefreshTokenResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="mb-4 font-semibold text-black text-xl dark:text-zinc-50">
        Token Introspection (RFC 7662)
      </h2>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Test the token introspection endpoint to verify token metadata and
        active status.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Access Token Introspection */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-medium text-black text-sm dark:text-zinc-50">
              Access Token:
            </h3>
            <button
              className="rounded bg-blue-600 px-4 py-1.5 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
              onClick={introspectAccessToken}
              type="button"
            >
              {loading ? 'Introspecting...' : 'Introspect'}
            </button>
          </div>

          {accessTokenResult && (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-medium text-black text-sm dark:text-zinc-50">
                  Status:
                </span>
                <span
                  className={`rounded px-2 py-1 font-medium text-xs ${
                    accessTokenResult.active
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {accessTokenResult.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              {accessTokenResult.active && (
                <dl className="space-y-2 text-sm">
                  {accessTokenResult.scope && (
                    <div className="grid grid-cols-4 gap-2">
                      <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                        Scope:
                      </dt>
                      <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {accessTokenResult.scope}
                      </dd>
                    </div>
                  )}
                  {accessTokenResult.client_id && (
                    <div className="grid grid-cols-4 gap-2">
                      <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                        Client ID:
                      </dt>
                      <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {accessTokenResult.client_id}
                      </dd>
                    </div>
                  )}
                  {accessTokenResult.sub && (
                    <div className="grid grid-cols-4 gap-2">
                      <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                        Subject:
                      </dt>
                      <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {accessTokenResult.sub}
                      </dd>
                    </div>
                  )}
                  {accessTokenResult.exp && (
                    <div className="grid grid-cols-4 gap-2">
                      <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                        Expires:
                      </dt>
                      <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {new Date(
                          accessTokenResult.exp * 1000,
                        ).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {accessTokenResult.iat && (
                    <div className="grid grid-cols-4 gap-2">
                      <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                        Issued At:
                      </dt>
                      <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {new Date(
                          accessTokenResult.iat * 1000,
                        ).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-sm text-zinc-700 dark:text-zinc-300">
                  Raw Response
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {JSON.stringify(accessTokenResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Refresh Token Introspection */}
        {refreshToken && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-medium text-black text-sm dark:text-zinc-50">
                Refresh Token:
              </h3>
              <button
                className="rounded bg-blue-600 px-4 py-1.5 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
                onClick={introspectRefreshToken}
                type="button"
              >
                {loading ? 'Introspecting...' : 'Introspect'}
              </button>
            </div>

            {refreshTokenResult && (
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-medium text-black text-sm dark:text-zinc-50">
                    Status:
                  </span>
                  <span
                    className={`rounded px-2 py-1 font-medium text-xs ${
                      refreshTokenResult.active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {refreshTokenResult.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                {refreshTokenResult.active && (
                  <dl className="space-y-2 text-sm">
                    {refreshTokenResult.scope && (
                      <div className="grid grid-cols-4 gap-2">
                        <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                          Scope:
                        </dt>
                        <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                          {refreshTokenResult.scope}
                        </dd>
                      </div>
                    )}
                    {refreshTokenResult.client_id && (
                      <div className="grid grid-cols-4 gap-2">
                        <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                          Client ID:
                        </dt>
                        <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                          {refreshTokenResult.client_id}
                        </dd>
                      </div>
                    )}
                    {refreshTokenResult.sub && (
                      <div className="grid grid-cols-4 gap-2">
                        <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                          Subject:
                        </dt>
                        <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                          {refreshTokenResult.sub}
                        </dd>
                      </div>
                    )}
                    {refreshTokenResult.exp && (
                      <div className="grid grid-cols-4 gap-2">
                        <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                          Expires:
                        </dt>
                        <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                          {new Date(
                            refreshTokenResult.exp * 1000,
                          ).toLocaleString()}
                        </dd>
                      </div>
                    )}
                    {refreshTokenResult.iat && (
                      <div className="grid grid-cols-4 gap-2">
                        <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                          Issued At:
                        </dt>
                        <dd className="col-span-3 font-mono text-zinc-600 dark:text-zinc-400">
                          {new Date(
                            refreshTokenResult.iat * 1000,
                          ).toLocaleString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                <details className="mt-4">
                  <summary className="cursor-pointer font-medium text-sm text-zinc-700 dark:text-zinc-300">
                    Raw Response
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {JSON.stringify(refreshTokenResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
