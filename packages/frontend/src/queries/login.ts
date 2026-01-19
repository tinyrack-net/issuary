import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import type { SecondFactorMethod } from '@/libs/oauth-search.js';
import type { SessionUser } from './session';

export type LoginParams = {
  email: string;
  password: string;
};

export type LoginResponse =
  | { status: 'success'; user: SessionUser }
  | { status: 'email_verification_required' }
  | { status: '2fa_required'; available_methods: SecondFactorMethod[] }
  | { status: '2fa_setup_required'; available_methods: SecondFactorMethod[] };

export const loginMutationOptions = mutationOptions({
  mutationFn: async (values: LoginParams) => {
    const res = await etch(`/api/v1/auth/login`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as LoginResponse;
  },
});
