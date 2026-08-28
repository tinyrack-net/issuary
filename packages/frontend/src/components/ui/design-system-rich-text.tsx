import { TRCode } from '@tinyrack/ui/components/code';
import { TRLink } from '@tinyrack/ui/components/link';
import { TRText } from '@tinyrack/ui/components/text';
import { Fragment, type ReactNode, useMemo } from 'react';

type DesignSystemRichTextVariant = 'notice' | 'document';

type DesignSystemRichTextProps = {
  className?: string;
  html: string;
  variant?: DesignSystemRichTextVariant;
};

const BLOCKED_ELEMENTS = new Set(['script', 'style', 'template']);
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function safeHref(value: string): string | undefined {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) return undefined;

  try {
    const url = new URL(trimmedValue, 'https://issuary.invalid');
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmedValue : undefined;
  } catch {
    return undefined;
  }
}

function renderChildren(
  node: Node,
  variant: DesignSystemRichTextVariant,
): ReactNode[] {
  return Array.from(node.childNodes, (child, index) => (
    <Fragment key={index}>{renderNode(child, variant)}</Fragment>
  ));
}

function renderHeading(level: string, children: ReactNode[]): ReactNode {
  switch (level) {
    case 'h1':
      return (
        <TRText
          as="h1"
          className="mt-tinyrack-lg mb-tinyrack-sm"
          variant="headingLg"
          weight="heading"
        >
          {children}
        </TRText>
      );
    case 'h2':
      return (
        <TRText
          as="h2"
          className="mt-tinyrack-lg mb-tinyrack-sm"
          variant="headingMd"
          weight="heading"
        >
          {children}
        </TRText>
      );
    case 'h3':
      return (
        <TRText
          as="h3"
          className="mt-tinyrack-lg mb-tinyrack-sm"
          variant="headingSm"
          weight="heading"
        >
          {children}
        </TRText>
      );
    case 'h4':
      return (
        <TRText
          as="h4"
          className="mt-tinyrack-lg mb-tinyrack-sm"
          variant="body"
          weight="heading"
        >
          {children}
        </TRText>
      );
    case 'h5':
      return (
        <TRText
          as="h5"
          className="mt-tinyrack-lg mb-tinyrack-sm"
          variant="bodySm"
          weight="heading"
        >
          {children}
        </TRText>
      );
    default:
      return (
        <TRText
          as="h6"
          className="mt-tinyrack-lg mb-tinyrack-sm"
          variant="caption"
          weight="heading"
        >
          {children}
        </TRText>
      );
  }
}

function renderNode(
  node: Node,
  variant: DesignSystemRichTextVariant,
): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element)) return null;

  const tagName = node.tagName.toLowerCase();
  if (BLOCKED_ELEMENTS.has(tagName)) return null;
  const children = renderChildren(node, variant);

  if (/^h[1-6]$/u.test(tagName)) return renderHeading(tagName, children);

  switch (tagName) {
    case 'p':
      return (
        <TRText
          as="p"
          className={variant === 'document' ? 'mb-tinyrack-md' : undefined}
          color={variant === 'notice' ? 'muted' : 'default'}
          variant={variant === 'notice' ? 'caption' : 'body'}
        >
          {children}
        </TRText>
      );
    case 'code':
      return <TRCode>{children}</TRCode>;
    case 'a': {
      const href = safeHref(node.getAttribute('href') ?? '');
      if (href === undefined) return children;
      const opensNewWindow = node.getAttribute('target') === '_blank';
      return (
        <TRLink
          href={href}
          rel={opensNewWindow ? 'noopener noreferrer' : undefined}
          target={opensNewWindow ? '_blank' : undefined}
        >
          {children}
        </TRLink>
      );
    }
    case 'ul':
      return (
        <ul className="mb-tinyrack-md list-disc ps-tinyrack-lg">{children}</ul>
      );
    case 'ol':
      return (
        <ol className="mb-tinyrack-md list-decimal ps-tinyrack-lg">
          {children}
        </ol>
      );
    case 'li':
      return (
        <TRText as="li" variant={variant === 'notice' ? 'caption' : 'body'}>
          {children}
        </TRText>
      );
    case 'strong':
      return <strong>{children}</strong>;
    case 'em':
      return <em>{children}</em>;
    case 'br':
      return <br />;
    default:
      return children;
  }
}

export function DesignSystemRichText({
  className,
  html,
  variant = 'document',
}: DesignSystemRichTextProps) {
  const content = useMemo(() => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return renderChildren(document.body, variant);
  }, [html, variant]);

  return <section className={className}>{content}</section>;
}
