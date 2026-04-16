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
        <div
          key={i}
          className="skeleton mb-2 h-3"
          style={{ width: `${80 - i * 15}%` }}
        />
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
