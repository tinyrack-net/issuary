import { render } from '@react-email/render';
import type { Locale } from '../lib/locale.ts';
import { getTranslations } from './i18n/index.ts';
import {
  PasswordResetEmail,
  type PasswordResetEmailProps,
} from './templates/password-reset.tsx';
import {
  VerificationEmail,
  type VerificationEmailProps,
} from './templates/verification.tsx';

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export const renderVerificationEmail = async (
  props: VerificationEmailProps,
): Promise<RenderedEmail> => {
  const t = getTranslations(props.locale).verification;
  const html = await render(<VerificationEmail {...props} />);
  const text = await render(<VerificationEmail {...props} />, {
    plainText: true,
  });
  return { html, text, subject: t.subject };
};

export const renderPasswordResetEmail = async (
  props: PasswordResetEmailProps,
): Promise<RenderedEmail> => {
  const t = getTranslations(props.locale).passwordReset;
  const html = await render(<PasswordResetEmail {...props} />);
  const text = await render(<PasswordResetEmail {...props} />, {
    plainText: true,
  });
  return { html, text, subject: t.subject };
};

export type { Locale };
