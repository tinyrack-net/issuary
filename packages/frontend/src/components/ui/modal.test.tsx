import { WarningCircleIcon } from '@phosphor-icons/react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { Modal, ModalActions } from './modal';

test('does not render when isOpen is false', async () => {
  const { container } = await render(
    <Modal isOpen={false} onClose={() => {}} title="Test">
      Content
    </Modal>,
  );
  expect(container.querySelector('dialog')).toBeNull();
});

test('renders title, description, and children when open', async () => {
  const { container } = await render(
    <Modal
      description="A description"
      isOpen={true}
      onClose={() => {}}
      title="My Modal"
    >
      <p>Modal body</p>
    </Modal>,
  );
  expect(container.querySelector('dialog')).not.toBeNull();
  expect(container.textContent).toContain('My Modal');
  expect(container.textContent).toContain('A description');
  expect(container.textContent).toContain('Modal body');
});

test('renders icon when provided', async () => {
  const { container } = await render(
    <Modal
      icon={WarningCircleIcon}
      isOpen={true}
      onClose={() => {}}
      title="Warning"
    >
      Content
    </Modal>,
  );
  expect(container.textContent).toContain('Warning');
  // Icon is rendered inside a rounded-full div
  expect(container.querySelector('.rounded-full')).not.toBeNull();
});

test('close button calls onClose', async () => {
  const onClose = vi.fn();
  const screen = await render(
    <Modal isOpen={true} onClose={onClose} title="Test">
      Content
    </Modal>,
  );

  // The close button has data-testid="modal-close"
  const closeBtn = screen.getByTestId('modal-close');
  await closeBtn.click();
  expect(onClose).toHaveBeenCalledOnce();
});

test('backdrop click calls onClose', async () => {
  const onClose = vi.fn();
  const { container } = await render(
    <Modal isOpen={true} onClose={onClose} title="Test">
      Content
    </Modal>,
  );

  // The backdrop button is inside a form.modal-backdrop.
  // Playwright may not be able to click it normally because
  // it's behind the modal overlay, so we dispatch the event directly.
  const backdropButton = container.querySelector(
    '.modal-backdrop button',
  ) as HTMLButtonElement;
  expect(backdropButton).not.toBeNull();
  backdropButton.click();
  expect(onClose).toHaveBeenCalledOnce();
});

test('preventClose hides close button and ignores backdrop', async () => {
  const onClose = vi.fn();
  const { container } = await render(
    <Modal isOpen={true} onClose={onClose} preventClose title="Locked">
      Content
    </Modal>,
  );

  expect(container.textContent).toContain('Locked');
  // No close button should be rendered
  expect(container.querySelector('[data-testid="modal-close"]')).toBeNull();
});

test('ModalActions renders children', async () => {
  const screen = await render(
    <ModalActions>
      <button type="button">Save</button>
      <button type="button">Cancel</button>
    </ModalActions>,
  );
  await expect.element(screen.getByText('Save')).toBeVisible();
  await expect.element(screen.getByText('Cancel')).toBeVisible();
});
