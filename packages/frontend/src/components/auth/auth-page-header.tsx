import { TRText } from '@tinyrack/ui/components/text';

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
 * This is an `h2`: the deployment's name in the brand panel is the page's
 * `h1`, so the outline reads "product > what you are doing here".
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
  return (
    <div
      className={`flex flex-col gap-tinyrack-xs ${align === 'center' ? 'items-center text-center' : 'items-start text-start'}`}
    >
      {eyebrow}
      <TRText align={align} as="h2" variant="headingLg">
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
