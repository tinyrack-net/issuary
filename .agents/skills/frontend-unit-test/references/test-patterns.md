# Frontend Unit Test Patterns

## Basic Component Test

```tsx
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { MyComponent } from './my-component';

test('renders heading', async () => {
  const screen = await render(<MyComponent />);
  await expect.element(screen.getByRole('heading')).toBeVisible();
});
```

## i18n-Aware Component Test

```tsx
import { initTestI18n } from '@frontend/test-utils/i18n';
import { beforeAll, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { ThemeToggle } from './theme-toggle';

beforeAll(() => {
  initTestI18n();
});

test('renders translated action', async () => {
  const screen = await render(
    <ThemeToggle
      darkTheme="dark"
      detectedTheme="light"
      isAutoMode={false}
      onCycle={() => {}}
      themeMode="light"
    />,
  );
  await expect
    .element(screen.getByRole('button', { name: 'Select theme' }))
    .toBeVisible();
});
```

## Mocking and Interaction

```tsx
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { LoginMethodButton } from './login-method-button';

test('calls callback on click', async () => {
  const onClick = vi.fn();
  const screen = await render(
    <LoginMethodButton icon={<span />} onClick={onClick}>
      Google
    </LoginMethodButton>,
  );

  await screen.getByRole('button', { name: 'Google' }).click();
  expect(onClick).toHaveBeenCalledOnce();
});
```

## Assertion Preferences

- Prefer `expect.element(...).toBeVisible()` for rendered UI state.
- Prefer semantic queries (`getByRole`, `getByLabelText`, `getByText`).
- Assert callback behavior with explicit counts (`toHaveBeenCalledOnce`).
- Avoid checking implementation details unless there is no user-facing
  signal.
