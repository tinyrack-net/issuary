import { TRButton } from '@tinyrack/ui/components/button';
import { CircleAlertIcon, InfoIcon } from 'lucide-react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { Alert } from './alert';

test('renders with error type and children', async () => {
  const screen = await render(
    <Alert icon={CircleAlertIcon} type="error">
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

test('renders optional title and actions through alert anatomy', async () => {
  const screen = await render(
    <Alert
      actions={<TRButton type="button">Retry</TRButton>}
      icon={InfoIcon}
      title="Connection failed"
      type="error"
    >
      Check the network and try again.
    </Alert>,
  );

  await expect.element(screen.getByText('Connection failed')).toBeVisible();
  await expect
    .element(screen.getByText('Check the network and try again.'))
    .toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Retry' }))
    .toBeVisible();
});

test('applies custom className', async () => {
  const screen = await render(
    <Alert className="my-custom-class" icon={InfoIcon} type="success">
      Content
    </Alert>,
  );
  const alert = screen
    .getByText('Content')
    .element()
    .closest('[data-testid="alert-success"]');
  expect(alert?.classList.contains('my-custom-class')).toBe(true);
});
