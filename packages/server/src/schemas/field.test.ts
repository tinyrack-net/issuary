import { describe, expect, test } from 'vitest';
import { f } from './field.ts';

describe('field schemas', () => {
  test('caps user subject and client config identifiers at 255 characters', () => {
    const maxLengthId = 'x'.repeat(255);
    const tooLongId = 'x'.repeat(256);

    expect(f.userSub.safeParse(maxLengthId).success).toBe(true);
    expect(f.userSub.safeParse(tooLongId).success).toBe(false);
    expect(f.clientConfigId.safeParse(maxLengthId).success).toBe(true);
    expect(f.clientConfigId.safeParse(tooLongId).success).toBe(false);
  });

  test('keeps OAuth client ID at its protocol field limit', () => {
    expect(f.clientId.safeParse('x'.repeat(1000)).success).toBe(true);
  });
});
