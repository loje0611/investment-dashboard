import { TrendingUp, TrendingDown } from 'lucide-react'
import type { SummaryCardItem } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'

interface SummaryCardsCarouselProps {
  items: SummaryCardItem[]
  hideAmounts: boolean
}

/** 히어로 카드: 총 자산 평가 — 그라데이션 배경 */
function HeroCard({ item, hideAmounts }: { item: SummaryCardItem; hideAmounts: boolean }) {
  const isProfit = (item.rate ?? 0) >= 0
  const rateColor = isProfit ? 'text-emerald-300' : 'text-rose-300'
  const symbol = isProfit ? '▲' : '▼'
  const Icon = isProfit ? TrendingUp : TrendingDown

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 p-5 text-white shadow-[0_8px_30px_rgba(79,70,229,0.35)]">
      {/* 장식: 반투명 원형 오버레이 */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/[0.07]" />

      <p className="mb-1 text-sm font-medium text-white/70">{item.title}</p>
      <p className="text-3xl font-extrabold tracking-tight tabular-nums">
        {item.amount != null ? `₩${formatWonDigits(hideAmounts, item.amount)}` : '-'}
      </p>
      {item.rate != null && (
        <div className={`mt-2 flex items-center gap-1.5 text-sm font-semibold tabular-nums ${rateColor}`}>
          <Icon className="h-4 w-4" strokeWidth={2.5} />
          <span>{symbol} {Math.abs(item.rate)}%</span>
          <span className="ml-1 text-xs font-normal text-white/50">투자원금 대비</span>
        </div>
      )}
    </div>
  )
}

/** 일반 카드 슬라이드 */
function SummaryCardSlide({
  item,
  hideAmounts,
}: {
  item: SummaryCardItem
  hideAmounts: boolean
}) {
  if (item.riskText != null) {
    return (
      <div className="h-full min-w-0 flex-shrink-0 rounded-xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <p className="mb-2 text-sm font-medium text-slate-500">{item.title}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-slate-700">
            <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
            위험: {item.riskText.danger}건
          </span>
          <span className="flex items-center gap-1.5 text-sm text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            상환: {item.riskText.success}건
          </span>
        </div>
      </div>
    )
  }

  const isProfit = (item.rate ?? 0) >= 0
  const rateColor = isProfit ? 'text-rose-500' : 'text-sky-500'
  const symbol = isProfit ? '▲' : '▼'

  return (
    <div className="h-full min-w-0 flex-shrink-0 rounded-xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <p className="mb-1 text-xs font-medium text-slate-400">{item.title}</p>
      <p className="text-base font-bold tabular-nums text-slate-900">
        {item.amount != null ? `₩${formatWonDigits(hideAmounts, item.amount)}` : '-'}
      </p>
      {item.rate != null && (
        <p className={`mt-1 text-xs font-semibold tabular-nums ${rateColor}`}>
          {symbol} {Math.abs(item.rate)}%
        </p>
      )}
    </div>
  )
}

/** 모바일용 요약 카드: 히어로 + 나머지 캐러셀 */
export function SummaryCardsCarousel({ items, hideAmounts }: SummaryCardsCarouselProps) {
  if (!items.length) return null

  const heroItem = items[0]
  const restItems = items.slice(1)

  return (
    <div className="space-y-3">
      {/* 히어로: 총 자산 평가 */}
      <HeroCard item={heroItem} hideAmounts={hideAmounts} />

      {/* 나머지 카드: 가로 스와이프 캐러셀 */}
      {restItems.length > 0 && (
        <div className="relative -mx-4 px-4">
          <div
            className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1 scrollbar-hide-mobile"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {restItems.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 snap-start"
                style={{ width: '44%', minWidth: '44%' }}
              >
                <SummaryCardSlide item={item} hideAmounts={hideAmounts} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
