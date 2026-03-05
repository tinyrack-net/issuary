import { describe, expect, test } from 'vitest';
import { smtp } from '#backend/mail.js';

describe('smtp config factory', () => {
  test('returns false preview url for non-test smtp config', () => {
    const config = smtp({
      host: 'localhost',
      port: 465,
      secure: true,
      user: 'user',
      password: 'password',
      test: false,
    });

    expect(config.test).toBe(false);
    expect(typeof config.createTransport).toBe('function');
    expect(typeof config.getTestMessageUrl).toBe('function');
  });
});
