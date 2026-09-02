import { TRAvatar } from '@tinyrack/ui/components/avatar';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRCode } from '@tinyrack/ui/components/code';
import { TRSeparator } from '@tinyrack/ui/components/separator';
import { TRText } from '@tinyrack/ui/components/text';
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
                <TRText as="span" className="font-tinyrack-strong">
                  Name:{' '}
                </TRText>
                <TRText as="span">{payload.name}</TRText>
              </div>
            )}

            {payload.email && (
              <div>
                <TRText as="span" className="font-tinyrack-strong">
                  Email:{' '}
                </TRText>
                <TRText as="span">{payload.email}</TRText>
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
              <TRText as="span" className="font-tinyrack-strong">
                Subject (sub):{' '}
              </TRText>
              <TRCode>{payload.sub}</TRCode>
            </div>

            <div>
              <TRText as="span" className="font-tinyrack-strong">
                Issuer (iss):{' '}
              </TRText>
              <TRCode>{payload.iss}</TRCode>
            </div>

            <div>
              <TRText as="span" className="font-tinyrack-strong">
                Audience (aud):{' '}
              </TRText>
              <TRCode>{payload.aud}</TRCode>
            </div>
          </div>
        </div>

        <TRSeparator className="my-tinyrack-lg" />

        <div className="grid grid-cols-1 gap-tinyrack-sm text-tinyrack-sm md:grid-cols-2">
          <div>
            <TRText as="span" className="font-tinyrack-strong">
              Issued At (iat):{' '}
            </TRText>
            <TRText as="span">{formatTimestamp(payload.iat)}</TRText>
          </div>

          <div>
            <TRText as="span" className="font-tinyrack-strong">
              Expires At (exp):{' '}
            </TRText>
            <TRText as="span">{formatTimestamp(payload.exp)}</TRText>
          </div>

          {payload.auth_time && (
            <div>
              <TRText as="span" className="font-tinyrack-strong">
                Auth Time:{' '}
              </TRText>
              <TRText as="span">{formatTimestamp(payload.auth_time)}</TRText>
            </div>
          )}

          {payload.nonce && (
            <div>
              <TRText as="span" className="font-tinyrack-strong">
                Nonce:{' '}
              </TRText>
              <TRCode>{payload.nonce}</TRCode>
            </div>
          )}
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}
