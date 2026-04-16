import type { ReactNode } from 'react'
import { AmountHideToggle } from '../dashboard/AmountHideToggle'
import { LogoutButton } from '../LogoutButton'
import { ColorModeToggle } from './ColorModeToggle'

interface PageHeaderProps {
  title: string
  trailing?: ReactNode
}

export function PageHeader({ title, trailing }: PageHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
      <h1 className="text-lg font-semibold text-content-primary">{title}</h1>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {trailing}
        <ColorModeToggle />
        <AmountHideToggle />
        <LogoutButton />
      </div>
    </div>
  )
}
