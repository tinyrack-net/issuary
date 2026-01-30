import { Link } from '@tanstack/react-router';

type FooterLinkProps = {
  text: string;
  linkText: string;
  to: string;
  search?: Record<string, unknown>;
  className?: string;
  'data-testid'?: string;
};

export function FooterLink({
  text,
  linkText,
  to,
  search,
  className = '',
  'data-testid': testId,
}: FooterLinkProps) {
  return (
    <div
      className={`mt-6 text-center text-base-content/70 text-xs ${className}`}
    >
      {text}{' '}
      <Link
        to={to}
        search={search}
        className="link link-info font-medium"
        data-testid={testId}
      >
        {linkText}
      </Link>
    </div>
  );
}
