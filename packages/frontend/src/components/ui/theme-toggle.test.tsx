import { beforeAll, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';
import { ThemeToggle } from './theme-toggle';

beforeAll(() => {
  initTestI18n();
});

test('renders and calls onToggle when clicked', async () => {
  const onToggle = vi.fn();
  const screen = await render(
    <ThemeToggle colorScheme="light" onToggle={onToggle} />,
  );

  const button = screen.getByTestId('theme-toggle');
  await button.click();
  expect(onToggle).toHaveBeenCalledOnce();
});

test('renders with light color scheme', async () => {
  const screen = await render(
    <ThemeToggle colorScheme="light" onToggle={() => {}} />,
  );

  await expect.element(screen.getByTestId('theme-toggle')).toBeVisible();
});

test('renders with dark color scheme', async () => {
  const screen = await render(
    <ThemeToggle colorScheme="dark" onToggle={() => {}} />,
  );

  await expect.element(screen.getByTestId('theme-toggle')).toBeVisible();
});
