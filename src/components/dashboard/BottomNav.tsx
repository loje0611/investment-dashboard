import { Home, PieChart, Scale, ClipboardPlus, Calculator, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

export type MainTabId = 'home' | 'assets' | 'rebalancing' | 'elsRegister'

type TabDef = { kind: 'tab'; id: MainTabId; label: string; Icon: typeof Home }
type SyncDef = { kind: 'sync' }

const NAV_ITEMS: (TabDef | SyncDef)[] = [
  { kind: 'tab', id: 'home', label: '홈', Icon: Home },
  { kind: 'tab', id: 'assets', label: '자산 상세', Icon: PieChart },
  { kind: 'tab', id: 'rebalancing', label: '리밸런싱', Icon: Scale },
  { kind: 'tab', id: 'elsRegister', label: 'ELS 관리', Icon: ClipboardPlus },
  { kind: 'sync' },
]

interface BottomNavProps {
  current: MainTabId
  onSelect: (tab: MainTabId) => void
  isSyncing?: boolean
  onSyncAll?: () => void
}

export function BottomNav({ current, onSelect, isSyncing = false, onSyncAll }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-slate-200/50 bg-white/80 shadow-[0_-8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl safe-area-pb"
      role="navigation"
      aria-label="메인 메뉴"
    >
      <div className="flex h-14 items-center justify-around gap-0 px-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.kind === 'sync') {
            return (
              <button
                key="settlement-sync"
                type="button"
                aria-label="자산 정산 기록"
                disabled={isSyncing || !onSyncAll}
                onClick={() => onSyncAll?.()}
                className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-slate-400 transition-colors hover:text-indigo-600 active:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  {isSyncing ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-600" strokeWidth={2} aria-hidden />
                  ) : (
                    <Calculator className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  )}
                  <span className="text-[9px] font-semibold leading-tight tracking-tight text-slate-500 sm:text-[10px]">
                    정산
                  </span>
                </span>
              </button>
            )
          }

          const isActive = current === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              onClick={() => onSelect(item.id)}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-y-1 inset-x-2 rounded-full bg-indigo-50/80 sm:inset-x-3"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}

              <motion.div
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.5 }}
                className={`relative z-10 flex flex-col items-center gap-0.5 transition-colors duration-200 ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 active:text-slate-600'
                }`}
              >
                <item.Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-semibold leading-tight tracking-tight sm:text-[10px]">
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
