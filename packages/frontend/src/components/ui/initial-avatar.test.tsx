import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { InitialAvatar } from './initial-avatar';

test('displays uppercase first letter of email', async () => {
  const screen = await render(<InitialAvatar email="alice@example.com" />);
  await expect.element(screen.getByText('A')).toBeVisible();
});

test('handles lowercase email', async () => {
  const screen = await render(<InitialAvatar email="bob@example.com" />);
  await expect.element(screen.getByText('B')).toBeVisible();
});

test('renders with small size', async () => {
  const screen = await render(
    <InitialAvatar email="charlie@example.com" size="sm" />,
  );
  await expect.element(screen.getByText('C')).toBeVisible();
});

test('renders with large size', async () => {
  const screen = await render(
    <InitialAvatar email="dave@example.com" size="lg" />,
  );
  await expect.element(screen.getByText('D')).toBeVisible();
});
