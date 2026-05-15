import { randomUUID } from 'node:crypto';
import type { TestInfo } from '@playwright/test';

function safeLabel(label: string): string {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'test';
}

export function uniqueTestId(testInfo: TestInfo, label: string): string {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  return `${safeLabel(label)}-w${testInfo.workerIndex}-r${testInfo.retry}-${suffix}`;
}

export function uniqueEmail(
  testInfo: TestInfo,
  label: string,
  domain = 'example.com',
): string {
  return `${uniqueTestId(testInfo, label)}@${domain}`;
}
