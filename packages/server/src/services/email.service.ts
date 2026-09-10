import {
  renderPasswordResetEmail,
  renderVerificationEmail,
} from '../emails/render.tsx';
import type { IEmailVerificationEntity } from '../entities/email-verification.entity.ts';
import type { UserEntity } from '../entities/user.entity.ts';
import type {
  EmailTransport,
  IssuaryRuntimeConfig,
} from '../lib/config/index.ts';
import { DEFAULT_LOCALE, type Locale } from '../lib/locale.ts';
import type { Logger } from '../lib/logger.ts';
import { e } from '../schemas/error.ts';
import type { MikroService } from './mikro.service.ts';
import { withUserSecurity } from './user-security.service.js';

export class EmailService {
  private readonly transporter: Promise<EmailTransport> | null;

  private readonly config: IssuaryRuntimeConfig;
  private readonly mikro: MikroService;
  private readonly logger: Logger;
  public constructor(
    config: IssuaryRuntimeConfig,
    mikro: MikroService,
    logger: Logger,
  ) {
    this.config = config;
    this.mikro = mikro;
    this.logger = logger;
    if (config.email) {
      this.transporter = config.email.createTransport();
      this.logger.info('Email transport initialized');
    } else {
      this.transporter = null;
      this.logger.warn('Email disabled: no email config');
    }
  }

  /**
   * Get the localized application name from branding.title config.
   * Falls back through: specified locale -> fallback_language -> DEFAULT_LOCALE -> 'Issuary'
   */
  private getAppName(locale?: Locale): string {
    const title = this.config.branding.title;
    if (!title) {
      return 'Issuary';
    }

    const localeKey = locale ?? DEFAULT_LOCALE;
    return (
      title[localeKey] ??
      title[this.config.i18n.fallback_language] ??
      title[DEFAULT_LOCALE] ??
      'Issuary'
    );
  }

  public async sendVerificationEmail(params: {
    email: string;
    token: string;
    locale?: Locale | undefined;
    messageId?: string | undefined;
  }): Promise<void> {
    if (!this.config.email || !this.transporter) {
      throw new e.EmailNotActivated.Error();
    }
    const transporter = await this.transporter;

    const verificationUrl = `${this.config.server.public_origin}/verify/email?token=${params.token}`;

    const { html, text, subject } = await renderVerificationEmail({
      verificationUrl,
      token: params.token,
      locale: params.locale,
      appName: this.getAppName(params.locale),
    });

    await transporter.sendMail({
      from: this.config.email.from,
      to: params.email,
      messageId: params.messageId,
      subject,
      text,
      html,
    });

    this.logger.info('Verification email sent');
  }

  public async sendPasswordResetEmail(params: {
    email: string;
    token: string;
    locale?: Locale | undefined;
    messageId?: string | undefined;
  }): Promise<void> {
    if (!this.config.email || !this.transporter) {
      throw new e.EmailNotActivated.Error();
    }
    const transporter = await this.transporter;

    const resetUrl = `${this.config.server.public_origin}/password/reset?token=${params.token}`;

    const { html, text, subject } = await renderPasswordResetEmail({
      resetUrl,
      token: params.token,
      locale: params.locale,
      appName: this.getAppName(params.locale),
    });

    await transporter.sendMail({
      from: this.config.email.from,
      to: params.email,
      messageId: params.messageId,
      subject,
      text,
      html,
    });

    this.logger.info('Password reset email sent');
  }

  /**
   * Generate email verification token for a user.
   * Invalidates all previous unverified tokens.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async generateToken(params: {
    userSub: string;
    expiresInHours?: number;
  }): Promise<IEmailVerificationEntity> {
    if (!this.config.email) {
      throw new e.EmailNotActivated.Error();
    }
    return withUserSecurity(this.mikro, params.userSub, async (user) => {
      const token = await this.mikro.emailVerification.generateToken({
        userSub: params.userSub,
        userEpoch: user.token_epoch,
        expiresInHours: params.expiresInHours || 24,
      });
      return token;
    });
  }

  /**
   * Verify email with token.
   * Marks user's email as verified.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async verifyEmail(token: string): Promise<UserEntity> {
    if (!this.config.email) {
      throw new e.EmailNotActivated.Error();
    }
    const candidate = await this.mikro.emailVerification.findOne({
      token,
      verified: false,
      expiresAt: { $gt: new Date() },
    });
    if (!candidate) throw new e.InvalidVerificationToken.Error();
    return withUserSecurity(
      this.mikro,
      candidate.user.sub,
      async (freshUser) => {
        if (
          freshUser.deleted_at ||
          candidate.user_epoch !== freshUser.token_epoch
        )
          throw new e.InvalidVerificationToken.Error();
        const verification =
          await this.mikro.emailVerification.verifyToken(token);
        if (!verification) {
          throw new e.InvalidVerificationToken.Error();
        }
        const user = await verification.user.load();
        if (!user || user.deleted_at) {
          throw new e.UserNotFound.Error();
        }
        user.email_verified = true;
        await this.mikro.em.flush();
        return user;
      },
      { includeDeleted: true },
    );
  }

  /**
   * Resend verification email.
   * Generates new token and returns it.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async resendVerification(
    email: string,
  ): Promise<IEmailVerificationEntity> {
    if (!this.config.email) {
      throw new e.EmailNotActivated.Error();
    }
    const user = await this.mikro.user.findOneOrFail(
      { email, deleted_at: null },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );
    if (user.email_verified) {
      throw new e.EmailAlreadyVerified.Error();
    }
    const token = await this.generateToken({ userSub: user.sub });
    await this.mikro.em.flush();
    return token;
  }

  /**
   * Check if user has pending verification.
   * Throws EmailNotActivated if SMTP is not configured.
   */
  public async hasPendingVerification(userSub: string): Promise<boolean> {
    if (!this.config.email) {
      throw new e.EmailNotActivated.Error();
    }
    const count = await this.mikro.emailVerification.count({
      user: { sub: userSub },
      verified: false,
      expiresAt: { $gt: new Date() },
    });
    return count > 0;
  }
}
