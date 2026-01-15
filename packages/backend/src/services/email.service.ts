import type { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { InternalAppConfig } from '@/lib/config/index.js';
import { e } from '@/schemas/error.js';

declare module 'fastify' {
  interface FastifyInstance {
    emailService: EmailService;
  }
}

export class EmailService {
  public constructor(
    private readonly config: InternalAppConfig,
    private readonly transporter: FastifyInstance['mail'],
  ) {}

  public async sendVerificationEmail(params: {
    email: string;
    token: string;
  }): Promise<SMTPTransport.SentMessageInfo> {
    if (!this.transporter || !this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }

    const verificationUrl = `${this.config.app.host}/verify-email?token=${params.token}`;

    const html = this.getVerificationEmailTemplate({
      verificationUrl,
      token: params.token,
    });

    const info = await this.transporter.sendMail({
      from: this.config.smtp.from,
      to: params.email,
      subject: 'Verify your email address',
      text: `Please verify your email by clicking this link: ${verificationUrl}\n\nOr use this verification code: ${params.token}`,
      html,
    });

    console.log('Email sent: %s', info.messageId);

    if (this.config.smtp.test) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL: %s', previewUrl);
      }
    }

    return info;
  }

  public sendVerificationEmailAsync(params: {
    email: string;
    token: string;
  }): void {
    this.sendVerificationEmail(params).catch((err) => {
      console.error('Failed to send verification email:', err);
    });
  }

  public async sendPasswordResetEmail(params: {
    email: string;
    token: string;
  }): Promise<SMTPTransport.SentMessageInfo> {
    if (!this.transporter || !this.config.smtp) {
      throw new e.EmailNotActivated.Error();
    }

    const resetUrl = `${this.config.app.host}/reset-password?token=${params.token}`;

    const html = this.getPasswordResetEmailTemplate({
      resetUrl,
      token: params.token,
    });

    const info = await this.transporter.sendMail({
      from: this.config.smtp.from,
      to: params.email,
      subject: 'Reset your password',
      text: `Reset your password by clicking this link: ${resetUrl}\n\nOr use this reset code: ${params.token}\n\nThis link will expire in 1 hour.`,
      html,
    });

    console.log('Password reset email sent: %s', info.messageId);

    if (this.config.smtp.test) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL: %s', previewUrl);
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
  }): void {
    this.sendPasswordResetEmail(params).catch((err) => {
      console.error('Failed to send password reset email:', err);
    });
  }

  private getVerificationEmailTemplate(params: {
    verificationUrl: string;
    token: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 30px;
      border: 1px solid #e0e0e0;
    }
    h1 {
      color: #2c3e50;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #3498db;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .token {
      background-color: #ecf0f1;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 16px;
      text-align: center;
      margin: 15px 0;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #7f8c8d;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✉️ Verify Your Email Address</h1>
    <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
    
    <p>Click the button below to verify your email:</p>
    
    <a href="${params.verificationUrl}" class="button">Verify Email</a>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #3498db;">${params.verificationUrl}</p>
    
    <p>Alternatively, you can use this verification code:</p>
    <div class="token">${params.token}</div>
    
    <p style="margin-top: 30px; color: #e74c3c; font-size: 14px;">
      ⏰ This link will expire in 24 hours.
    </p>
    
    <div class="footer">
      <p>If you didn't create an account, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;
  }

  private getPasswordResetEmailTemplate(params: {
    resetUrl: string;
    token: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 30px;
      border: 1px solid #e0e0e0;
    }
    h1 {
      color: #2c3e50;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #e74c3c;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .token {
      background-color: #ecf0f1;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 16px;
      text-align: center;
      margin: 15px 0;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #7f8c8d;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reset Your Password</h1>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    
    <a href="${params.resetUrl}" class="button">Reset Password</a>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #3498db;">${params.resetUrl}</p>
    
    <p>Alternatively, you can use this reset code:</p>
    <div class="token">${params.token}</div>
    
    <p style="margin-top: 30px; color: #e74c3c; font-size: 14px;">
      This link will expire in 1 hour.
    </p>
    
    <div class="footer">
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>Your password will remain unchanged.</p>
    </div>
  </div>
</body>
</html>
`;
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const service = new EmailService(fastify.config, fastify.mail);
    fastify.decorate('emailService', service);
  },
  {
    name: 'email-service-plugin',
    dependencies: [],
  },
);
