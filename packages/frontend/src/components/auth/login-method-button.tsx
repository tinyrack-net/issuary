import { TRButton } from '@tinyrack/ui/components/button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { LinkIcon } from 'lucide-react';
import { createElement, type ElementType, type ReactNode } from 'react';
import {
  AppleLogo,
  GithubLogo,
  GoogleLogo,
} from '#frontend/components/auth/provider-logos.tsx';
import type { OAuthProviderType } from '#frontend/queries/config.ts';

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
  google: <GoogleLogo className="size-6" />,
  github: <GithubLogo className="size-6" />,
  apple: <AppleLogo className="size-6" />,
};

const COMMON_CLASSES = 'flex h-auto flex-row gap-2 py-3 sm:flex-col';

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
    iconElement = <LinkIcon className="size-6" />;
  }

  const content = (
    <>
      {iconElement}
      <span className="text-tinyrack-xs">{label}</span>
    </>
  );

  if (Component === 'button') {
    return (
      <TRButton
        appearance="outline"
        className={COMMON_CLASSES}
        intent="neutral"
        loading={isLoading}
        uiSize="md"
        {...rest}
      >
        {content}
      </TRButton>
    );
  }

  const linkContent = isLoading ? <TRSpinner uiSize="md" /> : content;

  return (
    <TRLinkButton
      appearance="outline"
      className={`cursor-pointer ${COMMON_CLASSES}`}
      intent="neutral"
      render={createElement(Component, rest as object)}
      uiSize="md"
    >
      {linkContent}
    </TRLinkButton>
  );
}
