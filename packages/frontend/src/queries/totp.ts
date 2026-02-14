import { api, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

export type TotpSetupResponse = InferResponseType<
  (typeof api.api.v1.user.totp.setup)['$post'],
  200
>;

export type TotpSetupVerifyResponse = InferResponseType<
  (typeof api.api.v1.user.totp.verify)['$post'],
  200
>;

export type TotpConfirmResponse = InferResponseType<
  (typeof api.api.v1.user.totp.confirm)['$post'],
  200
>;

export type TotpLoginVerifyResponse = InferResponseType<
  (typeof api.api.v1.auth.totp.verify)['$post'],
  200
>;

/**
 * Start TOTP setup - generates secret and QR code
 */
export const startTotpSetupMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await api.api.v1.user.totp.setup.$post();
    return jsonOk(res);
  },
});

/**
 * Verify TOTP code during setup (returns recovery codes)
 */
export type VerifyTotpParams = InferRequestType<
  (typeof api.api.v1.user.totp.verify)['$post']
>['json'];

export const verifyTotpMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyTotpParams) => {
    const res = await api.api.v1.user.totp.verify.$post({
      json: values,
    });
    return jsonOk(res);
  },
});

/**
 * Confirm TOTP setup after user acknowledges recovery
 * codes
 */
export const confirmTotpSetupMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await api.api.v1.user.totp.confirm.$post({
      json: {},
    });
    return jsonOk(res);
  },
});

/**
 * Disable TOTP authentication
 */
export type DisableTotpParams = InferRequestType<
  (typeof api.api.v1.user.totp)['$delete']
>['json'];

export const disableTotpMutationOptions = mutationOptions({
  mutationFn: async (values: DisableTotpParams) => {
    const res = await api.api.v1.user.totp.$delete({
      json: values,
    });
    return jsonOk(res);
  },
});

/**
 * Verify TOTP code during login (complete 2FA login)
 */
export type VerifyTotpLoginParams = InferRequestType<
  (typeof api.api.v1.auth.totp.verify)['$post']
>['json'];

export const verifyTotpLoginMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyTotpLoginParams) => {
    const res = await api.api.v1.auth.totp.verify.$post({
      json: values,
    });
    return jsonOk(res);
  },
});

/**
 * Verify recovery code during login (complete 2FA login)
 */
export type VerifyRecoveryCodeParams = InferRequestType<
  (typeof api.api.v1.auth.totp.recovery.verify)['$post']
>['json'];

export type VerifyRecoveryCodeResponse = InferResponseType<
  (typeof api.api.v1.auth.totp.recovery.verify)['$post'],
  200
>;

export const verifyRecoveryCodeMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyRecoveryCodeParams) => {
    const res = await api.api.v1.auth.totp.recovery.verify.$post({
      json: values,
    });
    return jsonOk(res);
  },
});
