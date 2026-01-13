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
      <SkeletonLine className="h-7 w-32" />
      <SkeletonLine className="h-4 w-48" />
    </div>
  );
}

/**
 * Skeleton for a section card (password, totp, passkey, linked accounts).
 */
function SkeletonSection() {
  return (
    <div className="mb-4 rounded-lg border border-base-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-3 w-40" />
        </div>
        <SkeletonBox className="h-8 w-20" />
      </div>
    </div>
  );
}

/**
 * Skeleton for Profile page.
 */
export function ProfilePageSkeleton() {
  return (
    <SkeletonLayout>
      <SkeletonHeader />

      {/* User info card */}
      <div className="mb-4 rounded-lg bg-base-200 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-3 w-48" />
          </div>
          <div className="flex items-center justify-between">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-3 w-16" />
          </div>
        </div>
      </div>

      {/* Password section */}
      <SkeletonSection />

      {/* TOTP section */}
      <SkeletonSection />

      {/* Passkey section */}
      <SkeletonSection />

      {/* Linked accounts section */}
      <div className="mb-4 rounded-lg border border-base-200 p-4">
        <div className="mb-3 flex flex-col gap-1">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-3 w-48" />
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonBox className="h-12 w-full" />
          <SkeletonBox className="h-12 w-full" />
        </div>
      </div>

      {/* Logout button */}
      <SkeletonButton />
    </SkeletonLayout>
  );
}
