import { LinkIcon } from 'lucide-react';
import type { SVGProps } from 'react';

/**
 * Brand marks for the built-in identity providers.
 *
 * The design system mandates `lucide-react` as the only icon library, and
 * lucide ships no brand icons — its `Apple` is the fruit. These are the
 * official marks, inlined so no second icon package is needed. Google's is
 * multicolour by trademark requirement and so cannot be a stroke icon anyway.
 *
 * Each renders at the caller's `className` size and is decorative: the
 * accessible name comes from the surrounding button label.
 */

type ProviderLogoProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'>;

const LOGOS_BY_ID: Record<
  string,
  (props: ProviderLogoProps) => React.ReactElement
> = {
  google: GoogleLogo,
  github: GithubLogo,
  apple: AppleLogo,
};

type ProviderMarkProps = {
  /** Configured provider id. Built-in providers use their own name. */
  providerId: string;
  /** Deployment-supplied icon, used for providers with no built-in mark. */
  iconUrl?: string;
  className?: string;
};

/**
 * The mark for a configured provider, however it is identified.
 *
 * Profile's provider list carries an id and an optional icon URL but no
 * provider type, so this resolves by id first — which is what the built-in
 * providers are named — then the deployment's own icon, then a generic link
 * glyph for an unrecognised custom provider.
 */
export function ProviderMark({
  providerId,
  iconUrl,
  className = 'size-5',
}: ProviderMarkProps) {
  const Logo = LOGOS_BY_ID[providerId];
  if (Logo) {
    return <Logo className={className} />;
  }
  if (iconUrl) {
    return <img alt="" className={className} src={iconUrl} />;
  }
  return <LinkIcon aria-hidden className={className} />;
}

export function GoogleLogo(props: ProviderLogoProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative, named by its button
    <svg aria-hidden focusable="false" viewBox="0 0 24 24" {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GithubLogo(props: ProviderLogoProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative, named by its button
    <svg
      aria-hidden
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.79 1.07.79 2.15v3.19c0 .31.2.67.8.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function AppleLogo(props: ProviderLogoProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative, named by its button
    <svg
      aria-hidden
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M17.05 12.74c-.03-2.7 2.2-4 2.3-4.06-1.25-1.83-3.2-2.08-3.9-2.11-1.66-.17-3.24.98-4.08.98-.84 0-2.14-.96-3.52-.93-1.81.03-3.48 1.05-4.41 2.67-1.88 3.27-.48 8.1 1.35 10.75.9 1.3 1.96 2.75 3.36 2.7 1.35-.06 1.86-.87 3.49-.87 1.63 0 2.09.87 3.51.84 1.45-.02 2.37-1.32 3.26-2.63 1.03-1.5 1.45-2.96 1.47-3.04-.03-.01-2.82-1.08-2.85-4.3ZM14.4 4.8c.74-.9 1.24-2.15 1.1-3.4-1.07.05-2.36.72-3.13 1.61-.68.79-1.28 2.06-1.12 3.28 1.19.09 2.41-.61 3.15-1.5Z" />
    </svg>
  );
}
