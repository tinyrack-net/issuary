import z from 'zod/v4';

/**
 * TOTP setup data returned when initiating 2FA setup
 * Contains all information needed to display QR code and manual entry
 */
const TotpSetupData = z
  .object({
    /** Base32-encoded TOTP secret key */
    secret: z.string(),
    /** OTPAuth URL for authenticator apps (otpauth://totp/...) */
    otpauthUrl: z.string(),
    /** QR code as data URL (data:image/png;base64,...) */
    qrCodeDataUrl: z.string(),
  })
  .describe('TOTP setup data for 2FA enrollment');

/**
 * TOTP related schemas namespace
 * Usage: import { totpSchema } from '@/schemas/totp.js'
 * Type inference: type TotpSetupData = z.infer<typeof totpSchema.TotpSetupData>
 */
export const totpSchema = {
  TotpSetupData,
};
