import { useState } from 'react';
import type { TokenResponse } from '#example-react-spa/types/oidc.ts';

interface TokenDisplayProps {
  tokens: TokenResponse;
}

export function TokenDisplay({ tokens }: TokenDisplayProps) {
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [showIdToken, setShowIdToken] = useState(false);

  const maskToken = (token: string) => {
    if (token.length <= 20) return '***';
    return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Tokens</h2>

        <div className="space-y-4">
          <div className="rounded border border-base-300 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">Access Token</span>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  type="button"
                >
                  {showAccessToken ? 'Hide' : 'Show'}
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => copyToClipboard(tokens.access_token)}
                  type="button"
                >
                  Copy
                </button>
              </div>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
              {showAccessToken
                ? tokens.access_token
                : maskToken(tokens.access_token)}
            </pre>
            <div className="mt-2 text-base-content/60 text-xs">
              Expires in: {tokens.expires_in} seconds | Type:{' '}
              {tokens.token_type}
            </div>
          </div>

          {tokens.refresh_token && (
            <RefreshTokenSection
              copyToClipboard={copyToClipboard}
              maskToken={maskToken}
              refreshToken={tokens.refresh_token}
              setShowRefreshToken={setShowRefreshToken}
              showRefreshToken={showRefreshToken}
            />
          )}

          {tokens.id_token && (
            <IdTokenSection
              copyToClipboard={copyToClipboard}
              idToken={tokens.id_token}
              maskToken={maskToken}
              setShowIdToken={setShowIdToken}
              showIdToken={showIdToken}
            />
          )}

          {tokens.scope && (
            <div className="text-sm">
              <span className="font-semibold">Granted Scopes: </span>
              <span className="text-base-content/70">{tokens.scope}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RefreshTokenSectionProps {
  refreshToken: string;
  showRefreshToken: boolean;
  setShowRefreshToken: (show: boolean) => void;
  maskToken: (token: string) => string;
  copyToClipboard: (text: string) => Promise<void>;
}

function RefreshTokenSection({
  refreshToken,
  showRefreshToken,
  setShowRefreshToken,
  maskToken,
  copyToClipboard,
}: RefreshTokenSectionProps) {
  return (
    <div className="rounded border border-base-300 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Refresh Token</span>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setShowRefreshToken(!showRefreshToken)}
            type="button"
          >
            {showRefreshToken ? 'Hide' : 'Show'}
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => copyToClipboard(refreshToken)}
            type="button"
          >
            Copy
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
        {showRefreshToken ? refreshToken : maskToken(refreshToken)}
      </pre>
    </div>
  );
}

interface IdTokenSectionProps {
  idToken: string;
  showIdToken: boolean;
  setShowIdToken: (show: boolean) => void;
  maskToken: (token: string) => string;
  copyToClipboard: (text: string) => Promise<void>;
}

function IdTokenSection({
  idToken,
  showIdToken,
  setShowIdToken,
  maskToken,
  copyToClipboard,
}: IdTokenSectionProps) {
  return (
    <div className="rounded border border-base-300 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">ID Token</span>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setShowIdToken(!showIdToken)}
            type="button"
          >
            {showIdToken ? 'Hide' : 'Show'}
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => copyToClipboard(idToken)}
            type="button"
          >
            Copy
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
        {showIdToken ? idToken : maskToken(idToken)}
      </pre>
    </div>
  );
}
