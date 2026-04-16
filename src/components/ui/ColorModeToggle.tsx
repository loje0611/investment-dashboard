import { useStore } from '../../store/useStore'

export function ColorModeToggle() {
  const colorMode = useStore((s) => s.colorMode)
  const setColorMode = useStore((s) => s.setColorMode)

  return (
    <button
      type="button"
      onClick={() => setColorMode(colorMode === 'global' ? 'korean' : 'global')}
      className="flex shrink-0 items-center gap-1 rounded-full border border-stroke-strong bg-surface-elevated px-2.5 py-1.5 text-[10px] font-semibold transition-colors hover:bg-surface-hover"
      aria-label={colorMode === 'global' ? '한국식 색상으로 전환' : '글로벌 색상으로 전환'}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${colorMode === 'korean' ? 'bg-[#EF4444]' : 'bg-profit'}`} />
      <span className="text-content-secondary">
        {colorMode === 'korean' ? '🇰🇷' : '🌍'}
      </span>
    </button>
  )
}
