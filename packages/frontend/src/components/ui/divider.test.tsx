import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { Divider } from './divider';

test('renders without text (no span element)', async () => {
  const { container } = await render(<Divider />);
  expect(container.querySelectorAll('span').length).toBe(0);
});

test('renders with text', async () => {
  const screen = await render(<Divider text="OR" />);
  await expect.element(screen.getByText('OR')).toBeVisible();
});

test('applies custom className', async () => {
  const screen = await render(
    <Divider className="my-divider" text="divider" />,
  );
  const text = screen.getByText('divider').element();
  const container = text.closest('.my-divider');
  expect(container).not.toBeNull();
});
