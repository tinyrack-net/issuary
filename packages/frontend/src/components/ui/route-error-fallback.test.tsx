import { TinyAuthError } from '@frontend/libs/error';
import { initTestI18n } from '@frontend/test-utils/i18n';
import { beforeAll, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { RouteErrorFallback } from './route-error-fallback';

beforeAll(() => {
  initTestI18n();
});

test('shows generic error with error code and message', async () => {
  const error = new TinyAuthError('CUSTOM_ERROR', 500, 'Server exploded');
  const screen = await render(
    <RouteErrorFallback error={error} reset={() => {}} />,
  );

  await expect.element(screen.getByText('Server exploded')).toBeVisible();
  await expect.element(screen.getByText('CUSTOM_ERROR')).toBeVisible();
  await expect.element(screen.getByText('Retry')).toBeVisible();
  await expect.element(screen.getByText('Go back')).toBeVisible();
});

test('retry button calls reset', async () => {
  const reset = vi.fn();
  const error = new TinyAuthError('ERR', 500, 'fail');
  const screen = await render(
    <RouteErrorFallback error={error} reset={reset} />,
  );

  await screen.getByText('Retry').click();
  expect(reset).toHaveBeenCalledOnce();
});

test('401 error with onUnauthorized calls callback', async () => {
  const onUnauthorized = vi.fn();
  const error = new TinyAuthError('UNAUTHORIZED', 401, 'Unauthorized');
  const { container } = await render(
    <RouteErrorFallback
      error={error}
      onUnauthorized={onUnauthorized}
      reset={() => {}}
    />,
  );

  expect(onUnauthorized).toHaveBeenCalledOnce();
  // Should show a loading spinner, not the error UI
  const spinner = container.querySelector('.loading-spinner');
  expect(spinner).not.toBeNull();
});

test('401 error without onUnauthorized shows login link', async () => {
  const error = new TinyAuthError('UNAUTHORIZED', 401, 'Unauthorized');
  const screen = await render(
    <RouteErrorFallback error={error} reset={() => {}} />,
  );

  await expect
    .element(screen.getByText('Your session has expired. Please log in again.'))
    .toBeVisible();
  await expect.element(screen.getByText('Go to login')).toBeVisible();
});

test('non-TinyAuthError shows default error message', async () => {
  const error = new Error('something');
  const screen = await render(
    <RouteErrorFallback error={error} reset={() => {}} />,
  );

  await expect
    .element(
      screen.getByText('An unexpected error occurred. Please try again later.'),
    )
    .toBeVisible();
  await expect.element(screen.getByText('UNKNOWN_ERROR')).toBeVisible();
});
