import { createElement, type ElementType } from 'react';

type FooterLinkProps<C extends ElementType> = {
  as: C;
  text: string;
  linkText: string;
  className?: string;
} & Record<string, unknown>;

export function FooterLink<C extends ElementType>({
  as: Component,
  text,
  linkText,
  className = '',
  ...linkProps
}: FooterLinkProps<C>) {
  return (
    <div
      className={`mt-6 text-center text-base-content/70 text-xs ${className}`}
    >
      {text}{' '}
      {createElement(
        Component,
        { className: 'link link-info font-medium', ...linkProps },
        linkText,
      )}
    </div>
  );
}
