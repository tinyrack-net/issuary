import { TRButton } from '@tinyrack/ui/components/button';
import { TRToast } from '@tinyrack/ui/components/toast';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { Toaster } from '#frontend/components/ui/toaster.tsx';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';

function Harness() {
  const toast = TRToast.useToastManager();

  return (
    <>
      <Toaster />
      <TRButton onClick={() => toast.add({ title: 'Codes copied' })}>
        emit
      </TRButton>
    </>
  );
}

test('shows a queued toast and lets it be dismissed', async () => {
  initTestI18n();

  const screen = await render(
    <TRToast.Provider>
      <Harness />
    </TRToast.Provider>,
  );

  await expect
    .element(screen.getByText('Codes copied'))
    .not.toBeInTheDocument();

  await screen.getByRole('button', { name: 'emit' }).click();
  await expect.element(screen.getByText('Codes copied')).toBeVisible();

  await screen.getByRole('button', { name: 'Dismiss' }).click();
  await expect
    .element(screen.getByText('Codes copied'))
    .not.toBeInTheDocument();
});
