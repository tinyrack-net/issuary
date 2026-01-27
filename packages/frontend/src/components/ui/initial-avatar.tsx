type InitialAvatarProps = {
  email: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClasses: Record<NonNullable<InitialAvatarProps['size']>, string> = {
  sm: 'size-8 text-sm',
  md: 'size-12 text-xl',
  lg: 'size-16 text-2xl',
};

export function InitialAvatar({ email, size = 'md' }: InitialAvatarProps) {
  const initial = email.charAt(0).toUpperCase();

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-content ${sizeClasses[size]}`}
    >
      {initial}
    </div>
  );
}
