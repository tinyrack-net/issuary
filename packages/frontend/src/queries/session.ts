import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import { queryKeys } from './keys';

export type SessionUser = {
  id: string;
  managed_by: 'config' | 'database';
  email: string;
  email_verified: boolean;
  email_verification_required: boolean;
  has_password: boolean;
  totp_registered: boolean;
  second_factor_required: boolean;
  passkey_count: number;
};

export type AuthResponse = {
  user?: SessionUser;
};

export const getSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: async () => {
    const response = await etch('/api/v1/user/session');
    return response.json() as Promise<AuthResponse>;
  },
});
