import { TrendingUp, TrendingDown } from 'lucide-react'
import type { SummaryCardItem } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'

interface SummaryCardsCarouselProps {
  items: SummaryCardItem[]
  hideAmounts: boolean
}

function HeroCard({ item, hideAmounts }: { item: SummaryCardItem; hideAmounts: boolean }) {
  const isProfit = (item.rate ?? 0) >= 0
  const Icon = isProfit ? TrendingUp : TrendingDown

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2440] via-[#162038] to-[#0f1a30] p-5 shadow-glass">
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-accent/[0.08]" />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-accent/[0.05]" />

      <p className="mb-1 text-sm font-medium text-content-secondary">{item.title}</p>
      <p className="text-3xl font-bold tracking-tight tabular-nums text-content-primary">
        {item.amount != null ? `₩${formatWonDigits(hideAmounts, item.amount)}` : '-'}
      </p>
      {item.rate != null && (
        <div className={`mt-2 flex items-center gap-1.5 text-sm font-semibold tabular-nums ${isProfit ? 'text-profit' : 'text-loss'}`}>
          <Icon className="h-4 w-4" strokeWidth={2.5} />
          <span>{isProfit ? '▲' : '▼'} {Math.abs(item.rate).toFixed(2)}%</span>
          <span className="ml-1 text-xs font-normal text-content-tertiary">투자원금 대비</span>
        </div>
      )}
    </div>
  )
}

function SummaryCardSlide({ item, hideAmounts }: { item: SummaryCardItem; hideAmounts: boolean }) {
  const isProfit = (item.rate ?? 0) >= 0

  return (
    <div className="h-full min-w-0 flex-shrink-0 rounded-xl border border-stroke bg-surface-card p-4">
      <p className="mb-1 text-xs font-medium text-content-tertiary">{item.title}</p>
      <p className="text-base font-bold tabular-nums text-content-primary">
        {item.amount != null ? `₩${formatWonDigits(hideAmounts, item.amount)}` : '-'}
      </p>
      {item.rate != null && (
        <p className={`mt-1 text-xs font-semibold tabular-nums ${isProfit ? 'text-profit' : 'text-loss'}`}>
          {isProfit ? '▲' : '▼'} {Math.abs(item.rate).toFixed(2)}%
        </p>
      )}
    </div>
  )
}

export function SummaryCardsCarousel({ items, hideAmounts }: SummaryCardsCarouselProps) {
  if (!items.length) return null

  const heroItem = items[0]
  const restItems = items.slice(1)

  return (
    <div className="space-y-3">
      <HeroCard item={heroItem} hideAmounts={hideAmounts} />

      {restItems.length > 0 && (
        <div className="relative -mx-4 px-4">
          <div
            className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1 scrollbar-hide-mobile"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {restItems.map((item) => (
              <div key={item.id} className="flex-shrink-0 snap-start" style={{ width: '44%', minWidth: '44%' }}>
                <SummaryCardSlide item={item} hideAmounts={hideAmounts} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
