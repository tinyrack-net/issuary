import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import type { AuthResponse } from './session.js';

export type RegisterParams = {
  email: string;
  password: string;
};

// Register uses the unified AuthResponse type
export type RegisterResponse = AuthResponse;

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
