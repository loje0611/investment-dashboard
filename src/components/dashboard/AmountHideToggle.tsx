import { useStore } from '../../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'

export function AmountHideToggle({ className = '' }: { className?: string }) {
  const hideAmounts = useStore((s) => s.hideAmounts)
  const setHideAmounts = useStore((s) => s.setHideAmounts)

  return (
    <motion.button
      type="button"
      role="switch"
      layout
      aria-checked={hideAmounts}
      aria-label={hideAmounts ? '금액 표시하기' : '금액 숨기기'}
      onClick={() => setHideAmounts(!hideAmounts)}
      className={`relative flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
        hideAmounts
          ? 'border-accent/30 bg-accent-muted text-accent hover:bg-accent/20'
          : 'border-stroke-strong bg-surface-elevated text-content-secondary hover:bg-surface-hover'
      } ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={hideAmounts ? 'hidden' : 'visible'}
          initial={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
          transition={{ duration: 0.25, type: 'spring', bounce: 0.3 }}
          className="flex items-center gap-1.5"
        >
          {hideAmounts ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              <span>금액 표시</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              <span>금액 숨김</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  )
}
