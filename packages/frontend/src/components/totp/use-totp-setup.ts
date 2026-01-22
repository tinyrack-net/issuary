import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionQueryOptions } from '@/queries/session.js';
import {
  startTotpSetupMutationOptions,
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
  autoStart?: boolean;
}

export interface UseTotpSetupReturn {
  step: TotpSetupStep;
  setupData: TotpSetupResponse | null;
  isSetupPending: boolean;
  isVerifyPending: boolean;
  isPending: boolean;
  setupError: Error | null;
  verifyError: Error | null;
  startSetup: () => void;
  verify: (code: string) => Promise<TotpSetupVerifyResponse>;
  goToQr: () => void;
  goToVerify: () => void;
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
    autoStart = false,
  } = options;

  const queryClient = useQueryClient();
  const [step, setStep] = useState<TotpSetupStep>(autoStart ? 'loading' : 'qr');
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
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
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
      onVerifySuccess?.(data);
    },
    onError: (error) => {
      onVerifyError?.(error);
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

  const reset = useCallback(() => {
    setStep(autoStart ? 'loading' : 'qr');
    setSetupData(null);
    setupInitiatedRef.current = false;
    setupMutation.reset();
    verifyMutation.reset();
  }, [autoStart, setupMutation, verifyMutation]);

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
    isSetupPending: setupMutation.isPending,
    isVerifyPending: verifyMutation.isPending,
    isPending: setupMutation.isPending || verifyMutation.isPending,
    setupError: setupMutation.error,
    verifyError: verifyMutation.error,
    startSetup,
    verify,
    goToQr,
    goToVerify,
    reset,
  };
}
