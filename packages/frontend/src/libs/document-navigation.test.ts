import { expect, test } from 'vitest';
import { signalDocumentNavigation } from './document-navigation.ts';

test('test runtime cancels document navigation', () => {
  expect(signalDocumentNavigation()).toBe(false);
});
