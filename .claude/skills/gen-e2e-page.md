# gen-e2e-page

Generate a new Playwright Page Object Model for E2E tests.

## Usage

```
/gen-e2e-page <name> --route <route>
```

## Arguments

- `<name>`: Page name in lowercase (e.g., `settings`, `dashboard`)
- `--route <route>`: Frontend route path (e.g., `/settings`, `/dashboard`)

## Instructions

When the user invokes this skill:

1. Parse the name and route arguments
2. Create the page object at `packages/frontend/e2e/pages/<name>.page.ts`
3. Update the index export at `packages/frontend/e2e/pages/index.ts`

### Page Object Template

```typescript
import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Page Object for the <name> page (<route>)
 */
export class <Name>Page {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // TODO: Add page-specific locators
  // Example locators:
  // readonly submitButton: Locator;
  // readonly emailInput: Locator;
  // readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');

    // TODO: Initialize locators
    // Example:
    // this.submitButton = page.locator('button[type="submit"]');
    // this.emailInput = page.locator('input[name="email"]');
    // this.errorAlert = page.locator('.alert-error');
  }

  /**
   * Navigate to the page
   */
  async goto() {
    await this.page.goto('<route>');
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Verify an error alert is displayed
   */
  async expectError() {
    await expect(this.page.locator('.alert-error')).toBeVisible();
  }

  // TODO: Add page-specific actions
  // Example:
  // async fillForm(data: { email: string; name: string }) {
  //   await this.emailInput.fill(data.email);
  //   await this.nameInput.fill(data.name);
  // }
  //
  // async submit() {
  //   await this.submitButton.click();
  // }
}
```

### Update Index Export

Add to `packages/frontend/e2e/pages/index.ts`:

```typescript
export { <Name>Page } from './<name>.page.js';
```

## Common Locator Patterns

### By Role (Recommended)
```typescript
page.getByRole('button', { name: 'Submit' })
page.getByRole('textbox', { name: 'Email' })
page.getByRole('link', { name: 'Sign up' })
```

### By Test ID
```typescript
page.getByTestId('submit-button')
```

### By CSS Selector
```typescript
page.locator('button[type="submit"]')
page.locator('.alert-error')
page.locator('input[name="email"]')
```

### By Text
```typescript
page.getByText('Welcome')
page.locator('text=Submit')
```

## Page Object Patterns

### Form Handling
```typescript
async fillLoginForm(email: string, password: string) {
  await this.emailInput.fill(email);
  await this.passwordInput.fill(password);
}

async submitForm() {
  await this.submitButton.click();
}
```

### Assertions
```typescript
async expectSuccess() {
  await expect(this.successMessage).toBeVisible();
}

async expectErrorMessage(message: string) {
  await expect(this.errorAlert).toContainText(message);
}
```

### Navigation
```typescript
async clickLink(name: string) {
  await this.page.getByRole('link', { name }).click();
}
```

## After Generation

1. Add page-specific locators in constructor
2. Implement action methods for user interactions
3. Add assertion methods for verifying state
4. Export from `index.ts`
5. Create corresponding test file with `/gen-e2e-test`
