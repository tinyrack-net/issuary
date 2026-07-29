import type { Page } from '@playwright/test';

/**
 * Waits for runtime branding assets that CSS references rather than rendering
 * as img elements. Playwright's screenshot font wait cannot observe these.
 */
export async function waitForScreenAssets(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const background = document.querySelector<HTMLElement>(
      '[style*="background-image"]',
    );
    const value = background?.style.backgroundImage;
    const url = value?.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (!url) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener(
        'error',
        () => reject(new Error(`Failed to load Screen Lab asset: ${url}`)),
        { once: true },
      );
      image.src = url;
    });

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}
