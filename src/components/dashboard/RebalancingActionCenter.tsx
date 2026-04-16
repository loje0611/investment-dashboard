import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { RebalancingAccount } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'
import { PageHeader } from '../ui/PageHeader'
import { SkeletonCard } from '../ui/SkeletonCard'

interface RebalancingActionCenterProps {
  accounts: RebalancingAccount[]
  isLoading?: boolean
  compact?: boolean
  hideAmounts: boolean
}

function calcRebalancingShares(
  targetWeight: number, totalValuation: number, currentValue: number,
  currentPrice: number, additionalInvestment: number = 0
): number {
  if (currentPrice <= 0) return 0
  const newTotal = totalValuation + additionalInvestment
  const targetValue = (targetWeight / 100) * newTotal
  return Math.round((targetValue - currentValue) / currentPrice)
}

const DONUT_COLORS = [
  'var(--color-chart-1)', 'var(--color-chart-2)',
  'var(--color-chart-3)', 'var(--color-chart-4)',
  '#EC4899', '#14B8A6',
]

function WeightBar({ current, target }: { current: number; target: number }) {
  const c = Math.min(100, Math.max(0, current))
  const t = Math.min(100, Math.max(0, target))

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-primary">
      <div className="relative flex h-full w-full">
        <div className="bg-content-tertiary/50" style={{ width: `${c}%` }} />
        {/* Target marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-accent"
          style={{ left: `${t}%` }}
        />
      </div>
    </div>
  )
}

export function RebalancingActionCenter({ accounts, isLoading = false, compact = false, hideAmounts }: RebalancingActionCenterProps) {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? 'all')
  const [additionalInvestment, setAdditionalInvestment] = useState<string>('')

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? accounts[0],
    [accounts, selectedId]
  )
  const totalValuation = useMemo(
    () => (selected?.holdings ?? []).reduce((s, h) => s + h.currentValue, 0),
    [selected]
  )
  const additionalInvestmentNum = useMemo(() => {
    const n = parseFloat(additionalInvestment.replace(/,/g, '').trim())
    return Number.isNaN(n) || n < 0 ? 0 : n
  }, [additionalInvestment])

  const rows = useMemo(() => {
    if (!selected?.holdings?.length) return []
    return selected.holdings.map((h) => ({
      ...h,
      rebalancingShares: calcRebalancingShares(h.targetWeight, totalValuation, h.currentValue, h.currentPrice, additionalInvestmentNum),
    }))
  }, [selected?.holdings, totalValuation, additionalInvestmentNum])

  const donutData = useMemo(
    () => rows.map((r) => ({ name: r.name, value: r.currentWeight })),
    [rows]
  )

  const sectionClass = compact
    ? 'flex min-h-0 flex-1 flex-col pb-6'
    : 'mt-10 rounded-xl border border-stroke bg-surface-card p-6'

  if (isLoading) {
    return (
      <section className={sectionClass}>
        <PageHeader title="리밸런싱" />
        <div className="space-y-3 px-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      </section>
    )
  }

  if (!accounts.length) {
    return (
      <section className={sectionClass}>
        <PageHeader title="리밸런싱" />
        <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-content-tertiary">데이터가 없습니다.</div>
      </section>
    )
  }

  return (
    <section className={sectionClass}>
      <PageHeader title="리밸런싱" />

      <div className="flex-1 overflow-auto scrollbar-hide px-4">
        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-hide">
            {accounts.map((acc) => {
              const isActive = selectedId === acc.id
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedId(acc.id)}
                  className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    isActive ? 'text-content-primary' : 'text-content-tertiary hover:text-content-secondary'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="rebal-account-pill"
                      className="absolute inset-0 rounded-full border border-stroke bg-surface-card"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10">{acc.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Additional Investment */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-stroke bg-surface-card px-3 py-2.5">
          <span className="shrink-0 text-xs font-medium text-content-tertiary">추가 투자금</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={additionalInvestment}
            onChange={(e) => setAdditionalInvestment(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-content-primary outline-none placeholder:text-content-tertiary"
          />
          <span className="shrink-0 text-xs text-content-tertiary">원</span>
        </div>

        {/* Donut + Summary */}
        <div className="mb-4 rounded-2xl border border-stroke bg-surface-card p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-[120px] w-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData} cx="50%" cy="50%"
                    innerRadius={34} outerRadius={52}
                    paddingAngle={2} dataKey="value" stroke="none"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] text-content-tertiary">총 평가</p>
                <p className="text-xs font-bold tabular-nums text-content-primary">
                  ₩{formatWonDigits(hideAmounts, totalValuation)}
                </p>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {rows.slice(0, 4).map((r, i) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate text-xs text-content-secondary">{r.name}</span>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-content-primary">{r.currentWeight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Holding Cards */}
        <div className="space-y-3 pb-2">
          {rows.map((row, i) => {
            const delta = row.targetWeight - row.currentWeight
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-2xl border border-stroke bg-surface-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-content-primary">{row.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-content-tertiary">
                      <span className="tabular-nums">{row.quantity}주</span>
                      <span>·</span>
                      <span className="tabular-nums">₩{formatWonDigits(hideAmounts, row.currentPrice)}</span>
                    </div>
                  </div>
                  {row.rebalancingShares > 0 ? (
                    <span className="shrink-0 rounded-lg bg-profit-bg px-2.5 py-1 text-xs font-semibold text-profit">
                      +{row.rebalancingShares}주 매수
                    </span>
                  ) : row.rebalancingShares < 0 ? (
                    <span className="shrink-0 rounded-lg bg-loss-bg px-2.5 py-1 text-xs font-semibold text-loss">
                      {row.rebalancingShares}주 매도
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-content-tertiary">
                      유지
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-content-tertiary">현재 {row.currentWeight.toFixed(1)}%</span>
                    <span className="text-content-tertiary">목표 {row.targetWeight.toFixed(1)}%</span>
                    <span className={`font-semibold tabular-nums ${delta >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%p
                    </span>
                  </div>
                  <WeightBar current={row.currentWeight} target={row.targetWeight} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-content-tertiary">평가금액</span>
                  <span className="font-medium tabular-nums text-content-secondary">₩{formatWonDigits(hideAmounts, row.currentValue)}</span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {additionalInvestmentNum > 0 && (
          <p className="mt-2 text-center text-[11px] text-content-tertiary">
            추가 투자금 반영: ₩{formatWonDigits(hideAmounts, totalValuation + additionalInvestmentNum)} 기준
          </p>
        )}
      </div>
    </section>
  )
}
