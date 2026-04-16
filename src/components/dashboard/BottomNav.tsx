import { Home, PieChart, Scale } from 'lucide-react'
import { motion } from 'framer-motion'

export type MainTabId = 'home' | 'assets' | 'rebalancing'

type TabDef = { id: MainTabId; label: string; Icon: typeof Home }

const NAV_ITEMS: TabDef[] = [
  { id: 'home', label: '홈', Icon: Home },
  { id: 'assets', label: '자산', Icon: PieChart },
  { id: 'rebalancing', label: '리밸런싱', Icon: Scale },
]

interface BottomNavProps {
  current: MainTabId
  onSelect: (tab: MainTabId) => void
}

export function BottomNav({ current, onSelect }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-stroke bg-surface-card/80 shadow-[0_-8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl safe-area-pb"
      role="navigation"
      aria-label="메인 메뉴"
    >
      <div className="flex h-14 items-center justify-around gap-0 px-1" role="tablist">
        {NAV_ITEMS.map((item) => {
          const isActive = current === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              onClick={() => onSelect(item.id)}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-y-1 inset-x-3 rounded-full bg-accent-muted sm:inset-x-4"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}

              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.5 }}
                className={`relative z-10 flex flex-col items-center gap-0.5 transition-colors duration-200 ${
                  isActive ? 'text-accent' : 'text-content-tertiary active:text-content-secondary'
                }`}
              >
                <item.Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold leading-tight tracking-tight">
                  {item.label}
                </span>
              </motion.div>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
