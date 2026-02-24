import {
  AppleLogoIcon,
  GithubLogoIcon,
  GoogleLogoIcon,
  LinkIcon,
} from '@phosphor-icons/react';
import { createElement, type ElementType, type ReactNode } from 'react';
import type { OAuthProviderType } from '#frontend/queries/config.js';

type LoginMethodButtonProps<C extends ElementType> = {
  as: C;
  icon?: string | ReactNode;
  label: string;
  providerType?: OAuthProviderType;
  isLoading?: boolean;
} & Record<string, unknown>;

const PROVIDER_ICONS: Record<
  Exclude<OAuthProviderType, 'generic_oauth'>,
  ReactNode
> = {
  google: <GoogleLogoIcon className="size-6" weight="regular" />,
  github: <GithubLogoIcon className="size-6" weight="regular" />,
  apple: <AppleLogoIcon className="size-6" weight="regular" />,
};

export function LoginMethodButton<C extends ElementType>({
  as: Component,
  icon,
  label,
  providerType,
  isLoading,
  ...rest
}: LoginMethodButtonProps<C>) {
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

  return createElement(
    Component,
    {
      className:
        'btn btn-ghost flex h-auto flex-row gap-2 border-base-300 py-3 sm:flex-col',
      ...rest,
    },
    content,
  );
}
