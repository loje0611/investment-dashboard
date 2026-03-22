import { Home, PieChart, Scale } from 'lucide-react'
import { motion } from 'framer-motion'

export type MainTabId = 'home' | 'assets' | 'rebalancing'

const TABS: { id: MainTabId; label: string; Icon: typeof Home }[] = [
  { id: 'home', label: '홈', Icon: Home },
  { id: 'assets', label: '자산 상세', Icon: PieChart },
  { id: 'rebalancing', label: '리밸런싱', Icon: Scale },
]

interface BottomNavProps {
  current: MainTabId
  onSelect: (tab: MainTabId) => void
}

export function BottomNav({ current, onSelect }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-slate-200/50 bg-white/80 shadow-[0_-8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl safe-area-pb"
      role="tablist"
      aria-label="메인 메뉴"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {TABS.map((tab) => {
          const isActive = current === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => onSelect(tab.id)}
              className="relative flex h-full flex-1 flex-col items-center justify-center gap-0.5"
            >
              {/* 활성 인디케이터 배경 (framer-motion) */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-y-1 inset-x-4 rounded-full bg-indigo-50/80"
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
                <tab.Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
              </motion.div>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
