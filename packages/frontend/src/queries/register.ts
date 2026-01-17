import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import type { SessionUser } from './session.js';

export type RegisterParams = {
  email: string;
  password: string;
};

export type RegisterResponse = {
  user: SessionUser;
  second_factor_setup_required?: boolean;
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
