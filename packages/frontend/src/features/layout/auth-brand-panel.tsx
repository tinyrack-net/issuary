import { TRText } from '@tinyrack/ui/components/text';
import { useBranding } from '#frontend/features/layout/use-branding.ts';

type AuthBrandPanelProps = {
  lang?: string;
};

/**
 * The deployment's identity, rendered once for the whole auth surface.
 *
 * There is a single instance in the DOM at every breakpoint: a full-height
 * inverse panel beside the form from `md:` up, and a compact banner strip
 * above it below that. Rendering it twice and hiding one would give the brand
 * title two heading nodes and the icon two `img` nodes, which both the e2e
 * assertions and assistive technology would read as duplicates.
 *
 * This is the page's `h1`. Screen titles below it are `h2`, so the heading
 * outline reads "product > what you are doing here".
 */
export function AuthBrandPanel({ lang }: AuthBrandPanelProps) {
  const { title, subtitle, iconUrl, backgroundUrl } = useBranding(lang);

  return (
    <div className="relative isolate col-span-full flex flex-row items-center gap-tinyrack-md overflow-hidden bg-tinyrack-surface-inverse px-tinyrack-lg py-tinyrack-md text-tinyrack-text-inverse md:col-span-4 md:flex-col md:items-start md:justify-between md:gap-tinyrack-2xl md:px-tinyrack-2xl md:py-tinyrack-2xl lg:col-span-5">
      {backgroundUrl && (
        <>
          {/*
           * Kept as an inline style rather than an arbitrary Tailwind class:
           * the URL is runtime config, so it cannot be part of the CSS build.
           */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-center bg-cover"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-tinyrack-scrim"
          />
        </>
      )}

      <div className="flex flex-row items-center gap-tinyrack-sm md:flex-col md:items-start md:gap-tinyrack-lg">
        {iconUrl && (
          <img
            alt=""
            className="size-8 object-contain md:size-12"
            src={iconUrl}
          />
        )}
        <TRText
          align="start"
          as="h1"
          className="text-tinyrack-lg md:text-tinyrack-3xl"
          weight="heading"
        >
          {title}
        </TRText>
      </div>

      {subtitle && (
        <TRText
          align="start"
          as="p"
          className="hidden max-w-tinyrack-measure-xl opacity-tinyrack-hover md:block"
          variant="headingSm"
          weight="regular"
        >
          {subtitle}
        </TRText>
      )}
    </div>
  );
}
