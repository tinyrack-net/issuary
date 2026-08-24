import type { IssuaryRuntimeConfig } from '@tinyrack/issuary-server/config';

export async function resolveTestEmailConfig(): Promise<
  NonNullable<IssuaryRuntimeConfig['email']>
> {
  return {
    from: 'no-reply@test.local',
    createTransport: async () => ({
      sendMail: async (message) => ({
        accepted: [message.to],
        rejected: [],
        envelope: {
          from: message.from ?? 'no-reply@test.local',
          to: [message.to],
        },
        messageId: 'frontend-e2e-test-email',
      }),
    }),
  };
}
