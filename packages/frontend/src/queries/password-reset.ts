import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';

export type ForgotPasswordParams = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
};

export const forgotPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ForgotPasswordParams) => {
    const res = await etch(`/api/v1/user/forgot-password`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as ForgotPasswordResponse;
  },
});

export type ResetPasswordParams = {
  token: string;
  password: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export const resetPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ResetPasswordParams) => {
    const res = await etch(`/api/v1/user/reset-password`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as ResetPasswordResponse;
  },
});
