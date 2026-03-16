'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface RevokeSectionProps {
  accessToken: string;
  refreshToken?: string;
}

export function RevokeSection({
  accessToken,
  refreshToken,
}: RevokeSectionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const revokeAccessToken = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accessToken,
          token_type_hint: 'access_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Revocation failed');
      }

      setSuccess('Access token revoked successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const revokeRefreshToken = async () => {
    if (!refreshToken) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Revocation failed');
      }

      setSuccess('Refresh token revoked successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const revokeAllAndLogout = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/revoke', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Revocation failed');
      }

      setSuccess('All tokens revoked. Redirecting...');

      // Redirect to home after a short delay
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="mb-4 font-semibold text-black text-xl dark:text-zinc-50">
        Token Revocation (RFC 7009)
      </h2>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Revoke tokens to invalidate them on the authorization server. Revoked
        tokens will become inactive immediately.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {/* Individual Token Revocation */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded bg-orange-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            disabled={loading}
            onClick={revokeAccessToken}
            type="button"
          >
            {loading ? 'Revoking...' : 'Revoke Access Token'}
          </button>

          {refreshToken && (
            <button
              className="rounded bg-orange-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              disabled={loading}
              onClick={revokeRefreshToken}
              type="button"
            >
              {loading ? 'Revoking...' : 'Revoke Refresh Token'}
            </button>
          )}
        </div>

        {/* Revoke All and Logout */}
        <div className="border-zinc-200 border-t pt-4 dark:border-zinc-700">
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Revoke all tokens and clear local session:
          </p>
          <button
            className="rounded bg-red-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            disabled={loading}
            onClick={revokeAllAndLogout}
            type="button"
          >
            {loading ? 'Revoking...' : 'Revoke All & Logout'}
          </button>
        </div>
      </div>
    </div>
  );
}
