import {
  TRRichText,
  type TRRichTextProps,
} from '@tinyrack/ui/components/rich-text';
import parse from 'html-react-parser';
import { useMemo } from 'react';
import sanitizeHtml from 'sanitize-html';

type SanitizedRichTextProps = Omit<TRRichTextProps, 'children'> & {
  html: string;
};

const ALLOWED_TAGS = [
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
];

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

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

function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: [
      'script',
      'style',
      'textarea',
      'option',
      'noscript',
      'template',
    ],
    transformTags: {
      a: (tagName, attributes) => {
        const href = safeHref(attributes.href ?? '');
        if (href === undefined) {
          return { tagName: 'span', attribs: {} };
        }

        const opensNewWindow = attributes.target === '_blank';
        return {
          tagName,
          attribs: {
            href,
            ...(opensNewWindow
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {}),
          },
        };
      },
    },
  });
}

export function SanitizedRichText({ html, ...props }: SanitizedRichTextProps) {
  const content = useMemo(() => parse(sanitizeRichText(html)), [html]);

  return <TRRichText {...props}>{content}</TRRichText>;
}
