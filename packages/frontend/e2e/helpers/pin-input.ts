import type { Page } from '@playwright/test';

/**
 * Fills a PinInput component by typing each digit sequentially.
 *
 * Works across browsers (Chromium + Firefox) by focusing the first
 * input and typing digits one at a time. The PinInput component
 * auto-advances focus after each digit input.
 */
export async function fillPinInput(page: Page, code: string): Promise<void> {
  const firstDigit = page.locator('input[aria-label="Digit 1 of 6"]');
  await firstDigit.click();
  for (const char of code) {
    await page.keyboard.press(char);
  }
}
