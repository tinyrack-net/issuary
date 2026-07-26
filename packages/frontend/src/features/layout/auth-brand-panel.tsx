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
    /*
     * Pinned to the dark theme rather than using the `inverse` tokens.
     * `--tinyrack-text-inverse` flips with the active theme, so in dark mode it
     * resolves to near-black — which is illegible over the always-dark scrim a
     * background image sits under. Scoping `data-theme` here makes every
     * token inside the panel resolve consistently, so the brand surface reads
     * the same in both app themes and the scrim always works.
     */
    <div
      className="relative isolate col-span-full flex h-16 flex-row items-center gap-tinyrack-md overflow-hidden border-tinyrack-border border-b bg-tinyrack-surface-muted px-tinyrack-lg text-tinyrack-text md:col-span-4 md:h-auto md:flex-col md:items-start md:justify-between md:gap-tinyrack-2xl md:border-e md:border-b-0 md:px-tinyrack-2xl md:py-tinyrack-2xl lg:col-span-5"
      data-theme="tinyrack-dark"
    >
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
          className="hidden max-w-tinyrack-measure-xl md:block"
          color="muted"
          variant="headingSm"
          weight="regular"
        >
          {subtitle}
        </TRText>
      )}
    </div>
  );
}
