import { TRText } from '@tinyrack/ui/components/text';
import { useBranding } from '#frontend/features/layout/use-branding.ts';

type AuthPageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Small label above the title — wizard progress, flow context. */
  eyebrow?: React.ReactNode;
  /** Centre for terminal states (success, error) where there is no form to scan. */
  align?: 'start' | 'center';
};

/**
 * Titles the current screen.
 *
 * Heading level follows the brand header: when the deployment has configured
 * a product name that name is the page's `h1`, so this is an `h2` beneath it.
 * With no branding there is no other heading, so this becomes the `h1` rather
 * than leaving the page starting at level 2.
 *
 * Left-aligned by default. Centred auth copy reads as a consumer sign-up;
 * aligning it with the fields below reads as a console and gives the eye one
 * vertical line to follow into the form.
 *
 * Carries no margin — spacing is the caller's, so it composes into a stack.
 */
export function AuthPageHeader({
  title,
  subtitle,
  eyebrow,
  align = 'start',
}: AuthPageHeaderProps) {
  const { title: brandTitle, logoUrl } = useBranding();
  const headingTag = brandTitle || logoUrl ? 'h2' : 'h1';

  return (
    /* tinyrack-check-ignore-next-line components/no-native-text -- Structural header stack; eyebrow is a caller-owned DS node and copy uses TRText. */
    <div
      className={`flex flex-col gap-tinyrack-xs ${align === 'center' ? 'items-center text-center' : 'items-start text-start'}`}
    >
      {eyebrow}
      <TRText align={align} as={headingTag} variant="headingLg">
        {title}
      </TRText>
      {subtitle && (
        <TRText align={align} as="p" color="muted" variant="body">
          {subtitle}
        </TRText>
      )}
    </div>
  );
}
