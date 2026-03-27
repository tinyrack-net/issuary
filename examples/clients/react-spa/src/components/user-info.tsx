import type { IDTokenPayload } from '#example-react-spa/types/oidc.ts';

interface UserInfoProps {
  payload: IDTokenPayload;
}

export function UserInfo({ payload }: UserInfoProps) {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">User Information</h2>

        <div className="flex items-start gap-4">
          {payload.picture && (
            <div className="avatar">
              <div className="w-16 rounded-full">
                <img alt="Profile" src={payload.picture} />
              </div>
            </div>
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
                  <span
                    className={`badge badge-sm ml-2 ${payload.email_verified ? 'badge-success' : 'badge-warning'}`}
                  >
                    {payload.email_verified ? 'Verified' : 'Unverified'}
                  </span>
                )}
              </div>
            )}

            <div>
              <span className="font-semibold">Subject (sub): </span>
              <code className="text-sm">{payload.sub}</code>
            </div>

            <div>
              <span className="font-semibold">Issuer (iss): </span>
              <code className="text-sm">{payload.iss}</code>
            </div>

            <div>
              <span className="font-semibold">Audience (aud): </span>
              <code className="text-sm">{payload.aud}</code>
            </div>
          </div>
        </div>

        <div className="divider" />

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
              <code className="text-xs">{payload.nonce}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
