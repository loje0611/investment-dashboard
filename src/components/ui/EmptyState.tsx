import type { ReactNode } from 'react'
import { FileQuestion } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-stroke bg-surface-card px-4 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated">
        {icon ?? <FileQuestion className="h-6 w-6 text-content-tertiary" strokeWidth={1.5} />}
      </div>
      <p className="text-sm font-semibold text-content-primary">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-content-tertiary">
          {description}
        </p>
      )}
    </div>
  )
}
