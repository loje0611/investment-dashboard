interface SkeletonCardProps {
  lines?: number
  className?: string
}

export function SkeletonCard({ lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div className={`rounded-2xl border border-stroke bg-surface-card p-4 ${className}`}>
      <div className="skeleton mb-3 h-3 w-24" />
      <div className="skeleton mb-4 h-6 w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton mb-2 h-3" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${className}`}>
      <div className="skeleton h-4 w-24 shrink-0" />
      <div className="skeleton h-4 flex-1" />
      <div className="skeleton h-4 w-16 shrink-0" />
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="space-y-3">
      {/* Hero skeleton */}
      <div className="skeleton col-span-2 h-[120px] rounded-2xl" />
      {/* Bento 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-[100px] rounded-2xl" />
        <div className="skeleton h-[100px] rounded-2xl" />
        <div className="skeleton h-[100px] rounded-2xl" />
        <div className="skeleton h-[100px] rounded-2xl" />
      </div>
      {/* Chart section */}
      <div className="rounded-2xl border border-stroke bg-surface-card p-4">
        <div className="skeleton mb-4 h-4 w-20" />
        <div className="skeleton h-[200px] rounded-xl" />
      </div>
      <div className="rounded-2xl border border-stroke bg-surface-card p-4">
        <div className="skeleton mb-4 h-4 w-28" />
        <div className="flex gap-2">
          <div className="skeleton h-[56px] flex-1 rounded-xl" />
          <div className="skeleton h-[56px] flex-1 rounded-xl" />
        </div>
        <div className="skeleton mt-3 h-[200px] rounded-xl" />
      </div>
    </div>
  )
}

export function AssetListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-stroke bg-surface-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="skeleton mb-2 h-3.5 w-20" />
              <div className="skeleton mb-1.5 h-5 w-32" />
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="skeleton h-[32px] w-[72px] rounded" />
          </div>
          <div className="mt-3 border-t border-stroke pt-2.5">
            <div className="skeleton h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RebalancingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-8 w-16 rounded-full" />)}
      </div>
      <div className="skeleton h-[44px] rounded-xl" />
      <div className="rounded-2xl border border-stroke bg-surface-card p-4">
        <div className="flex items-center gap-4">
          <div className="skeleton h-[120px] w-[120px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-3 w-full" />)}
          </div>
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-stroke bg-surface-card p-4">
          <div className="skeleton mb-2 h-4 w-28" />
          <div className="skeleton mb-2 h-3 w-36" />
          <div className="skeleton h-1 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}
