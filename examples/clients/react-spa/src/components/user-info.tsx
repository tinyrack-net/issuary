import { TRAvatar } from '@tinyrack/ui/components/avatar';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRCode } from '@tinyrack/ui/components/code';
import { TRSeparator } from '@tinyrack/ui/components/separator';
import type { IDTokenPayload } from '#example-react-spa/types/oidc.ts';

interface UserInfoProps {
  payload: IDTokenPayload;
}

export function UserInfo({ payload }: UserInfoProps) {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <TRCard.Root>
      <TRCard.Header>
        <TRCard.Title>User Information</TRCard.Title>
      </TRCard.Header>
      <TRCard.Content>
        <div className="flex items-start gap-tinyrack-lg">
          {payload.picture && (
            <TRAvatar.Root shape="circle" uiSize="lg">
              <TRAvatar.Image alt="Profile" src={payload.picture} />
            </TRAvatar.Root>
          )}

          <div className="flex-1 space-y-tinyrack-sm">
            {payload.name && (
              <div>
                <span className="font-tinyrack-strong">Name: </span>
                <span>{payload.name}</span>
              </div>
            )}

            {payload.email && (
              <div>
                <span className="font-tinyrack-strong">Email: </span>
                <span>{payload.email}</span>
                {payload.email_verified !== undefined && (
                  <TRBadge
                    className="ml-tinyrack-sm"
                    uiSize="md"
                    variant={payload.email_verified ? 'success' : 'warning'}
                  >
                    {payload.email_verified ? 'Verified' : 'Unverified'}
                  </TRBadge>
                )}
              </div>
            )}

            <div>
              <span className="font-tinyrack-strong">Subject (sub): </span>
              <TRCode>{payload.sub}</TRCode>
            </div>

            <div>
              <span className="font-tinyrack-strong">Issuer (iss): </span>
              <TRCode>{payload.iss}</TRCode>
            </div>

            <div>
              <span className="font-tinyrack-strong">Audience (aud): </span>
              <TRCode>{payload.aud}</TRCode>
            </div>
          </div>
        </div>

        <TRSeparator className="my-tinyrack-lg" />

        <div className="grid grid-cols-1 gap-tinyrack-sm text-tinyrack-sm md:grid-cols-2">
          <div>
            <span className="font-tinyrack-strong">Issued At (iat): </span>
            <span>{formatTimestamp(payload.iat)}</span>
          </div>

          <div>
            <span className="font-tinyrack-strong">Expires At (exp): </span>
            <span>{formatTimestamp(payload.exp)}</span>
          </div>

          {payload.auth_time && (
            <div>
              <span className="font-tinyrack-strong">Auth Time: </span>
              <span>{formatTimestamp(payload.auth_time)}</span>
            </div>
          )}

          {payload.nonce && (
            <div>
              <span className="font-tinyrack-strong">Nonce: </span>
              <TRCode>{payload.nonce}</TRCode>
            </div>
          )}
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}
