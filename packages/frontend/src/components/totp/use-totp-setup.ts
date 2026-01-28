import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionQueryOptions } from '@/queries/session.js';
import {
  confirmTotpSetupMutationOptions,
  startTotpSetupMutationOptions,
  type TotpConfirmResponse,
  type TotpSetupResponse,
  type TotpSetupVerifyResponse,
  verifyTotpMutationOptions,
} from '@/queries/totp.js';
import type { TotpSetupStep } from './types.js';

export interface UseTotpSetupOptions {
  onSetupSuccess?: (data: TotpSetupResponse) => void;
  onSetupError?: (error: Error) => void;
  onVerifySuccess?: (data: TotpSetupVerifyResponse) => void;
  onVerifyError?: (error: Error) => void;
  onConfirmSuccess?: (data: TotpConfirmResponse) => void;
  onConfirmError?: (error: Error) => void;
  autoStart?: boolean;
}

export interface UseTotpSetupReturn {
  step: TotpSetupStep;
  setupData: TotpSetupResponse | null;
  recoveryCodes: string[];
  isSetupPending: boolean;
  isVerifyPending: boolean;
  isConfirmPending: boolean;
  isPending: boolean;
  setupError: Error | null;
  verifyError: Error | null;
  confirmError: Error | null;
  startSetup: () => void;
  verify: (code: string) => Promise<TotpSetupVerifyResponse>;
  goToQr: () => void;
  goToVerify: () => void;
  confirmRecoveryCodes: () => Promise<TotpConfirmResponse>;
  reset: () => void;
}

export function useTotpSetup(
  options: UseTotpSetupOptions = {},
): UseTotpSetupReturn {
  const {
    onSetupSuccess,
    onSetupError,
    onVerifySuccess,
    onVerifyError,
    onConfirmSuccess,
    onConfirmError,
    autoStart = false,
  } = options;

  const queryClient = useQueryClient();
  const [step, setStep] = useState<TotpSetupStep>(autoStart ? 'loading' : 'qr');
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const setupInitiatedRef = useRef(false);

  const setupMutation = useMutation({
    ...startTotpSetupMutationOptions,
    onSuccess: (data) => {
      setSetupData(data);
      setStep('qr');
      onSetupSuccess?.(data);
    },
    onError: (error) => {
      setStep('error');
      onSetupError?.(error);
    },
  });

  const verifyMutation = useMutation({
    ...verifyTotpMutationOptions,
    onSuccess: (data) => {
      // Do NOT invalidate session here - TOTP is not fully enabled yet
      setRecoveryCodes(data.recovery_codes);
      setStep('recovery');
      onVerifySuccess?.(data);
    },
    onError: (error) => {
      onVerifyError?.(error);
    },
  });

  const confirmMutation = useMutation({
    ...confirmTotpSetupMutationOptions,
    onSuccess: (data) => {
      // Now TOTP is fully enabled, invalidate session
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      onConfirmSuccess?.(data);
    },
    onError: (error) => {
      onConfirmError?.(error);
    },
  });

  const startSetup = useCallback(() => {
    setupInitiatedRef.current = true;
    setStep('loading');
    setupMutation.mutate();
  }, [setupMutation]);

  const verify = useCallback(
    async (code: string) => {
      return verifyMutation.mutateAsync({ code });
    },
    [verifyMutation],
  );

  const goToQr = useCallback(() => {
    setStep('qr');
  }, []);

  const goToVerify = useCallback(() => {
    setStep('verify');
  }, []);

  const confirmRecoveryCodes = useCallback(async () => {
    return confirmMutation.mutateAsync();
  }, [confirmMutation]);

  const reset = useCallback(() => {
    setStep(autoStart ? 'loading' : 'qr');
    setSetupData(null);
    setRecoveryCodes([]);
    setupInitiatedRef.current = false;
    setupMutation.reset();
    verifyMutation.reset();
    confirmMutation.reset();
  }, [autoStart, setupMutation, verifyMutation, confirmMutation]);

  // Auto start setup on mount if enabled
  useEffect(() => {
    if (autoStart && !setupInitiatedRef.current && step === 'loading') {
      setupInitiatedRef.current = true;
      setupMutation.mutate();
    }
  }, [autoStart, step, setupMutation]);

  return {
    step,
    setupData,
    recoveryCodes,
    isSetupPending: setupMutation.isPending,
    isVerifyPending: verifyMutation.isPending,
    isConfirmPending: confirmMutation.isPending,
    isPending:
      setupMutation.isPending ||
      verifyMutation.isPending ||
      confirmMutation.isPending,
    setupError: setupMutation.error,
    verifyError: verifyMutation.error,
    confirmError: confirmMutation.error,
    startSetup,
    verify,
    goToQr,
    goToVerify,
    confirmRecoveryCodes,
    reset,
  };
}
