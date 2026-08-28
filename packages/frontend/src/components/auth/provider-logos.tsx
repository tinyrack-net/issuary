import { TRProviderMark } from '@tinyrack/ui/components/provider-mark';
import { LinkIcon } from 'lucide-react';

/**
 * Brand marks for the built-in identity providers.
 *
 * Built-in provider marks come from the design system so their official brand
 * geometry and colors stay encapsulated upstream. Custom deployments can
 * still supply their own provider image.
 *
 * Each renders at the caller's `className` size and is decorative: the
 * accessible name comes from the surrounding button label.
 */

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
  className = 'size-tinyrack-xl',
}: ProviderMarkProps) {
  if (
    providerId === 'google' ||
    providerId === 'github' ||
    providerId === 'apple'
  ) {
    return (
      <TRProviderMark aria-hidden className={className} provider={providerId} />
    );
  }
  if (iconUrl) {
    return <img alt="" className={className} src={iconUrl} />;
  }
  return <LinkIcon aria-hidden className={className} />;
}
