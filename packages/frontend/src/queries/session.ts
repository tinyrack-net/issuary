import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import { queryKeys } from './keys';

export type SessionUser = {
  id: string;
  managed: 'config' | 'database';
  email: string;
  email_verified: boolean;
  has_password: boolean;
  totp_enabled: boolean;
  passkey_count: number;
};

export type SessionResponse = {
  user: SessionUser | null;
};

export const getSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: async () => {
    const response = await etch('/api/v1/user/session');
    return response.json() as Promise<SessionResponse>;
  },
});
