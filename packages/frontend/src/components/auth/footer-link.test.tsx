import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { FooterLink } from './footer-link';

test('renders text and linkText', async () => {
  const screen = await render(
    <FooterLink as="a" href="/login" linkText="Sign in" text="Have account?" />,
  );
  await expect.element(screen.getByText('Have account?')).toBeVisible();
  await expect.element(screen.getByText('Sign in')).toBeVisible();
});

test('renders an anchor with correct href when as="a"', async () => {
  const screen = await render(
    <FooterLink as="a" href="/register" linkText="Register" text="" />,
  );
  const link = screen.getByText('Register').element();
  expect(link.tagName).toBe('A');
  expect(link.getAttribute('href')).toBe('/register');
});

test('applies custom className to wrapper', async () => {
  const screen = await render(
    <FooterLink
      as="a"
      className="my-class"
      href="/"
      linkText="Link"
      text="Text"
    />,
  );
  const wrapper = screen.getByText('Text').element().closest('div');
  expect(wrapper?.classList.contains('my-class')).toBe(true);
});

test('applies tr-link class to the rendered component', async () => {
  const screen = await render(
    <FooterLink as="a" href="/" linkText="Click" text="" />,
  );
  const link = screen.getByText('Click').element();
  expect(link.classList.contains('tr-link')).toBe(true);
});
