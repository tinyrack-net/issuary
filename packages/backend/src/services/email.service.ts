import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import {
  renderPasswordResetEmail,
  renderVerificationEmail,
} from '@/emails/render.js';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
import { DEFAULT_LOCALE, type Locale } from '@/lib/locale.js';
import { e } from '@/schemas/error.js';

export class EmailService {
  public constructor(
    private readonly config: ResolvedAppConfig,
    private readonly transporter: nodemailer.Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    > | null,
  ) {}

  /**
   * Get the localized application name from app.title config.
   * Falls back through: specified locale -> fallback_language -> DEFAULT_LOCALE -> 'TinyAuth'
   */
  private getAppName(locale?: Locale): string {
    const title = this.config.app.title;
    if (!title) {
      return 'TinyAuth';
    }

    const localeKey = locale ?? DEFAULT_LOCALE;
    return (
      title[localeKey] ??
      title[this.config.app.fallback_language] ??
      title[DEFAULT_LOCALE] ??
      'TinyAuth'
    );
  }

  public async sendVerificationEmail(params: {
    email: string;
    token: string;
    locale?: Locale | undefined;
  }): Promise<SMTPTransport.SentMessageInfo> {
    if (!this.transporter || !this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }

    const verificationUrl = `${this.config.app.host}/verify/email?token=${params.token}`;

    const { html, text, subject } = await renderVerificationEmail({
      verificationUrl,
      token: params.token,
      locale: params.locale,
      appName: this.getAppName(params.locale),
    });

    const info = await this.transporter.sendMail({
      from: this.config.smtp.from,
      to: params.email,
      subject,
      text,
      html,
    });

    console.info('Email sent: %s', info.messageId);

    if (this.config.smtp.test) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.info('Preview URL: %s', previewUrl);
      }
    }

    return info;
  }

  public sendVerificationEmailAsync(params: {
    email: string;
    token: string;
    locale?: Locale | undefined;
  }): void {
    this.sendVerificationEmail(params).catch((err) => {
      console.error('Failed to send verification email:', err);
    });
  }

  public async sendPasswordResetEmail(params: {
    email: string;
    token: string;
    locale?: Locale | undefined;
  }): Promise<SMTPTransport.SentMessageInfo> {
    if (!this.transporter || !this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }

    const resetUrl = `${this.config.app.host}/password/reset?token=${params.token}`;

    const { html, text, subject } = await renderPasswordResetEmail({
      resetUrl,
      token: params.token,
      locale: params.locale,
      appName: this.getAppName(params.locale),
    });

    const info = await this.transporter.sendMail({
      from: this.config.smtp.from,
      to: params.email,
      subject,
      text,
      html,
    });

    console.info('Password reset email sent: %s', info.messageId);

    if (this.config.smtp.test) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.info('Preview URL: %s', previewUrl);
      }
    }

    return info;
  }

  /**
   * Send password reset email asynchronously (fire-and-forget)
   * Logs errors but does not throw
   */
  public sendPasswordResetEmailAsync(params: {
    email: string;
    token: string;
    locale?: Locale | undefined;
  }): void {
    this.sendPasswordResetEmail(params).catch((err) => {
      console.error('Failed to send password reset email:', err);
    });
  }
}
