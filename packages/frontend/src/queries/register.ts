import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import type { SecondFactorMethod, SessionUser } from './session.js';

export type RegisterParams = {
  email: string;
  password: string;
};

export type RegisterResponse =
  | { status: 'success'; user: SessionUser }
  | { status: 'email_verification_required'; user: SessionUser }
  | {
      status: '2fa_setup_required';
      user: SessionUser;
      available_methods: SecondFactorMethod[];
    };

export const registerMutationOptions = mutationOptions({
  mutationFn: async (values: RegisterParams) => {
    const res = await etch(`/api/v1/auth/register`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as RegisterResponse;
  },
});
