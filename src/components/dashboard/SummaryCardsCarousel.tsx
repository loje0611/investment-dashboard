import { TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2440] via-[#162038] to-[#0f1a30] p-5 shadow-glass"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/[0.08]" />
      <div className="pointer-events-none absolute -bottom-5 -left-5 h-24 w-24 rounded-full bg-accent/[0.05]" />

      <p className="mb-1 text-sm font-medium text-content-secondary">{item.title}</p>
      <p className="text-[28px] font-bold tracking-tight tabular-nums text-content-primary leading-tight">
        {item.amount != null ? `₩${formatWonDigits(hideAmounts, item.amount)}` : '-'}
      </p>
      {item.rate != null && (
        <div className={`mt-2.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums ${isProfit ? 'text-profit' : 'text-loss'}`}>
          <Icon className="h-4 w-4" strokeWidth={2.5} />
          <span>{isProfit ? '+' : ''}{item.rate.toFixed(2)}%</span>
          <span className="ml-1 text-xs font-normal text-content-tertiary">투자원금 대비</span>
        </div>
      )}
    </motion.div>
  )
}

function BentoCard({ item, hideAmounts, index }: { item: SummaryCardItem; hideAmounts: boolean; index: number }) {
  const isProfit = (item.rate ?? 0) >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 * (index + 1) }}
      className="flex flex-col justify-between rounded-2xl border border-stroke bg-surface-card p-4"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-content-tertiary">{item.title}</p>
      <div className="mt-2">
        <p className="text-lg font-bold tabular-nums leading-snug text-content-primary">
          {item.amount != null ? `₩${formatWonDigits(hideAmounts, item.amount)}` : '-'}
        </p>
        {item.rate != null && (
          <p className={`mt-1 text-xs font-semibold tabular-nums ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{item.rate.toFixed(2)}%
          </p>
        )}
      </div>
    </motion.div>
  )
}

export function SummaryCardsCarousel({ items, hideAmounts }: SummaryCardsCarouselProps) {
  if (!items.length) return null

  const heroItem = items[0]
  const gridItems = items.slice(1)

  return (
    <div className="grid grid-cols-2 gap-3">
      <HeroCard item={heroItem} hideAmounts={hideAmounts} />
      {gridItems.map((item, i) => (
        <BentoCard key={item.id} item={item} hideAmounts={hideAmounts} index={i} />
      ))}
    </div>
  )
}
