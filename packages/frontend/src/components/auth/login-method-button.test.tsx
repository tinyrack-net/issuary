import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { LoginMethodButton } from './login-method-button';

test('renders as anchor with href', async () => {
  const screen = await render(
    <LoginMethodButton
      as="a"
      href="/oauth/google"
      label="Google"
      providerType="google"
    />,
  );
  await expect.element(screen.getByText('Google')).toBeVisible();
  const link = screen.getByRole('link').element();
  expect(link.getAttribute('href')).toBe('/oauth/google');
});

test('renders as button with onClick', async () => {
  const handleClick = vi.fn();
  const screen = await render(
    <LoginMethodButton
      as="button"
      label="Passkey"
      onClick={handleClick}
      type="button"
    />,
  );
  await screen.getByText('Passkey').click();
  expect(handleClick).toHaveBeenCalledOnce();
});

test('shows loading spinner when isLoading is true', async () => {
  const screen = await render(
    <LoginMethodButton as="button" isLoading label="Loading" type="button" />,
  );
  const button = screen.getByRole('button').element();
  const spinner = button.querySelector('.loading-spinner');
  expect(spinner).not.toBeNull();
});

test('renders custom string icon as img', async () => {
  const screen = await render(
    <LoginMethodButton
      as="a"
      href="/"
      icon="https://example.com/icon.png"
      label="Custom"
    />,
  );
  const link = screen.getByRole('link').element();
  const img = link.querySelector('img');
  expect(img).not.toBeNull();
  expect(img?.getAttribute('src')).toBe('https://example.com/icon.png');
});

test('renders provider icon for known provider type', async () => {
  const screen = await render(
    <LoginMethodButton as="a" href="/" label="GitHub" providerType="github" />,
  );
  await expect.element(screen.getByText('GitHub')).toBeVisible();
});
