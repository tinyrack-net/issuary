import {
  SkeletonBox,
  SkeletonButton,
  SkeletonLine,
} from '@/components/skeletons/skeleton.js';

/**
 * Skeleton layout wrapper that matches AuthPageLayout structure.
 */
function SkeletonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
        {children}
      </div>
    </div>
  );
}

/**
 * Skeleton header matching PageHeader component.
 */
function SkeletonHeader() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <SkeletonLine className="h-7 w-28" />
      <SkeletonLine className="h-4 w-56" />
    </div>
  );
}

/**
 * Skeleton for Consent page.
 */
export function ConsentPageSkeleton() {
  return (
    <SkeletonLayout>
      <SkeletonHeader />

      {/* User info */}
      <div className="mb-4 rounded-lg bg-base-200 p-3 text-center">
        <SkeletonLine className="mx-auto h-3 w-20" />
        <SkeletonLine className="mx-auto mt-1 h-4 w-40" />
      </div>

      {/* Permissions title */}
      <div className="mb-4">
        <SkeletonLine className="mb-3 h-4 w-48" />

        {/* Permission items */}
        <div className="flex flex-col gap-2">
          <SkeletonBox className="h-14 w-full" />
          <SkeletonBox className="h-14 w-full" />
          <SkeletonBox className="h-14 w-full" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <SkeletonButton className="flex-1" />
        <SkeletonButton className="flex-1" />
      </div>
    </SkeletonLayout>
  );
}
