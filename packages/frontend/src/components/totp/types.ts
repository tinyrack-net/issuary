export type TotpSetupStep = 'loading' | 'qr' | 'verify' | 'recovery' | 'error';

export interface TotpSetupData {
  qr_code: string;
  secret: string;
}
