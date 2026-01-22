export type TotpSetupStep = 'loading' | 'qr' | 'verify' | 'error';

export interface TotpSetupData {
  qr_code: string;
  secret: string;
}
