import type { ResolvedAppConfig } from '@tinyauth/backend/config';
import { nodemailer } from '@tinyauth/backend/mail/nodemailer';
import nm from 'nodemailer';

export async function resolveTestMailConfig(): Promise<
  NonNullable<ResolvedAppConfig['mail']>
> {
  const testAccount = await nm.createTestAccount();
  return nodemailer({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    user: testAccount.user,
    password: testAccount.pass,
    from: testAccount.user,
    test: true,
  });
}
