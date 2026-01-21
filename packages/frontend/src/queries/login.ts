import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import type { SessionUser } from './session.js';

export type LoginParams = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: SessionUser;
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
