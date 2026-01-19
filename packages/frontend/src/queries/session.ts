import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import { queryKeys } from './keys';

export type SessionUser = {
  id: string;
  managed_by: 'config' | 'database';
  email: string;
  email_verified: boolean;
  has_password: boolean;
  totp_enabled: boolean;
  second_factor_required: boolean;
  passkey_count: number;
};

export type SecondFactorMethod = 'totp' | 'passkey';

export type SessionResponse =
  | { status: 'authenticated'; user: SessionUser }
  | {
      status: '2fa_setup_required';
      user: SessionUser;
      available_methods: SecondFactorMethod[];
    }
  | { status: 'unauthenticated' };

export const getSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: async () => {
    const response = await etch('/api/v1/user/session');
    return response.json() as Promise<SessionResponse>;
  },
});
