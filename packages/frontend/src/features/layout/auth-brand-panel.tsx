import { TRText } from '@tinyrack/ui/components/text';
import { useBranding } from '#frontend/features/layout/use-branding.ts';

/**
 * The deployment's identity, rendered once for the whole auth surface.
 *
 * There is a single instance in the DOM at every breakpoint: a full-height
 * inverse panel beside the form from `md:` up, and a compact banner strip
 * above it below that. Rendering it twice and hiding one would give the brand
 * title two heading nodes and the icon two `img` nodes, which both the e2e
 * assertions and assistive technology would read as duplicates.
 *
 * When the deployment has configured a product name, that name is the page's
 * `h1` and screen titles sit under it as `h2`. When it has not, the panel has
 * no heading and the screen title becomes the `h1` — see `AuthPageHeader`.
 *
 * Pinned to the dark theme rather than using the `inverse` tokens.
 * `--tinyrack-text-inverse` flips with the active theme, so in dark mode it
 * resolves to near-black — which is illegible over the always-dark scrim a
 * background image sits under. Scoping `data-theme` here makes every token
 * inside the panel resolve consistently, so the brand surface reads the same
 * in both app themes and the scrim always works.
 */
export function AuthBrandPanel() {
  const { title, subtitle, iconUrl, backgroundUrl } = useBranding();

  return (
    <div
      className="relative isolate col-span-full flex flex-col items-start justify-between gap-tinyrack-xs overflow-hidden border-tinyrack-border border-b bg-tinyrack-surface-muted px-tinyrack-lg py-tinyrack-md text-tinyrack-text md:col-span-4 md:gap-tinyrack-2xl md:border-e md:border-b-0 md:px-tinyrack-2xl md:py-tinyrack-2xl lg:col-span-5"
      data-theme="tinyrack-dark"
    >
      {backgroundUrl && (
        <>
          {/*
            Kept as an inline style rather than an arbitrary Tailwind class: the
            URL is runtime config, so it cannot be part of the CSS build.
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

      <div className="flex min-w-0 flex-row items-center gap-tinyrack-sm md:flex-col md:items-start md:gap-tinyrack-lg">
        {iconUrl && (
          <img
            alt=""
            className="size-8 object-contain md:size-12"
            src={iconUrl}
          />
        )}
        {/*
          Sized through `--tr-text-font-size`, the override hook TRText exposes,
          rather than a `text-*` utility: the component's own per-variant rule
          is more specific than a utility class, so a utility is ignored. Still
          token-only, and responsive because the mobile banner has far less
          room than the panel.
        */}
        {title && (
          <TRText
            align="start"
            as="h1"
            className="[--tr-text-font-size:var(--tinyrack-text-lg)] md:[--tr-text-font-size:var(--tinyrack-text-3xl)]"
            weight="heading"
          >
            {title}
          </TRText>
        )}
      </div>

      {/*
        Shown at every width — this is the deployment's own copy, so hiding it
        on phones would drop configured content. One line in the mobile banner,
        the full string beside the form. Sized through the component's override
        hook for the same reason as the title above.
      */}
      {subtitle && (
        <TRText
          align="start"
          as="p"
          className="max-w-tinyrack-measure-xl truncate [--tr-text-font-size:var(--tinyrack-text-xs)] md:overflow-visible md:whitespace-normal md:[--tr-text-font-size:var(--tinyrack-text-lg)]"
          color="muted"
        >
          {subtitle}
        </TRText>
      )}
    </div>
  );
}
