import { InfoIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { Alert } from './alert';

test('renders with error type and children', async () => {
  const screen = await render(
    <Alert icon={WarningCircleIcon} type="error">
      Error message
    </Alert>,
  );
  await expect.element(screen.getByText('Error message')).toBeVisible();
});

test('renders with info type and children', async () => {
  const screen = await render(
    <Alert icon={InfoIcon} type="info">
      Info message
    </Alert>,
  );
  await expect.element(screen.getByText('Info message')).toBeVisible();
});

test('applies custom className', async () => {
  const screen = await render(
    <Alert className="my-custom-class" icon={InfoIcon} type="success">
      Content
    </Alert>,
  );
  const alert = screen.getByText('Content').element().closest('.alert');
  expect(alert?.classList.contains('my-custom-class')).toBe(true);
});
