import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { useAdminSelection } from './use-admin-selection.ts';

function SelectionProbe() {
  const selection = useAdminSelection(['one', 'two']);
  return (
    <div>
      <output data-testid="kind">{selection.selection.kind}</output>
      <output data-testid="count">
        {selection.selection.kind === 'filter'
          ? 'all'
          : selection.selection.ids.size}
      </output>
      <output data-testid="checked">{String(selection.allOnPage)}</output>
      <output data-testid="mixed">{String(selection.someOnPage)}</output>
      <button onClick={() => selection.toggleOne('one', true)} type="button">
        one
      </button>
      <button onClick={() => selection.togglePage(true)} type="button">
        page
      </button>
      <button onClick={selection.selectFilter} type="button">
        filter
      </button>
      <button onClick={() => selection.toggleOne('one', false)} type="button">
        remove-one
      </button>
      <button onClick={selection.clear} type="button">
        clear
      </button>
    </div>
  );
}

describe('useAdminSelection', () => {
  test('tracks checked, indeterminate, current page, and filter-wide selection', async () => {
    const screen = await render(<SelectionProbe />);
    await screen.getByRole('button', { name: 'one', exact: true }).click();
    await expect.element(screen.getByTestId('mixed')).toHaveTextContent('true');
    await screen.getByRole('button', { name: 'page' }).click();
    await expect
      .element(screen.getByTestId('checked'))
      .toHaveTextContent('true');
    await expect.element(screen.getByTestId('count')).toHaveTextContent('2');
    await screen.getByRole('button', { name: 'filter' }).click();
    await expect
      .element(screen.getByTestId('kind'))
      .toHaveTextContent('filter');
    await screen.getByRole('button', { name: 'remove-one' }).click();
    await expect.element(screen.getByTestId('kind')).toHaveTextContent('ids');
    await expect.element(screen.getByTestId('count')).toHaveTextContent('1');
    await screen.getByRole('button', { name: 'clear' }).click();
    await expect.element(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
