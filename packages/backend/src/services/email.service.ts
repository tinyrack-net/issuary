import {
  renderPasswordResetEmail,
  renderVerificationEmail,
} from '@backend/emails/render.js';
import type { IEmailVerificationEntity } from '@backend/entities/email-verification.entity.js';
import type { UserEntity } from '@backend/entities/user.entity.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { DEFAULT_LOCALE, type Locale } from '@backend/lib/locale.js';
import { e } from '@backend/schemas/error.js';
import type { MikroService } from '@backend/services/mikro.service.js';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

export class EmailService {
  private readonly transporter: nodemailer.Transporter<
    SMTPTransport.SentMessageInfo,
    SMTPTransport.Options
  > | null;

  public constructor(
    private readonly config: ResolvedAppConfig,
    private readonly mikro: MikroService,
    options?: { silent?: boolean },
  ) {
    const silent = options?.silent ?? false;
    if (config.smtp) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.password,
        },
      });
      if (!silent) {
        console.info(
          'Nodemailer initialized (host: %s, port: %d)',
          config.smtp.host,
          config.smtp.port,
        );
      }
    } else {
      this.transporter = null;
      if (!silent) {
        console.warn('Nodemailer: no SMTP config, emails disabled');
      }
    }
  }

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

  /**
   * Generate email verification token for a user.
   * Invalidates all previous unverified tokens.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async generateToken(params: {
    userId: string;
    expiresInHours?: number;
  }): Promise<IEmailVerificationEntity> {
    if (!this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }
    const token = await this.mikro.emailVerification.generateToken({
      userId: params.userId,
      expiresInHours: params.expiresInHours || 24,
    });
    return token;
  }

  /**
   * Verify email with token.
   * Marks user's email as verified.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async verifyEmail(token: string): Promise<UserEntity> {
    if (!this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }
    const verification = await this.mikro.emailVerification.verifyToken(token);
    if (!verification) {
      throw new e.InvalidVerificationToken.Error();
    }
    const user = await verification.user.load();
    if (!user) {
      throw new e.UserNotFound.Error();
    }
    user.email_verified = true;
    await this.mikro.em.flush();
    return user;
  }

  /**
   * Resend verification email.
   * Generates new token and returns it.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async resendVerification(
    email: string,
  ): Promise<IEmailVerificationEntity> {
    if (!this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }
    const user = await this.mikro.user.findOneOrFail(
      { email },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );
    if (user.email_verified) {
      throw new e.EmailAlreadyVerified.Error();
    }
    const token = await this.generateToken({ userId: user.id });
    await this.mikro.em.flush();
    return token;
  }

  /**
   * Check if user has pending verification.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async hasPendingVerification(userId: string): Promise<boolean> {
    if (!this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }
    const count = await this.mikro.emailVerification.count({
      user: { id: userId },
      verified: false,
      expiresAt: { $gt: new Date() },
    });
    return count > 0;
  }
}
