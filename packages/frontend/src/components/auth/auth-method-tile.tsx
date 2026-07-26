import { TRButton } from '@tinyrack/ui/components/button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRText } from '@tinyrack/ui/components/text';
import { LinkIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import {
  AppleLogo,
  GithubLogo,
  GoogleLogo,
} from '#frontend/components/auth/provider-logos.tsx';
import type { OAuthProviderType } from '#frontend/queries/config.ts';

type AuthMethodTileBaseProps = {
  /** A provider icon URL, or a ready-made element. */
  icon?: string | ReactNode;
  label: string;
  providerType?: OAuthProviderType;
};

type AuthMethodTileProps = AuthMethodTileBaseProps &
  (
    | {
        /** Navigating method (OAuth, or the email form). Must be a real anchor. */
        render: ReactElement;
        onClick?: never;
        isLoading?: never;
        disabled?: never;
      }
    | {
        render?: never;
        /** In-page method (passkey), which runs a ceremony instead of navigating. */
        onClick: () => void;
        isLoading?: boolean;
        disabled?: boolean;
      }
  );

const PROVIDER_LOGOS: Record<
  Exclude<OAuthProviderType, 'generic_oauth'>,
  ReactNode
> = {
  google: <GoogleLogo className="size-5" />,
  github: <GithubLogo className="size-5" />,
  apple: <AppleLogo className="size-5" />,
};

/**
 * One sign-in method on the method chooser.
 *
 * Full-width rows at every breakpoint. The previous three-across grid gave
 * each tile a third of the card, so provider names wrapped onto two lines and
 * the icons and labels never lined up between tiles.
 */
export function AuthMethodTile({
  icon,
  label,
  providerType,
  render,
  onClick,
  isLoading,
  disabled,
}: AuthMethodTileProps) {
  let leading: ReactNode;
  if (providerType && providerType !== 'generic_oauth') {
    leading = PROVIDER_LOGOS[providerType];
  } else if (typeof icon === 'string') {
    leading = <img alt="" className="size-5" src={icon} />;
  } else if (icon) {
    leading = icon;
  } else {
    leading = <LinkIcon aria-hidden className="size-5" />;
  }

  const content = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center">
        {leading}
      </span>
      <TRText truncate variant="body">
        {label}
      </TRText>
    </>
  );

  const className =
    'w-full justify-start gap-tinyrack-md transition-colors duration-tinyrack-fast ease-tinyrack-standard';

  if (render) {
    return (
      <TRLinkButton
        appearance="outline"
        className={`cursor-pointer ${className}`}
        intent="neutral"
        render={render}
        uiSize="lg"
      >
        {content}
      </TRLinkButton>
    );
  }

  return (
    <TRButton
      appearance="outline"
      className={className}
      disabled={disabled}
      intent="neutral"
      loading={isLoading}
      onClick={onClick}
      type="button"
      uiSize="lg"
    >
      {content}
    </TRButton>
  );
}
