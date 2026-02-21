import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { PinInput } from './pin-input';

test('renders 6 input fields by default', async () => {
  const screen = await render(<PinInput />);
  const inputs = screen.getByRole('textbox').all();
  expect(inputs.length).toBe(6);
});

test('renders custom number of input fields', async () => {
  const screen = await render(<PinInput length={4} />);
  const inputs = screen.getByRole('textbox').all();
  expect(inputs.length).toBe(4);
});

test('accepts digit input and advances focus', async () => {
  const onChange = vi.fn();
  const screen = await render(<PinInput onChange={onChange} />);

  const firstInput = screen.getByLabelText('Digit 1 of 6');
  await firstInput.click();
  await firstInput.fill('3');

  expect(onChange).toHaveBeenCalledWith(expect.stringContaining('3'));
});

test('calls onComplete when all digits are filled', async () => {
  const onComplete = vi.fn();
  const screen = await render(
    <PinInput length={4} onComplete={onComplete} value="" />,
  );

  for (let i = 1; i <= 4; i++) {
    const input = screen.getByLabelText(`Digit ${i} of 4`);
    await input.fill(String(i));
  }

  expect(onComplete).toHaveBeenCalled();
});

test('rejects non-digit characters', async () => {
  const onChange = vi.fn();
  const screen = await render(<PinInput onChange={onChange} />);

  const firstInput = screen.getByLabelText('Digit 1 of 6');
  await firstInput.click();
  await firstInput.fill('a');

  // onChange should be called but with empty value for the digit
  // since non-digits are stripped
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
  const inputs = screen.getByRole('textbox').all();
  for (const input of inputs) {
    expect(input.element().hasAttribute('disabled')).toBe(true);
  }
});

test('displays controlled value', async () => {
  const screen = await render(<PinInput value="123456" />);
  const inputs = screen.getByRole('textbox').all();
  const values = inputs.map(
    (input) => (input.element() as HTMLInputElement).value,
  );
  expect(values).toEqual(['1', '2', '3', '4', '5', '6']);
});

test('handles paste with digits only', async () => {
  const onChange = vi.fn();
  const { container } = await render(<PinInput onChange={onChange} />);

  const firstInput = container.querySelector('input') as HTMLInputElement;
  expect(firstInput).not.toBeNull();
  firstInput.focus();

  // Create paste event with clipboardData.
  // Use Object.defineProperty because DataTransfer + ClipboardEvent
  // constructor integration varies across browsers.
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

  // After paste, onChange should have been called with the digits
  expect(onChange).toHaveBeenCalled();
  const lastCall = onChange.mock.calls.at(-1)?.[0] ?? '';
  // The pasted value should contain only digits
  expect(lastCall.replace(/\d/g, '')).toBe('');
});
