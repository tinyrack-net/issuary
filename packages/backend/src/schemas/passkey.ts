import z from 'zod/v4';

/**
 * Passkey information for user passkey list
 * Used to display registered passkeys to the user
 */
const PasskeyInfo = z
  .object({
    /** Passkey entity ID */
    id: z.string(),
    /** WebAuthn credential ID */
    credential_id: z.string(),
    /** User-defined name for the passkey */
    name: z.string().nullable(),
    /** Device type: single device or multi-device (synced) */
    device_type: z.enum(['singleDevice', 'multiDevice']),
    /** Whether the passkey is backed up (synced to cloud) */
    backed_up: z.boolean(),
    /** When the passkey was registered */
    created_at: z.date(),
  })
  .describe('Passkey information for display');

/**
 * Passkey related schemas namespace
 * Usage: import { passkeySchema } from '@/schemas/passkey.js'
 * Type inference: type PasskeyInfo = z.infer<typeof passkeySchema.PasskeyInfo>
 */
export const passkeySchema = {
  PasskeyInfo,
};
