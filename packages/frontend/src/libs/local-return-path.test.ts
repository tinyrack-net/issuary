import { expect, test } from 'vitest';
import { localReturnPath } from './local-return-path.js';

test.each([
  'javascript:alert(1)',
  'https://attacker.example',
  '//attacker.example',
  '/\\attacker.example',
  '/\t/attacker.example',
])('rejects executable or external return path %s', (value) => {
  expect(localReturnPath(value)).toBe('/profile');
});
test('preserves local OAuth continuation parameters', () => {
  const path = '/oauth/authorize?client_id=test&state=abc';
  expect(localReturnPath(path)).toBe(path);
});
