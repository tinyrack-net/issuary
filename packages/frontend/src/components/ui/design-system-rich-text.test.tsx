import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { DesignSystemRichText } from './design-system-rich-text.js';

test('maps supported rich text elements to design-system components', async () => {
  const screen = await render(
    <DesignSystemRichText html="<h2>Heading</h2><p>Hello <strong>world</strong> and <code>code</code>.</p><ul><li>First</li></ul>" />,
  );

  await expect
    .element(screen.getByRole('heading', { name: 'Heading' }))
    .toBeVisible();
  await expect.element(screen.getByText('Hello world and code.')).toBeVisible();
  expect(screen.container.querySelector('.tr-text')).not.toBeNull();
  expect(screen.container.querySelector('.tr-code')).not.toBeNull();
});

test('keeps safe links and enforces a safe new-window policy', async () => {
  const screen = await render(
    <DesignSystemRichText
      html={
        '<p><a href="https://example.com" target="_blank" onclick="alert(1)">Documentation</a> <a href="terms/latest">Terms</a></p>'
      }
    />,
  );
  const link = screen.getByRole('link', { name: 'Documentation' });

  await expect.element(link).toHaveAttribute('href', 'https://example.com');
  await expect.element(link).toHaveAttribute('target', '_blank');
  await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect.element(link).not.toHaveAttribute('onclick');
  await expect
    .element(screen.getByRole('link', { name: 'Terms' }))
    .toHaveAttribute('href', 'terms/latest');
});

test('removes executable content and unsafe URL schemes', async () => {
  const screen = await render(
    <DesignSystemRichText
      html={
        '<script>alert(1)</script><style>body{display:none}</style><p><a href="javascript:alert(1)">Unsafe label</a><img src=x onerror="alert(2)"></p>'
      }
    />,
  );

  await expect.element(screen.getByText('Unsafe label')).toBeVisible();
  expect(screen.container.querySelector('script')).toBeNull();
  expect(screen.container.querySelector('style')).toBeNull();
  expect(screen.container.querySelector('a')).toBeNull();
  expect(screen.container.querySelector('img')).toBeNull();
});

test('discards unknown containers but preserves their safe text children', async () => {
  const screen = await render(
    <DesignSystemRichText html="<custom-element>Preserved text</custom-element>" />,
  );

  await expect.element(screen.getByText('Preserved text')).toBeVisible();
  expect(screen.container.querySelector('custom-element')).toBeNull();
});
