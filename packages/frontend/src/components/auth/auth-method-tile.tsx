import { TRButton } from '@tinyrack/ui/components/button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRProviderMark } from '@tinyrack/ui/components/provider-mark';
import { TRText } from '@tinyrack/ui/components/text';
import { LinkIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
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
  google: (
    <TRProviderMark
      aria-hidden
      className="size-tinyrack-xl"
      provider="google"
    />
  ),
  github: (
    <TRProviderMark
      aria-hidden
      className="size-tinyrack-xl"
      provider="github"
    />
  ),
  apple: (
    <TRProviderMark aria-hidden className="size-tinyrack-xl" provider="apple" />
  ),
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
  } else if (typeof icon === 'string' && icon.length > 0) {
    leading = <img alt="" className="size-tinyrack-xl" src={icon} />;
  } else if (icon) {
    leading = icon;
  } else {
    leading = <LinkIcon aria-hidden className="size-tinyrack-xl" />;
  }

  const content = (
    <>
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural icon host; provider marks and deployment images are approved assets. */}
      <span className="flex size-tinyrack-xl shrink-0 items-center justify-center">
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
