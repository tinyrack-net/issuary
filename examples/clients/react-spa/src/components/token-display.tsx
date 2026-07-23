import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
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
    <TRCard.Root>
      <TRCard.Header>
        <TRCard.Title>Tokens</TRCard.Title>
      </TRCard.Header>
      <TRCard.Content className="space-y-4">
        <TRCard.Root variant="outlined">
          <TRCard.Content className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Access Token</span>
              <div className="flex gap-2">
                <TRButton
                  appearance="ghost"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  uiSize="sm"
                >
                  {showAccessToken ? 'Hide' : 'Show'}
                </TRButton>
                <TRButton
                  appearance="ghost"
                  onClick={() => copyToClipboard(tokens.access_token)}
                  uiSize="sm"
                >
                  Copy
                </TRButton>
              </div>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
              {showAccessToken
                ? tokens.access_token
                : maskToken(tokens.access_token)}
            </pre>
            <div className="text-muted-foreground text-xs">
              Expires in: {tokens.expires_in} seconds | Type:{' '}
              {tokens.token_type}
            </div>
          </TRCard.Content>
        </TRCard.Root>

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
            <span className="text-muted-foreground">{tokens.scope}</span>
          </div>
        )}
      </TRCard.Content>
    </TRCard.Root>
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
    <TRCard.Root variant="outlined">
      <TRCard.Content className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Refresh Token</span>
          <div className="flex gap-2">
            <TRButton
              appearance="ghost"
              onClick={() => setShowRefreshToken(!showRefreshToken)}
              uiSize="sm"
            >
              {showRefreshToken ? 'Hide' : 'Show'}
            </TRButton>
            <TRButton
              appearance="ghost"
              onClick={() => copyToClipboard(refreshToken)}
              uiSize="sm"
            >
              Copy
            </TRButton>
          </div>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
          {showRefreshToken ? refreshToken : maskToken(refreshToken)}
        </pre>
      </TRCard.Content>
    </TRCard.Root>
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
    <TRCard.Root variant="outlined">
      <TRCard.Content className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">ID Token</span>
          <div className="flex gap-2">
            <TRButton
              appearance="ghost"
              onClick={() => setShowIdToken(!showIdToken)}
              uiSize="sm"
            >
              {showIdToken ? 'Hide' : 'Show'}
            </TRButton>
            <TRButton
              appearance="ghost"
              onClick={() => copyToClipboard(idToken)}
              uiSize="sm"
            >
              Copy
            </TRButton>
          </div>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
          {showIdToken ? idToken : maskToken(idToken)}
        </pre>
      </TRCard.Content>
    </TRCard.Root>
  );
}
