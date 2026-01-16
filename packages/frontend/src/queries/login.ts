import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import type { SessionUser } from './session';

export type LoginParams = {
  email: string;
  password: string;
};

export type SecondFactorMethod = 'totp' | 'passkey';

export type LoginResponse =
  | {
      second_factor_required: false;
      totp_setup_required: false;
      email_verification_required: false;
      user: SessionUser;
    }
  | {
      second_factor_required: true;
      available_methods: SecondFactorMethod[];
      totp_setup_required: false;
      email_verification_required: false;
    }
  | {
      second_factor_required: false;
      totp_setup_required: true;
      email_verification_required: false;
    }
  | {
      second_factor_required: false;
      totp_setup_required: false;
      email_verification_required: true;
      email: string;
    };

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
