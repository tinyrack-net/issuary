import type { ResolvedAppConfig } from '@tinyauth/backend/config';
import { smtp } from '@tinyauth/backend/mail';

interface TestAccount {
  smtp: { host: string; port: number; secure: boolean };
  user: string;
  pass: string;
}

export async function resolveTestSmtp(): Promise<
  NonNullable<ResolvedAppConfig['smtp']>
> {
  // Dynamic import to avoid TypeScript needing @types/nodemailer
  // nodemailer is available at runtime via @tinyauth/backend
  const nodemailerModule = (await Function(
    'return import("nodemailer")',
  )()) as { default: { createTestAccount(): Promise<TestAccount> } };
  const testAccount = await nodemailerModule.default.createTestAccount();
  return smtp({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    user: testAccount.user,
    password: testAccount.pass,
    from: testAccount.user,
    test: true,
  });
}
