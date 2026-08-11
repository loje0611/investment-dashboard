import { useMemo, useState } from 'react'
import { PieChart as PieChartIcon, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area,
} from 'recharts'
import { motion } from 'framer-motion'
import type { PieSegment, SummaryCardItem } from '../../types/dashboard'
import type {
  PrincipalValuationPoint,
  PrincipalValuationTrend,
} from '../../utils/totalAssetsToPrincipalValuation'
import { formatAxisAmountShort, formatWonWithWonSymbol, formatWonDigits } from '../../utils/maskSensitiveAmount'
import { EmptyState } from '../ui/EmptyState'

interface GlobalOverviewProps {
  cards?: SummaryCardItem[]
  pieData: PieSegment[]
  principalValuationTrend: PrincipalValuationTrend | null
  insightText?: string | null
  totalAssetsRowCount?: number
  isLoading?: boolean
  hideAmounts: boolean
}

function formatYAxis(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`
  return String(value)
}

function formatPiePercent(value: number): string {
  const n = Math.round(Number(value) * 10 + Number.EPSILON) / 10
  return n.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

type TrendStackPoint = PrincipalValuationPoint & { 평가증분: number }

const PERIOD_OPTIONS = [
  { id: '3m', label: '3개월', months: 3 },
  { id: '6m', label: '6개월', months: 6 },
  { id: '1y', label: '1년', months: 12 },
  { id: 'all', label: '전체', months: Infinity },
] as const

type PeriodId = typeof PERIOD_OPTIONS[number]['id']

function PeriodPills({ selected, onSelect }: { selected: PeriodId; onSelect: (id: PeriodId) => void }) {
  return (
    <div className="flex gap-1.5">
      {PERIOD_OPTIONS.map((opt) => {
        const isActive = selected === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={`relative rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
              isActive ? 'bg-accent text-white shadow-sm' : 'bg-surface-secondary text-content-tertiary hover:text-content-primary'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function TrendTooltip({ active, payload, label, hideAmounts }: {
  active?: boolean; payload?: any[]; label?: string; hideAmounts: boolean
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as TrendStackPoint | undefined
  if (!row) return null
  return (
    <div className="rounded-xl border border-stroke-strong bg-surface-elevated/95 p-3 shadow-glass backdrop-blur-xl">
      <p className="mb-2 text-xs font-semibold text-content-secondary">{label}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-chart-1)' }} />
            <span className="text-sm font-medium text-content-secondary">원금 총액</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-content-primary">
            {formatWonWithWonSymbol(hideAmounts, row.원금총액)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-chart-2)' }} />
            <span className="text-sm font-medium text-content-secondary">평가금 총액</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-content-primary">
            {formatWonWithWonSymbol(hideAmounts, row.평가금총액)}
          </span>
        </div>
      </div>
    </div>
  )
}

function MomDeltaPill({ title, delta, hideAmounts }: { title: string; delta: number | null; hideAmounts: boolean }) {
  if (delta == null) return null
  const up = delta >= 0
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-stroke bg-surface-secondary/40 px-3.5 py-2.5">
      <span className="text-[11px] font-medium text-content-tertiary">전월 대비 · {title}</span>
      <span className={`text-sm font-extrabold tabular-nums flex items-center gap-1 ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        {formatWonWithWonSymbol(hideAmounts, Math.abs(delta))}
      </span>
    </div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

export function GlobalOverview({
  cards = [],
  pieData,
  principalValuationTrend,
  insightText,
  hideAmounts,
}: GlobalOverviewProps) {
  const [period, setPeriod] = useState<PeriodId>('all')
  const showTrend = principalValuationTrend != null && principalValuationTrend.points.length > 0
  const showPie = pieData.length > 0

  const allStackData: TrendStackPoint[] = useMemo(() => {
    if (!principalValuationTrend?.points.length) return []
    return principalValuationTrend.points.map((p) => ({ ...p, 평가증분: p.평가금총액 - p.원금총액 }))
  }, [principalValuationTrend])

  const trendStackData = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((o) => o.id === period)
    if (!opt || opt.months === Infinity) return allStackData
    return allStackData.slice(-opt.months)
  }, [allStackData, period])

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Top Summary Cards (Desktop 4-Column Grid) */}
      {cards.length > 0 && (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.slice(0, 4).map((card, idx) => {
            const hasRate = card.rate !== undefined
            const isProfit = (card.rate ?? 0) >= 0
            return (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                key={card.id || idx}
                className="flex flex-col justify-between rounded-2xl border border-stroke/50 bg-gradient-to-br from-white/[0.08] to-transparent backdrop-blur-md p-5 shadow-glass-sm transition-all hover:border-accent/40 hover:shadow-lg"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-content-tertiary">
                  <span>{card.title}</span>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <p className="text-xl font-black text-content-primary">
                    {formatWonDigits(hideAmounts, card.amount ?? 0)}
                  </p>
                  {hasRate && (
                    <span
                      className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-xl font-black ${
                        isProfit
                          ? 'bg-emerald-500/20 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                          : 'bg-rose-500/20 text-rose-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'
                      }`}
                    >
                      {isProfit ? '+' : ''}{Math.round(card.rate!)}%
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* 2. Main Analytics Section (2-Column Desktop Grid) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Asset Growth Chart (Span 8) */}
        <div className="flex flex-col justify-between rounded-2xl border border-stroke bg-surface-card p-5 shadow-glass-sm lg:col-span-8">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-content-primary">자산 변동 추이</h3>
                {showTrend && principalValuationTrend != null && (
                  <p className="text-xs text-content-tertiary">
                    최근 기준 <span className="font-semibold text-content-secondary">{principalValuationTrend.latestLabel}</span> · 원금 vs 평가금 시계열 분석
                  </p>
                )}
              </div>
              {showTrend && <PeriodPills selected={period} onSelect={setPeriod} />}
            </div>

            {showTrend && principalValuationTrend != null && (
              <div className="flex gap-3">
                <MomDeltaPill title="원금 총액" delta={principalValuationTrend.momPrincipal} hideAmounts={hideAmounts} />
                <MomDeltaPill title="평가금 총액" delta={principalValuationTrend.momValuation} hideAmounts={hideAmounts} />
              </div>
            )}
          </div>

          {showTrend && principalValuationTrend != null ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendStackData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFillPrincipal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="trendFillValuation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }} tickFormatter={(v) => formatAxisAmountShort(hideAmounts, v, formatYAxis(v))} width={50} axisLine={false} tickLine={false} />
                  <Tooltip content={(props) => <TrendTooltip {...props} hideAmounts={hideAmounts} />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--color-text-secondary)' }} />
                  <Area type="monotone" dataKey="원금총액" name="원금 총액" stackId="1" stroke="var(--color-chart-1)" strokeWidth={3} fill="url(#trendFillPrincipal)" fillOpacity={1} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: '#fff' }} />
                  <Area type="monotone" dataKey="평가증분" name="평가금 총액" stackId="1" stroke="var(--color-chart-2)" strokeWidth={3} fill="url(#trendFillValuation)" fillOpacity={1} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="space-y-2 text-xs leading-relaxed text-content-tertiary py-10 text-center">
              <p>평가일·원금 총액·평가금 총액 데이터가 쌓이면 자산 추이 그래프가 노출됩니다.</p>
            </div>
          )}
        </div>

        {/* Right Column: Asset Allocation Pie Chart (Span 4) */}
        <div className="flex flex-col rounded-2xl border border-stroke bg-surface-card p-5 shadow-glass-sm lg:col-span-4 transition-transform duration-300 hover:shadow-lg">
          <h3 className="mb-2 text-base font-bold text-content-primary">자산 비중 배분</h3>
          <p className="mb-4 text-xs text-content-tertiary">포트폴리오 자산군 구성비</p>

          {showPie ? (
            <div className="flex flex-col items-center justify-between flex-1">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                      paddingAngle={5} cornerRadius={6} startAngle={90} endAngle={-270}
                      dataKey="value" nameKey="name" stroke="none"
                      animationBegin={200} animationDuration={800}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} className="transition-all duration-300 hover:opacity-80" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${formatPiePercent(value)}%`, '비중']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Legend List */}
              <div className="w-full space-y-2 pt-2 border-t border-stroke">
                {pieData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-content-secondary">{item.name}</span>
                    </div>
                    <span className="text-content-primary">{formatPiePercent(item.value)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<PieChartIcon className="h-6 w-6 text-content-tertiary" strokeWidth={1.5} />}
              title="차트 데이터가 없습니다"
              description="총자산 데이터 조회가 필요합니다."
            />
          )}
        </div>
      </div>

      {insightText && (
        <div className="relative overflow-hidden rounded-2xl border border-accent/30 p-[1px] shadow-glass-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/30 via-fuchsia-500/30 to-accent/30 bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]" />
          <div className="relative rounded-2xl bg-surface-card/95 backdrop-blur-xl p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-accent to-fuchsia-400">
              <Sparkles className="h-5 w-5 text-accent" /> AI 자산 진단 브리핑
            </div>
            <p className="text-sm font-semibold text-content-primary leading-relaxed">{insightText}</p>
          </div>
        </div>
      )}
    </div>
  )
}
