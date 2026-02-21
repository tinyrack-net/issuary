import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { AlertBanner } from './alert-banner';

test('renders error variant with children', async () => {
  const screen = await render(
    <AlertBanner variant="error">Something went wrong</AlertBanner>,
  );
  await expect.element(screen.getByText('Something went wrong')).toBeVisible();
});

test('renders warning variant with children', async () => {
  const screen = await render(
    <AlertBanner variant="warning">Be careful</AlertBanner>,
  );
  await expect.element(screen.getByText('Be careful')).toBeVisible();
});

test('renders info variant with children', async () => {
  const screen = await render(
    <AlertBanner variant="info">FYI note</AlertBanner>,
  );
  await expect.element(screen.getByText('FYI note')).toBeVisible();
});
