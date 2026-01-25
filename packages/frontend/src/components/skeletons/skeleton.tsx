type SkeletonProps = {
  className?: string;
};

/**
 * Base skeleton line component for text placeholders.
 */
export function SkeletonLine({ className = '' }: SkeletonProps) {
  return <div className={`skeleton h-4 w-full rounded ${className}`} />;
}

/**
 * Skeleton circle component for avatar/icon placeholders.
 */
export function SkeletonCircle({ className = '' }: SkeletonProps) {
  return <div className={`skeleton aspect-square rounded-full ${className}`} />;
}

/**
 * Skeleton box component for card/button placeholders.
 */
export function SkeletonBox({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

/**
 * Skeleton input field component.
 */
export function SkeletonInput({ className = '' }: SkeletonProps) {
  return <div className={`skeleton h-12 w-full rounded-lg ${className}`} />;
}

/**
 * Skeleton button component.
 */
export function SkeletonButton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton h-10 w-full rounded-lg ${className}`} />;
}

/**
 * Skeleton for terms checkbox item.
 */
export function SkeletonTermsCheckbox({ className = '' }: SkeletonProps) {
  return <div className={`skeleton h-14 w-full rounded-lg ${className}`} />;
}
