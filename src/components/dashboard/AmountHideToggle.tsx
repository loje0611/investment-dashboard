import { useStore } from '../../store/useStore'

export function AmountHideToggle({ className = '' }: { className?: string }) {
  const hideAmounts = useStore((s) => s.hideAmounts)
  const setHideAmounts = useStore((s) => s.setHideAmounts)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={hideAmounts}
      aria-label={hideAmounts ? '금액 표시하기' : '금액 숨기기'}
      onClick={() => setHideAmounts(!hideAmounts)}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        hideAmounts
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      } ${className}`}
    >
      {hideAmounts ? '금액 표시' : '금액 숨김'}
    </button>
  )
}
