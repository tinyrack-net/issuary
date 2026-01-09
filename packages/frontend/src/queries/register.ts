import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import type { SessionUser } from './session';

export type RegisterParams = {
  email: string;
  password: string;
};

export type RegisterResponse = {
  user: SessionUser;
};

export const registerMutationOptions = mutationOptions({
  mutationFn: async (values: RegisterParams) => {
    const res = await etch(`/api/v1/user/register`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as RegisterResponse;
  },
});
