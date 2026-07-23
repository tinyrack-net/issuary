import { TRAvatar } from '@tinyrack/ui/components/avatar';
import type { CSSProperties } from 'react';

type InitialAvatarProps = {
  email: string;
  size?: 'sm' | 'md' | 'lg';
};

/**
 * Brand-colored initial avatar built on the design system's `TRAvatar`.
 * Size, font size and the primary color pair are applied through the
 * component's own `--tr-avatar-*` custom properties so it composes the
 * design system rather than re-implementing an avatar.
 */
const sizeVars: Record<
  NonNullable<InitialAvatarProps['size']>,
  CSSProperties
> = {
  sm: {
    '--tr-avatar-size': '2rem',
    '--tr-avatar-font-size': 'var(--tinyrack-text-sm)',
  } as CSSProperties,
  md: {
    '--tr-avatar-size': '3rem',
    '--tr-avatar-font-size': 'var(--tinyrack-text-xl)',
  } as CSSProperties,
  lg: {
    '--tr-avatar-size': '4rem',
    '--tr-avatar-font-size': 'var(--tinyrack-text-2xl)',
  } as CSSProperties,
};

export function InitialAvatar({ email, size = 'md' }: InitialAvatarProps) {
  const initial = email.charAt(0).toUpperCase();

  return (
    <TRAvatar.Root
      className="shrink-0 font-bold"
      shape="circle"
      style={
        {
          ...sizeVars[size],
          '--tr-avatar-background': 'var(--tinyrack-primary)',
          '--tr-avatar-color': 'var(--tinyrack-on-primary)',
          '--tr-avatar-border': 'transparent',
        } as CSSProperties
      }
    >
      <TRAvatar.Fallback>{initial}</TRAvatar.Fallback>
    </TRAvatar.Root>
  );
}
