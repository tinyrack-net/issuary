import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { initI18n } from '#admin/i18n/index.js';
import { PaginationControls } from './pagination-controls.js';

describe('PaginationControls', () => {
  test('disables previous navigation at the first page', async () => {
    initI18n('en');

    const onOffsetChange = vi.fn();
    const screen = await render(
      <PaginationControls
        limit={20}
        offset={0}
        onOffsetChange={onOffsetChange}
        total={45}
      />,
    );

    await expect
      .element(screen.getByRole('button', { name: 'First page' }))
      .toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Previous page' }))
      .toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Next page' }))
      .toBeEnabled();
  });

  test('disables next navigation at the last page', async () => {
    initI18n('en');

    const onOffsetChange = vi.fn();
    const screen = await render(
      <PaginationControls
        limit={20}
        offset={40}
        onOffsetChange={onOffsetChange}
        total={45}
      />,
    );

    await expect
      .element(screen.getByRole('button', { name: 'Previous page' }))
      .toBeEnabled();
    await expect
      .element(screen.getByRole('button', { name: 'Next page' }))
      .toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Last page' }))
      .toBeDisabled();
  });

  test('renders page buttons and marks the current page active', async () => {
    initI18n('en');

    const onOffsetChange = vi.fn();
    const screen = await render(
      <PaginationControls
        limit={20}
        offset={20}
        onOffsetChange={onOffsetChange}
        total={100}
      />,
    );

    for (const page of [1, 2, 3, 4, 5]) {
      await expect
        .element(screen.getByRole('button', { name: `Page ${page}` }))
        .toBeVisible();
    }

    const currentPage = document.querySelector('[aria-current="page"]');
    expect(currentPage?.textContent).toBe('2');
    expect(currentPage?.className).toContain('btn-primary');
  });

  test('uses a compact page window for large page counts', async () => {
    initI18n('en');

    const onOffsetChange = vi.fn();
    const screen = await render(
      <PaginationControls
        limit={10}
        offset={490}
        onOffsetChange={onOffsetChange}
        total={1000}
      />,
    );

    for (const page of [48, 49, 50, 51, 52]) {
      await expect
        .element(screen.getByRole('button', { name: `Page ${page}` }))
        .toBeVisible();
    }

    expect(document.querySelector('[aria-label="Page 1"]')).toBeNull();
  });

  test('requests expected offsets when navigating pages', async () => {
    initI18n('en');

    const onOffsetChange = vi.fn();
    const screen = await render(
      <PaginationControls
        limit={20}
        offset={20}
        onOffsetChange={onOffsetChange}
        total={75}
      />,
    );

    await screen.getByRole('button', { name: 'Previous page' }).click();
    await screen.getByRole('button', { name: 'Page 4' }).click();
    await screen.getByRole('button', { name: 'Next page' }).click();
    await screen.getByRole('button', { name: 'First page' }).click();
    await screen.getByRole('button', { name: 'Last page' }).click();

    expect(onOffsetChange).toHaveBeenNthCalledWith(1, 0);
    expect(onOffsetChange).toHaveBeenNthCalledWith(2, 60);
    expect(onOffsetChange).toHaveBeenNthCalledWith(3, 40);
    expect(onOffsetChange).toHaveBeenNthCalledWith(4, 0);
    expect(onOffsetChange).toHaveBeenNthCalledWith(5, 60);
  });
});
