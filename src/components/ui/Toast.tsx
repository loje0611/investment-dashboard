import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'

export interface ToastData {
  message: string
  tone: 'success' | 'error'
}

interface ToastProps {
  toast: ToastData | null
  onDismiss: () => void
  durationMs?: number
}

export function Toast({ toast, onDismiss, durationMs = 3200 }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss, durationMs])

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
          className="fixed bottom-[4.75rem] left-1/2 z-[60] max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 px-4"
          role="status"
        >
          <div
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-glass backdrop-blur-xl ${
              toast.tone === 'success'
                ? 'border border-profit/20 bg-profit-bg text-profit'
                : 'border border-loss/20 bg-loss-bg text-loss'
            }`}
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            {toast.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
