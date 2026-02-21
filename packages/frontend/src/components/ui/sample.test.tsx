import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)} type="button">
        Increment
      </button>
    </div>
  );
}

test('renders with initial count', async () => {
  const screen = await render(<Counter initial={5} />);
  await expect.element(screen.getByText('Count: 5')).toBeVisible();
});

test('increments count on button click', async () => {
  const screen = await render(<Counter />);

  await expect.element(screen.getByText('Count: 0')).toBeVisible();

  await screen.getByRole('button', { name: 'Increment' }).click();

  await expect.element(screen.getByText('Count: 1')).toBeVisible();
});

test('increments multiple times', async () => {
  const screen = await render(<Counter initial={10} />);

  const button = screen.getByRole('button', { name: 'Increment' });
  await button.click();
  await button.click();
  await button.click();

  await expect.element(screen.getByText('Count: 13')).toBeVisible();
});
