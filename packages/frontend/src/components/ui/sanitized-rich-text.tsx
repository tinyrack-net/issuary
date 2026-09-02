import {
  TRRichText,
  type TRRichTextProps,
} from '@tinyrack/ui/components/rich-text';
import parse, {
  type DOMNode,
  domToReact,
  Element,
  type HTMLReactParserOptions,
} from 'html-react-parser';
import { createElement, Fragment, useMemo } from 'react';

type SanitizedRichTextProps = Omit<TRRichTextProps, 'children'> & {
  html: string;
};

const ALLOWED_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'a',
  'code',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'br',
]);

const NON_TEXT_TAGS = new Set([
  'script',
  'style',
  'textarea',
  'option',
  'noscript',
  'template',
]);

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function isDomNode(node: Element['children'][number]): node is DOMNode {
  return node.type !== 'cdata' && node.type !== 'root';
}

function safeHref(value: string): string | undefined {
  const trimmedValue = value.trim();
  if (
    trimmedValue.length === 0 ||
    trimmedValue.startsWith('//') ||
    trimmedValue.startsWith('\\\\')
  ) {
    return undefined;
  }

  try {
    const url = new URL(trimmedValue, 'https://issuary.invalid');
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmedValue : undefined;
  } catch {
    return undefined;
  }
}

const PARSER_OPTIONS: HTMLReactParserOptions = {
  replace(domNode) {
    if (!(domNode instanceof Element)) return undefined;

    const tagName = domNode.name.toLowerCase();
    if (NON_TEXT_TAGS.has(tagName)) return createElement(Fragment);

    const children = domToReact(
      domNode.children.filter(isDomNode),
      PARSER_OPTIONS,
    );
    if (!ALLOWED_TAGS.has(tagName)) {
      return createElement(Fragment, undefined, children);
    }
    if (tagName !== 'a') {
      return createElement(tagName, undefined, children);
    }

    const href = safeHref(domNode.attribs['href'] ?? '');
    if (href === undefined) {
      return createElement('span', undefined, children);
    }
    const opensNewWindow = domNode.attribs['target'] === '_blank';
    return createElement(
      'a',
      {
        href,
        ...(opensNewWindow
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {}),
      },
      children,
    );
  },
};

function parseRichText(html: string) {
  return parse(html, PARSER_OPTIONS);
}

export function SanitizedRichText({ html, ...props }: SanitizedRichTextProps) {
  const content = useMemo(() => parseRichText(html), [html]);

  return <TRRichText {...props}>{content}</TRRichText>;
}
