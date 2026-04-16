import { useCallback, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useFocusTrap } from '../../utils/useFocusTrap'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  titleId?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, titleId, children }: BottomSheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open)
  const dragControls = useDragControls()

  const handleClose = useCallback(() => { onClose() }, [onClose])

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, handleClose])

  const id = titleId ?? 'bottom-sheet-title'

  return (
    <AnimatePresence>
      {open && (
        <div
          ref={trapRef}
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="닫기"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            className="relative z-10 flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[1.25rem] border border-stroke bg-surface-card shadow-glass-lg sm:rounded-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                handleClose()
              }
            }}
          >
            {/* Drag Handle */}
            <div
              className="flex shrink-0 cursor-grab items-center justify-center py-2 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1 w-10 rounded-full bg-content-tertiary/40" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-stroke px-5 pb-3">
              <h2 id={id} className="text-lg font-bold text-content-primary">{title}</h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
