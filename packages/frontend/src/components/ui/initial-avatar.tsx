import { TRAvatar } from '@tinyrack/ui/components/avatar';

type InitialAvatarProps = {
  email: string;
  size?: 'sm' | 'md' | 'lg';
};

const uiSizeBySize: Record<
  NonNullable<InitialAvatarProps['size']>,
  'md' | 'xl' | '2xl'
> = {
  sm: 'md',
  md: 'xl',
  lg: '2xl',
};

export function InitialAvatar({ email, size = 'md' }: InitialAvatarProps) {
  const initial = email.charAt(0).toUpperCase();

  return (
    <TRAvatar.Root
      className="shrink-0 font-tinyrack-bold"
      shape="circle"
      uiSize={uiSizeBySize[size]}
    >
      <TRAvatar.Fallback>{initial}</TRAvatar.Fallback>
    </TRAvatar.Root>
  );
}
