import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { AdminTable } from './admin-table.js';

const columns = [
  { header: 'Email', key: 'email' },
  { header: 'Role', key: 'role' },
];

describe('AdminTable', () => {
  test('renders rows inside a horizontally scrollable DaisyUI table', async () => {
    const screen = await render(
      <AdminTable
        ariaLabel="Users"
        columns={columns}
        getRowKey={(user) => user.email}
        renderRow={(user) => (
          <tr>
            <td>{user.email}</td>
            <td>{user.role}</td>
          </tr>
        )}
        rows={[{ email: 'user@example.com', role: 'admin' }]}
      />,
    );

    await expect
      .element(screen.getByRole('table', { name: 'Users' }))
      .toBeVisible();
    await expect.element(screen.getByText('user@example.com')).toBeVisible();
    expect(document.querySelector('.overflow-x-auto')).not.toBeNull();
    expect(document.querySelector('table')?.className).toContain('table');
  });

  test('renders empty, loading, and error states with DaisyUI classes', async () => {
    const emptyScreen = await render(
      <AdminTable
        ariaLabel="Empty users"
        columns={columns}
        emptyMessage="No users"
        getRowKey={(user) => user.email}
        renderRow={(user) => (
          <tr>
            <td>{user.email}</td>
            <td>{user.role}</td>
          </tr>
        )}
        rows={[]}
      />,
    );

    await expect.element(emptyScreen.getByText('No users')).toBeVisible();
    expect(document.querySelector('.alert')).not.toBeNull();

    const loadingScreen = await render(
      <AdminTable
        ariaLabel="Loading users"
        columns={columns}
        getRowKey={(user) => user.email}
        isLoading={true}
        loadingMessage="Loading users"
        renderRow={(user) => (
          <tr>
            <td>{user.email}</td>
            <td>{user.role}</td>
          </tr>
        )}
        rows={[]}
      />,
    );

    await expect
      .element(loadingScreen.getByText('Loading users'))
      .toBeVisible();
    expect(document.querySelector('.loading')).not.toBeNull();

    const errorScreen = await render(
      <AdminTable
        ariaLabel="Errored users"
        columns={columns}
        errorMessage="Could not load users"
        getRowKey={(user) => user.email}
        renderRow={(user) => (
          <tr>
            <td>{user.email}</td>
            <td>{user.role}</td>
          </tr>
        )}
        rows={[]}
      />,
    );

    await expect
      .element(errorScreen.getByText('Could not load users'))
      .toBeVisible();
    expect(document.querySelector('.alert-error')).not.toBeNull();
  });
});
