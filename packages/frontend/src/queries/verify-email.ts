import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import type { AuthResponse } from './session.js';

export type VerifyEmailParams = {
  token: string;
};

export type VerifyEmailResponse = AuthResponse;

export const verifyEmailMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyEmailParams) => {
    const res = await etch(`/api/v1/auth/email/verify`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as VerifyEmailResponse;
  },
});

export type ResendVerificationParams = {
  email: string;
};

export type ResendVerificationResponse = {
  message: string;
};

export const resendVerificationMutationOptions = mutationOptions({
  mutationFn: async (values: ResendVerificationParams) => {
    const res = await etch(`/api/v1/auth/email/resend`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as ResendVerificationResponse;
  },
});
