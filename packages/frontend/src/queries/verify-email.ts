import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import type { SessionUser } from './session';

export type VerifyEmailParams = {
  token: string;
};

export type VerifyEmailResponse = {
  user: SessionUser;
  message: string;
};

export const verifyEmailMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyEmailParams) => {
    const res = await etch(`/api/v1/user/verify-email`, {
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
    const res = await etch(`/api/v1/user/resend-verification`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return data as ResendVerificationResponse;
  },
});
