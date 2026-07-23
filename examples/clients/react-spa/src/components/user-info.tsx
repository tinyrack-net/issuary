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
        <div className="flex items-start gap-4">
          {payload.picture && (
            <TRAvatar.Root shape="circle" uiSize="lg">
              <TRAvatar.Image alt="Profile" src={payload.picture} />
            </TRAvatar.Root>
          )}

          <div className="flex-1 space-y-2">
            {payload.name && (
              <div>
                <span className="font-semibold">Name: </span>
                <span>{payload.name}</span>
              </div>
            )}

            {payload.email && (
              <div>
                <span className="font-semibold">Email: </span>
                <span>{payload.email}</span>
                {payload.email_verified !== undefined && (
                  <TRBadge
                    className="ml-2"
                    uiSize="sm"
                    variant={payload.email_verified ? 'success' : 'warning'}
                  >
                    {payload.email_verified ? 'Verified' : 'Unverified'}
                  </TRBadge>
                )}
              </div>
            )}

            <div>
              <span className="font-semibold">Subject (sub): </span>
              <TRCode>{payload.sub}</TRCode>
            </div>

            <div>
              <span className="font-semibold">Issuer (iss): </span>
              <TRCode>{payload.iss}</TRCode>
            </div>

            <div>
              <span className="font-semibold">Audience (aud): </span>
              <TRCode>{payload.aud}</TRCode>
            </div>
          </div>
        </div>

        <TRSeparator className="my-4" />

        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div>
            <span className="font-semibold">Issued At (iat): </span>
            <span>{formatTimestamp(payload.iat)}</span>
          </div>

          <div>
            <span className="font-semibold">Expires At (exp): </span>
            <span>{formatTimestamp(payload.exp)}</span>
          </div>

          {payload.auth_time && (
            <div>
              <span className="font-semibold">Auth Time: </span>
              <span>{formatTimestamp(payload.auth_time)}</span>
            </div>
          )}

          {payload.nonce && (
            <div>
              <span className="font-semibold">Nonce: </span>
              <TRCode>{payload.nonce}</TRCode>
            </div>
          )}
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}
