import type { OAuthProviderType } from '@frontend/queries/config.js';
import {
  AppleLogoIcon,
  GithubLogoIcon,
  GoogleLogoIcon,
  LinkIcon,
} from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

type LoginMethodButtonProps = {
  icon?: string | ReactNode;
  label: string;
  // OAuth provider type for well-known icons
  providerType?: OAuthProviderType;
  // External link
  href?: string;
  // Internal route (TanStack Router)
  to?: string;
  search?: Record<string, unknown>;
  // Button action
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
};

const PROVIDER_ICONS: Record<
  Exclude<OAuthProviderType, 'generic_oauth'>,
  ReactNode
> = {
  google: <GoogleLogoIcon className="size-6" weight="regular" />,
  github: <GithubLogoIcon className="size-6" weight="regular" />,
  apple: <AppleLogoIcon className="size-6" weight="regular" />,
};

export function LoginMethodButton({
  icon,
  label,
  providerType,
  href,
  to,
  search,
  onClick,
  isLoading,
  disabled,
  'data-testid': testId,
}: LoginMethodButtonProps) {
  // Determine icon: providerType icon > custom icon > fallback
  let iconElement: ReactNode;
  if (providerType && providerType !== 'generic_oauth') {
    iconElement = PROVIDER_ICONS[providerType];
  } else if (typeof icon === 'string') {
    iconElement = <img alt="" className="size-6" src={icon} />;
  } else if (icon) {
    iconElement = icon;
  } else {
    iconElement = <LinkIcon className="size-6" weight="regular" />;
  }

  const content = isLoading ? (
    <span className="loading loading-spinner loading-md" />
  ) : (
    <>
      {iconElement}
      <span className="text-xs">{label}</span>
    </>
  );

  const className =
    'btn btn-ghost flex h-auto flex-row gap-2 border-base-300 py-3 sm:flex-col';

  // External link
  if (href) {
    return (
      <a className={className} data-testid={testId} href={href}>
        {content}
      </a>
    );
  }

  // Internal route
  if (to) {
    return (
      <Link className={className} data-testid={testId} search={search} to={to}>
        {content}
      </Link>
    );
  }

  // Button
  return (
    <button
      className={className}
      data-testid={testId}
      disabled={disabled || isLoading}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  );
}
