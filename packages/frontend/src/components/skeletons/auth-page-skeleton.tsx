import {
  SkeletonButton,
  SkeletonInput,
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
      <SkeletonLine className="h-7 w-48" />
      <SkeletonLine className="h-4 w-64" />
    </div>
  );
}

/**
 * Skeleton for Login/Register pages with OAuth buttons and form.
 */
export function AuthPageSkeleton() {
  return (
    <SkeletonLayout>
      <SkeletonHeader />

      {/* OAuth buttons */}
      <div className="flex flex-col gap-3">
        <SkeletonButton />
        <SkeletonButton />
      </div>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-base-300" />
        <SkeletonLine className="h-3 w-32" />
        <div className="h-px flex-1 bg-base-300" />
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-4">
        <SkeletonInput />
        <SkeletonInput />
        <SkeletonLine className="ml-auto h-3 w-24" />
        <SkeletonButton className="mt-2" />
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-center gap-1">
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="h-3 w-16" />
      </div>
    </SkeletonLayout>
  );
}

/**
 * Minimal skeleton for simple auth pages (forgot-password, reset-password, verify-email).
 */
export function SimpleAuthPageSkeleton() {
  return (
    <SkeletonLayout>
      <SkeletonHeader />

      {/* Form fields */}
      <div className="flex flex-col gap-4">
        <SkeletonInput />
        <SkeletonButton className="mt-2" />
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-center gap-1">
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="h-3 w-16" />
      </div>
    </SkeletonLayout>
  );
}
