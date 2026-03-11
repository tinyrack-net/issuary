import type { TinyAuthRuntimeConfig } from '@tinyauth/backend/config';
import { nodemailer } from '@tinyauth/backend/mail/nodemailer';
import nm from 'nodemailer';

export async function resolveTestEmailConfig(): Promise<
  NonNullable<TinyAuthRuntimeConfig['email']>
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
