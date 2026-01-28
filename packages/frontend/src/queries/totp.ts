import { mutationOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch.js';
import type { OkResponse, SessionUser } from './session.js';

export type TotpSetupResponse = {
  secret: string;
  otpauth_url: string;
  qr_code: string;
};

export type TotpSetupVerifyResponse = {
  recovery_codes: string[];
};

export type TotpConfirmResponse = {
  user: SessionUser;
};

export type TotpLoginVerifyResponse = {
  user: SessionUser;
};

/**
 * Start TOTP setup - generates secret and QR code
 */
export const startTotpSetupMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await etch('/api/v1/user/totp/setup', {
      method: 'POST',
    });
    return res.json() as Promise<TotpSetupResponse>;
  },
});

/**
 * Verify TOTP code during setup (returns recovery codes)
 */
export type VerifyTotpParams = {
  code: string;
};

export const verifyTotpMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyTotpParams) => {
    const res = await etch('/api/v1/user/totp/verify', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    return res.json() as Promise<TotpSetupVerifyResponse>;
  },
});

/**
 * Confirm TOTP setup after user acknowledges recovery codes
 */
export const confirmTotpSetupMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await etch('/api/v1/user/totp/confirm', {
      method: 'POST',
    });
    return res.json() as Promise<TotpConfirmResponse>;
  },
});

/**
 * Disable TOTP authentication
 */
export type DisableTotpParams = {
  code: string;
};

export const disableTotpMutationOptions = mutationOptions({
  mutationFn: async (values: DisableTotpParams) => {
    const res = await etch('/api/v1/user/totp', {
      method: 'DELETE',
      body: JSON.stringify(values),
    });
    return res.json() as Promise<OkResponse>;
  },
});

/**
 * Verify TOTP code during login (complete 2FA login)
 */
export type VerifyTotpLoginParams = {
  code: string;
};

export const verifyTotpLoginMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyTotpLoginParams) => {
    const res = await etch('/api/v1/auth/totp/verify', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    return res.json() as Promise<TotpLoginVerifyResponse>;
  },
});

/**
 * Verify recovery code during login (complete 2FA login)
 */
export type VerifyRecoveryCodeParams = {
  code: string;
};

export type VerifyRecoveryCodeResponse = {
  user: SessionUser;
};

export const verifyRecoveryCodeMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyRecoveryCodeParams) => {
    const res = await etch('/api/v1/auth/totp/recovery/verify', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    return res.json() as Promise<VerifyRecoveryCodeResponse>;
  },
});
