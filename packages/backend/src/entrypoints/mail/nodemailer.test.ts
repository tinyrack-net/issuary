import { describe, expect, test } from 'vitest';
import { nodemailer } from './nodemailer.ts';

describe('nodemailer config factory', () => {
  test('returns a valid EmailConfig', () => {
    const config = nodemailer({
      host: 'localhost',
      port: 465,
      secure: true,
      user: 'user',
      password: 'password',
      test: false,
    });

    expect(config.from).toBeUndefined();
    expect(typeof config.createTransport).toBe('function');
  });

  test('includes from when provided', () => {
    const config = nodemailer({
      host: 'localhost',
      port: 465,
      secure: true,
      user: 'user',
      password: 'password',
      from: 'sender@example.com',
      test: false,
    });

    expect(config.from).toBe('sender@example.com');
  });
});
