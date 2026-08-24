import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { TRAlert } from '@tinyrack/ui/components/alert';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRCodeBlock } from '@tinyrack/ui/components/code-block';
import { TRTabs } from '@tinyrack/ui/components/tabs';
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
    <div className="min-h-screen p-tinyrack-2xl">
      <div className="mx-auto max-w-tinyrack-overlay-md space-y-tinyrack-xl">
        <TRCard.Root>
          <TRCard.Header>
            <TRCard.Title className="text-tinyrack-3xl">
              Authentication Successful
            </TRCard.Title>
            <TRCard.Description>
              You have successfully authenticated using OIDC with a Public
              Client (PKCE).
            </TRCard.Description>
          </TRCard.Header>
        </TRCard.Root>

        <TRTabs.Root defaultValue="info">
          <TRTabs.List>
            <TRTabs.Tab value="info">User & Tokens</TRTabs.Tab>
            <TRTabs.Tab value="introspect">Token Introspection</TRTabs.Tab>
            <TRTabs.Tab value="revoke">Token Revocation</TRTabs.Tab>
          </TRTabs.List>

          <TRTabs.Panel
            className="space-y-tinyrack-xl pt-tinyrack-lg"
            value="info"
          >
            {idTokenPayload && <UserInfo payload={idTokenPayload} />}

            <TokenDisplay tokens={tokens} />

            {idTokenPayload && (
              <TRCard.Root>
                <TRCard.Header>
                  <TRCard.Title>ID Token Payload (Decoded)</TRCard.Title>
                </TRCard.Header>
                <TRCard.Content>
                  <TRCodeBlock
                    code={JSON.stringify(idTokenPayload, null, 2)}
                    language="json"
                  />
                </TRCard.Content>
              </TRCard.Root>
            )}
          </TRTabs.Panel>

          <TRTabs.Panel
            className="space-y-tinyrack-xl pt-tinyrack-lg"
            value="introspect"
          >
            <TRCard.Root>
              <TRCard.Header>
                <TRCard.Title>Token Introspection</TRCard.Title>
                <TRCard.Description>
                  RFC 7662 - Check the active state of a token
                </TRCard.Description>
              </TRCard.Header>
              <TRCard.Content className="space-y-tinyrack-lg">
                <div className="flex flex-wrap gap-tinyrack-sm">
                  <TRButton
                    appearance="outline"
                    disabled={introspectionLoading}
                    loading={introspectionLoading}
                    onClick={() =>
                      handleIntrospect(tokens.access_token, 'access_token')
                    }
                    uiSize="sm"
                  >
                    Introspect Access Token
                  </TRButton>
                  {tokens.refresh_token && (
                    <RefreshTokenIntrospectButton
                      loading={introspectionLoading}
                      onIntrospect={handleIntrospect}
                      refreshToken={tokens.refresh_token}
                    />
                  )}
                </div>

                {introspectionError && (
                  <TRAlert.Root variant="danger">
                    <TRAlert.Description>
                      {introspectionError}
                    </TRAlert.Description>
                  </TRAlert.Root>
                )}

                {introspectionResult && (
                  <TRCodeBlock
                    code={JSON.stringify(introspectionResult, null, 2)}
                    language="json"
                  />
                )}
              </TRCard.Content>
            </TRCard.Root>
          </TRTabs.Panel>

          <TRTabs.Panel
            className="space-y-tinyrack-xl pt-tinyrack-lg"
            value="revoke"
          >
            <TRCard.Root>
              <TRCard.Header>
                <TRCard.Title>Token Revocation</TRCard.Title>
                <TRCard.Description>
                  RFC 7009 - Revoke tokens to invalidate them
                </TRCard.Description>
              </TRCard.Header>
              <TRCard.Content className="space-y-tinyrack-lg">
                <div className="flex flex-wrap gap-tinyrack-sm">
                  <TRButton
                    appearance="outline"
                    disabled={revokeLoading}
                    intent="danger"
                    loading={revokeLoading}
                    onClick={() =>
                      handleRevoke(tokens.access_token, 'access_token')
                    }
                    uiSize="sm"
                  >
                    Revoke Access Token
                  </TRButton>
                  {tokens.refresh_token && (
                    <RefreshTokenRevokeButton
                      loading={revokeLoading}
                      onRevoke={handleRevoke}
                      refreshToken={tokens.refresh_token}
                    />
                  )}
                </div>

                {revokeError && (
                  <TRAlert.Root variant="danger">
                    <TRAlert.Description>{revokeError}</TRAlert.Description>
                  </TRAlert.Root>
                )}

                {revokeSuccess && (
                  <TRAlert.Root variant="success">
                    <TRAlert.Description>
                      Token revoked successfully
                    </TRAlert.Description>
                  </TRAlert.Root>
                )}
              </TRCard.Content>
            </TRCard.Root>
          </TRTabs.Panel>
        </TRTabs.Root>

        <div className="flex flex-wrap gap-tinyrack-lg">
          <TRButton intent="danger" onClick={handleLogout}>
            Logout
          </TRButton>
          <TRButton appearance="outline" render={<Link to="/discovery" />}>
            Discovery Endpoints
          </TRButton>
          <TRButton appearance="outline" render={<Link to="/" />}>
            Home
          </TRButton>
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
    <TRButton
      appearance="outline"
      disabled={loading}
      loading={loading}
      onClick={() => onIntrospect(refreshToken, 'refresh_token')}
      uiSize="sm"
    >
      Introspect Refresh Token
    </TRButton>
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
    <TRButton
      appearance="outline"
      disabled={loading}
      intent="danger"
      loading={loading}
      onClick={() => onRevoke(refreshToken, 'refresh_token')}
      uiSize="sm"
    >
      Revoke Refresh Token
    </TRButton>
  );
}
