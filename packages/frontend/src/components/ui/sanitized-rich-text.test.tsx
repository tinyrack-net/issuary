import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { SanitizedRichText } from './sanitized-rich-text.js';

test('passes semantic rich text to the design-system renderer', async () => {
  const screen = await render(
    <SanitizedRichText html="<h2>Heading</h2><p>Hello <strong>world</strong> and <code>code</code>.</p><ul><li>First</li></ul>" />,
  );

  await expect
    .element(screen.getByRole('heading', { name: 'Heading' }))
    .toBeVisible();
  await expect.element(screen.getByText('Hello world and code.')).toBeVisible();
  expect(screen.container.querySelector('.tr-rich-text')).not.toBeNull();
  expect(screen.container.querySelector('h2')).not.toBeNull();
  expect(screen.container.querySelector('code')).not.toBeNull();
  expect(screen.container.querySelector('ul > li')).not.toBeNull();
});

test('passes className and variant to TRRichText', async () => {
  const screen = await render(
    <SanitizedRichText
      className="product-notice"
      html="<p>Notice</p>"
      variant="notice"
    />,
  );

  const richText = screen.container.querySelector('.tr-rich-text');
  expect(richText).not.toBeNull();
  expect(richText?.classList.contains('product-notice')).toBe(true);
  expect(richText?.getAttribute('data-variant')).toBe('notice');
});

test('keeps allowed links and enforces the new-window policy', async () => {
  const screen = await render(
    <SanitizedRichText
      html={
        '<p><a href="https://example.com" target="_blank" rel="opener" onclick="alert(1)">Documentation</a> <a href="terms/latest" target="named">Terms</a> <a href="mailto:help@example.com">Email</a> <a href="tel:+821012345678">Call</a></p>'
      }
    />,
  );
  const externalLink = screen.getByRole('link', { name: 'Documentation' });

  await expect
    .element(externalLink)
    .toHaveAttribute('href', 'https://example.com');
  await expect.element(externalLink).toHaveAttribute('target', '_blank');
  await expect
    .element(externalLink)
    .toHaveAttribute('rel', 'noopener noreferrer');
  await expect.element(externalLink).not.toHaveAttribute('onclick');

  const relativeLink = screen.getByRole('link', { name: 'Terms' });
  await expect.element(relativeLink).toHaveAttribute('href', 'terms/latest');
  await expect.element(relativeLink).not.toHaveAttribute('target');
  await expect.element(relativeLink).not.toHaveAttribute('rel');
  await expect
    .element(screen.getByRole('link', { name: 'Email' }))
    .toHaveAttribute('href', 'mailto:help@example.com');
  await expect
    .element(screen.getByRole('link', { name: 'Call' }))
    .toHaveAttribute('href', 'tel:+821012345678');
});

test('removes unsafe links, attributes, and executable elements', async () => {
  const screen = await render(
    <SanitizedRichText
      html={
        '<script>alert(1)</script><style>body{display:none}</style><template>Hidden template</template><p onclick="alert(2)"><a href="javascript:alert(3)">JavaScript</a> <a href="//evil.example">Protocol relative</a> <a href="\\\\evil.example">Backslash relative</a><img src=x onerror="alert(4)">Safe text</p>'
      }
    />,
  );

  await expect.element(screen.getByText(/JavaScript/)).toBeVisible();
  await expect.element(screen.getByText(/Protocol relative/)).toBeVisible();
  await expect.element(screen.getByText(/Backslash relative/)).toBeVisible();
  await expect.element(screen.getByText(/Safe text/)).toBeVisible();
  expect(screen.container.querySelector('script')).toBeNull();
  expect(screen.container.querySelector('style')).toBeNull();
  expect(screen.container.querySelector('template')).toBeNull();
  expect(screen.container.querySelector('img')).toBeNull();
  expect(screen.container.querySelector('a')).toBeNull();
  expect(screen.container.querySelector('[onclick]')).toBeNull();
  expect(screen.container.textContent).not.toContain('alert(1)');
  expect(screen.container.textContent).not.toContain('Hidden template');
});

test('discards unknown containers but preserves safe descendants', async () => {
  const screen = await render(
    <SanitizedRichText html="<custom-element>Preserved <strong>text</strong></custom-element>" />,
  );

  await expect.element(screen.getByText('Preserved text')).toBeVisible();
  expect(screen.container.querySelector('custom-element')).toBeNull();
  expect(screen.container.querySelector('strong')).not.toBeNull();
});
