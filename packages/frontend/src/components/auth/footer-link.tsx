import { Link } from '@tanstack/react-router';

type FooterLinkProps = {
  text: string;
  linkText: string;
  to: string;
  search?: Record<string, unknown>;
  className?: string;
};

export function FooterLink({
  text,
  linkText,
  to,
  search,
  className = '',
}: FooterLinkProps) {
  return (
    <div
      className={`mt-6 text-center text-base-content/70 text-xs ${className}`}
    >
      {text}{' '}
      <Link className="link link-info font-medium" search={search} to={to}>
        {linkText}
      </Link>
    </div>
  );
}
