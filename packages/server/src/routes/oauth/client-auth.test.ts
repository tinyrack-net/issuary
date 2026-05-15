import { describe, expect, test } from 'vitest';
import { parseBasicClientCredentials } from './client-auth.js';

function basicHeader(clientId: string, clientSecret: string) {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString(
    'base64',
  );
  return `Basic ${encoded}`;
}

describe('parseBasicClientCredentials', () => {
  test('returns undefined when no Authorization header is present', () => {
    expect(parseBasicClientCredentials(undefined)).toBeUndefined();
  });

  test('parses canonical Basic client credentials', () => {
    expect(
      parseBasicClientCredentials(basicHeader('client', 'secret')),
    ).toEqual({
      clientId: 'client',
      clientSecret: 'secret',
    });
  });

  test('fails closed for unsupported Authorization schemes', () => {
    expect(parseBasicClientCredentials('Bearer access-token')).toBeNull();
  });

  test('rejects Basic credentials with trailing non-base64 characters', () => {
    expect(
      parseBasicClientCredentials(`${basicHeader('client', 'secret')}$$`),
    ).toBeNull();
  });

  test('rejects Basic credentials with embedded whitespace', () => {
    const encoded = Buffer.from('client:secret', 'utf8').toString('base64');
    expect(
      parseBasicClientCredentials(
        `Basic ${encoded.slice(0, 4)}\n${encoded.slice(4)}`,
      ),
    ).toBeNull();
  });

  test('rejects non-canonical Basic base64 without required padding', () => {
    const encoded = Buffer.from('client:secret', 'utf8')
      .toString('base64')
      .replace(/=+$/, '');

    expect(parseBasicClientCredentials(`Basic ${encoded}`)).toBeNull();
  });
});
