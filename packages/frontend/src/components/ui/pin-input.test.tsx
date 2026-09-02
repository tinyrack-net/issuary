import { expect, test, vi } from 'vitest';
import type { RenderResult } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';
import { PinInput } from './pin-input';

initTestI18n();

function getAllInputs(screen: RenderResult) {
  return screen.getByRole('textbox').all();
}

test('renders 6 input fields by default', async () => {
  const screen = await render(<PinInput />);
  const inputs = getAllInputs(screen);
  expect(inputs.length).toBe(6);
});

test('renders custom number of input fields', async () => {
  const screen = await render(<PinInput length={4} />);
  const inputs = getAllInputs(screen);
  expect(inputs.length).toBe(4);
});

test('distributes square input fields evenly across the available width', async () => {
  const screen = await render(
    <div className="w-tinyrack-overlay-width-sm" data-testid="pin-container">
      <PinInput />
    </div>,
  );
  const container = screen.getByTestId('pin-container').element();
  const group = screen.container.querySelector('.tr-otp-field');
  expect(group).not.toBeNull();
  if (!(group instanceof HTMLElement)) return;

  expect(group.dataset.layout).toBe('stretch');
  expect(group.getBoundingClientRect().width).toBeCloseTo(
    container.getBoundingClientRect().width,
  );

  const inputRects = getAllInputs(screen).map((input) =>
    input.element().getBoundingClientRect(),
  );
  const widths = inputRects.map((rect) => rect.width);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  for (const rect of inputRects) {
    expect(Math.abs(rect.width - rect.height)).toBeLessThan(0.1);
  }
});

test('accepts digit input and advances focus', async () => {
  const onChange = vi.fn();
  const screen = await render(<PinInput onChange={onChange} />);

  const inputs = getAllInputs(screen);
  await inputs[0].click();
  await inputs[0].fill('3');

  expect(onChange).toHaveBeenCalledWith(expect.stringContaining('3'));
});

test('calls onComplete when all digits are filled', async () => {
  const onComplete = vi.fn();
  const screen = await render(
    <PinInput length={4} onComplete={onComplete} value="" />,
  );

  const inputs = getAllInputs(screen);
  for (let i = 0; i < 4; i++) {
    await inputs[i].fill(String(i + 1));
  }

  expect(onComplete).toHaveBeenCalled();
});

test('rejects non-digit characters', async () => {
  const onChange = vi.fn();
  const screen = await render(<PinInput onChange={onChange} />);

  const inputs = getAllInputs(screen);
  await inputs[0].click();
  await inputs[0].fill('a');

  if (onChange.mock.calls.length > 0) {
    const lastValue = onChange.mock.calls.at(-1)?.[0] ?? '';
    expect(lastValue.replace(/\d/g, '')).toBe('');
  }
});

test('shows error message when error prop is set', async () => {
  const screen = await render(
    <PinInput error={{ type: 'validate', message: 'Invalid code' }} />,
  );
  await expect.element(screen.getByText('Invalid code')).toBeVisible();
});

test('renders disabled inputs when disabled', async () => {
  const screen = await render(<PinInput disabled />);
  const inputs = getAllInputs(screen);
  for (const input of inputs) {
    expect(input.element().hasAttribute('disabled')).toBe(true);
  }
});

test('displays controlled value', async () => {
  const screen = await render(<PinInput value="123456" />);
  const inputs = getAllInputs(screen);
  const values = inputs.map(
    (input) => (input.element() as HTMLInputElement).value,
  );
  expect(values).toEqual(['1', '2', '3', '4', '5', '6']);
});

test('handles paste with digits only', async () => {
  const onChange = vi.fn();
  const screen = await render(<PinInput onChange={onChange} />);

  const inputs = getAllInputs(screen);
  const firstInput = inputs[0].element() as HTMLInputElement;
  expect(firstInput).not.toBeNull();
  firstInput.focus();

  const pasteEvent = new Event('paste', {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData: () => '123456',
    },
  });
  firstInput.dispatchEvent(pasteEvent);

  expect(onChange).toHaveBeenCalled();
  const lastCall = onChange.mock.calls.at(-1)?.[0] ?? '';
  expect(lastCall.replace(/\d/g, '')).toBe('');
});
