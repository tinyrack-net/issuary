import { TRText } from '@tinyrack/ui/components/text';
import { useBranding } from '#frontend/features/layout/use-branding.ts';

/**
 * The deployment identity shown at the start of the centred auth column.
 *
 * The product name remains the page's `h1`, so screen titles become `h2` when
 * branding is configured. With no product name, `AuthPageHeader` promotes the
 * screen title to `h1`. The decorative icon does not affect that hierarchy.
 */
export function AuthBrandHeader() {
  const { title, iconUrl } = useBranding();

  if (!title && !iconUrl) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-tinyrack-sm">
      {iconUrl && (
        <img alt="" className="size-tinyrack-xl object-contain" src={iconUrl} />
      )}
      {title && (
        <TRText as="h1" truncate variant="headingMd" weight="heading">
          {title}
        </TRText>
      )}
    </div>
  );
}
