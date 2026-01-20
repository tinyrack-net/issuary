import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import { queryKeys } from './keys';

export type SessionUser = {
  id: string;
  managed_by: 'config' | 'database';
  email: string;
  email_verified: boolean;
  has_password: boolean;
  totp_registered: boolean;
  second_factor_required: boolean;
  passkey_count: number;
};

export type SecondFactorMethod = 'totp' | 'passkey';

// Unified auth response type - user info is only provided when authenticated
export type AuthResponse =
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'unauthenticated' }
  | { status: 'email_verification_required' }
  | { status: '2fa_required'; available_methods: SecondFactorMethod[] }
  | { status: '2fa_setup_required'; available_methods: SecondFactorMethod[] };

// Alias for backward compatibility
export type SessionResponse = AuthResponse;

export const getSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: async () => {
    const response = await etch('/api/v1/user/session');
    return response.json() as Promise<AuthResponse>;
  },
});
