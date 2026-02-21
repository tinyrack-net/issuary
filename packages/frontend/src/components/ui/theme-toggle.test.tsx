import { initTestI18n } from '@frontend/test-utils/i18n';
import { beforeAll, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ThemeToggle } from './theme-toggle';

beforeAll(() => {
  initTestI18n();
});

test('renders and calls onCycle when clicked', async () => {
  const onCycle = vi.fn();
  const screen = await render(
    <ThemeToggle
      darkTheme="dark"
      detectedTheme="light"
      isAutoMode={false}
      onCycle={onCycle}
      themeMode="light"
    />,
  );

  const button = screen.getByRole('button', { name: 'Select theme' });
  await button.click();
  expect(onCycle).toHaveBeenCalledOnce();
});

test('shows light icon for light theme mode', async () => {
  const screen = await render(
    <ThemeToggle
      darkTheme="dark"
      detectedTheme="light"
      isAutoMode={false}
      onCycle={() => {}}
      themeMode="light"
    />,
  );

  await expect
    .element(screen.getByRole('button', { name: 'Select theme' }))
    .toBeVisible();
});

test('shows system icon for system theme mode', async () => {
  const screen = await render(
    <ThemeToggle
      darkTheme="dark"
      detectedTheme="dark"
      isAutoMode={true}
      onCycle={() => {}}
      themeMode="system"
    />,
  );

  await expect
    .element(screen.getByRole('button', { name: 'Select theme' }))
    .toBeVisible();
});

test('shows dark icon for dark theme mode', async () => {
  const screen = await render(
    <ThemeToggle
      darkTheme="dark"
      detectedTheme="dark"
      isAutoMode={false}
      onCycle={() => {}}
      themeMode="dark"
    />,
  );

  await expect
    .element(screen.getByRole('button', { name: 'Select theme' }))
    .toBeVisible();
});
