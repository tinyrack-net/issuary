import { TRText } from '@tinyrack/ui/components/text';
import { useBranding } from '#frontend/features/layout/use-branding.ts';

type AuthBrandHeaderProps = {
  showSubtitle?: boolean;
};

/**
 * The deployment identity shown at the start of the centred auth column.
 *
 * The product name remains the page's `h1`. A custom logo visually replaces
 * both the app icon and title while retaining the configured title as its
 * accessible name.
 */
export function AuthBrandHeader({
  showSubtitle = false,
}: AuthBrandHeaderProps) {
  const { title, subtitle, iconUrl, logoUrl } = useBranding();

  return (
    // tinyrack-check-ignore-next-line components/no-native-text -- Structural brand stack; title and subtitle use TRText and images are approved brand assets.
    <div className="flex min-w-0 flex-col items-start gap-tinyrack-sm">
      {logoUrl ? (
        <TRText
          aria-label={title ?? 'Issuary'}
          as="h1"
          className="w-full"
          variant="headingLg"
        >
          <img
            alt=""
            className="h-tinyrack-3xl w-full object-contain object-center"
            src={logoUrl}
          />
        </TRText>
      ) : (
        /* tinyrack-check-ignore-next-line components/no-native-text -- Structural brand row; visible title uses TRText. */
        <div className="flex w-full min-w-0 items-center justify-center gap-tinyrack-sm">
          <img
            alt=""
            className="size-tinyrack-2xl shrink-0 object-contain"
            src={iconUrl}
          />
          {title && (
            <TRText as="h1" truncate variant="headingLg" weight="heading">
              {title}
            </TRText>
          )}
        </div>
      )}
      {showSubtitle && subtitle && (
        <TRText
          align="center"
          as="p"
          className="w-full text-tinyrack-xl"
          color="muted"
          variant="body"
        >
          {subtitle}
        </TRText>
      )}
    </div>
  );
}
