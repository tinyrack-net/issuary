import { TRText } from '@tinyrack/ui/components/text';
import { CircleAlertIcon } from 'lucide-react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { Modal, ModalActions } from './modal';

test('does not render when isOpen is false', async () => {
  const { container } = await render(
    <Modal isOpen={false} onClose={() => {}} title="Test">
      Content
    </Modal>,
  );
  expect(container.innerHTML).toBe('');
});

test('renders title, description, and children when open', async () => {
  const screen = await render(
    <Modal
      description="A description"
      isOpen={true}
      onClose={() => {}}
      title="My Modal"
    >
      <TRText as="p">Modal body</TRText>
    </Modal>,
  );

  await expect.element(screen.getByText('My Modal')).toBeVisible();
  await expect.element(screen.getByText('A description')).toBeVisible();
  await expect.element(screen.getByText('Modal body')).toBeVisible();
});

test('renders icon when provided', async () => {
  const screen = await render(
    <Modal
      icon={CircleAlertIcon}
      isOpen={true}
      onClose={() => {}}
      title="Warning"
    >
      Content
    </Modal>,
  );

  await expect.element(screen.getByText('Warning')).toBeVisible();
  expect(
    screen.baseElement.querySelector('.rounded-tinyrack-full'),
  ).not.toBeNull();
});

test('close button calls onClose', async () => {
  const onClose = vi.fn();
  const screen = await render(
    <Modal isOpen={true} onClose={onClose} title="Test">
      Content
    </Modal>,
  );

  const closeBtn = screen.getByTestId('modal-close');
  await closeBtn.click();
  expect(onClose).toHaveBeenCalledOnce();
});

test('backdrop click calls onClose', async () => {
  const onClose = vi.fn();
  await render(
    <Modal isOpen={true} onClose={onClose} title="Test">
      Content
    </Modal>,
  );

  const backdrop = document.querySelector('.tr-layer-backdrop');
  await vi.waitFor(() => expect(backdrop).not.toBeNull());
  (backdrop as HTMLElement).click();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});

test('preventClose hides close button and ignores backdrop', async () => {
  const onClose = vi.fn();
  const screen = await render(
    <Modal isOpen={true} onClose={onClose} preventClose title="Locked">
      Content
    </Modal>,
  );

  await expect.element(screen.getByText('Locked')).toBeVisible();
  expect(
    screen.container.querySelector('[data-testid="modal-close"]'),
  ).toBeNull();
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
