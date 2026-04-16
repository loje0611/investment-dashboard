import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart as PieChartIcon } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area,
} from 'recharts'
import type { PieSegment } from '../../data/dashboardDummy'
import type {
  PrincipalValuationPoint,
  PrincipalValuationTrend,
} from '../../utils/totalAssetsToPrincipalValuation'
import { formatAxisAmountShort, formatWonWithWonSymbol } from '../../utils/maskSensitiveAmount'
import { EmptyState } from '../ui/EmptyState'

interface GlobalOverviewProps {
  pieData: PieSegment[]
  principalValuationTrend: PrincipalValuationTrend | null
  totalAssetsRowCount?: number
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
            className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive ? 'text-content-primary' : 'text-content-tertiary hover:text-content-secondary'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="period-pill"
                className="absolute inset-0 rounded-full bg-accent-muted"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
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
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl bg-surface-elevated px-3 py-2.5">
      <span className="text-[11px] font-medium text-content-tertiary">전월 대비 · {title}</span>
      <span className={`text-sm font-bold tabular-nums ${up ? 'text-profit' : 'text-loss'}`}>
        {up ? '+' : '−'} {formatWonWithWonSymbol(hideAmounts, Math.abs(delta))}
      </span>
    </div>
  )
}

export function GlobalOverview({ pieData, principalValuationTrend, totalAssetsRowCount = 0, hideAmounts }: GlobalOverviewProps) {
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
    <div className="flex flex-col gap-4">
      {/* 자산 배분 — Donut */}
      <div className="rounded-2xl border border-stroke bg-surface-card p-4 shadow-glass-sm">
        <h3 className="mb-4 text-sm font-semibold text-content-primary">자산 배분</h3>
        {showPie ? (
          <div className="relative flex min-h-[220px] flex-col items-center justify-center">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 36, bottom: 20, left: 36 }}>
                  <Pie
                    data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={72}
                    paddingAngle={2} startAngle={90} endAngle={-270}
                    dataKey="value" nameKey="name" stroke="none"
                    labelLine={{ stroke: 'var(--color-text-tertiary)', strokeWidth: 1 }}
                    label={({ cx, cy, midAngle, outerRadius, name, value }) => {
                      const RADIAN = Math.PI / 180
                      const r = outerRadius + 22
                      const x = cx + r * Math.cos(-midAngle * RADIAN)
                      const y = cy + r * Math.sin(-midAngle * RADIAN)
                      return (
                        <text x={x} y={y} fill="var(--color-text-primary)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={13} fontWeight={600}>
                          {`${name} ${formatPiePercent(Number(value))}%`}
                        </text>
                      )
                    }}
                  >
                    {pieData.map((entry, i) => (<Cell key={`cell-${i}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${formatPiePercent(value)}%`, '비중']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 18, 25, 0.95)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '0.75rem',
                      color: '#FFFFFF',
                      backdropFilter: 'blur(12px)',
                    }}
                    itemStyle={{ color: '#E2E8F0' }}
                    labelStyle={{ color: '#CBD5E1', fontWeight: 600, marginBottom: 4 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<PieChartIcon className="h-6 w-6 text-content-tertiary" strokeWidth={1.5} />}
            title="차트 데이터가 없습니다"
            description="총자산 시트 최신 행에 연금·ELS·ETF·현금 평가금 값이 필요합니다."
          />
        )}
      </div>

      {/* 자산 변동 추이 — Area + Period Pill */}
      <div className="rounded-2xl border border-stroke bg-surface-card p-4 shadow-glass-sm">
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-content-primary">자산 변동 추이</h3>
            {showTrend && <PeriodPills selected={period} onSelect={setPeriod} />}
          </div>
          {showTrend && principalValuationTrend != null && (
            <p className="text-xs text-content-tertiary">
              최근 기준{' '}
              <span className="font-medium text-content-secondary">{principalValuationTrend.latestLabel}</span>
              {' · '}원금 총액과 평가금 총액
            </p>
          )}
        </div>
        {showTrend && principalValuationTrend != null ? (
          <>
            {(principalValuationTrend.momPrincipal != null || principalValuationTrend.momValuation != null) && (
              <div className="mb-4 flex gap-2">
                <MomDeltaPill title="원금 총액" delta={principalValuationTrend.momPrincipal} hideAmounts={hideAmounts} />
                <MomDeltaPill title="평가금 총액" delta={principalValuationTrend.momValuation} hideAmounts={hideAmounts} />
              </div>
            )}
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendStackData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFillPrincipal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="trendFillValuation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} tickFormatter={(v) => formatAxisAmountShort(hideAmounts, v, formatYAxis(v))} width={44} axisLine={false} tickLine={false} />
                  <Tooltip content={(props) => <TrendTooltip {...props} hideAmounts={hideAmounts} />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-secondary)' }} />
                  <Area type="monotone" dataKey="원금총액" name="원금 총액" stackId="1" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#trendFillPrincipal)" fillOpacity={1} dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="평가증분" name="평가금 총액" stackId="1" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#trendFillValuation)" fillOpacity={1} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-xs leading-relaxed text-content-tertiary">
            <p>평가일·원금 총액·평가금 총액 열이 있는 총자산 이력이 있으면 추이 그래프가 표시됩니다.</p>
            <p className="rounded-lg bg-yellow-500/10 px-3 py-2 text-yellow-200">
              {totalAssetsRowCount === 0
                ? <>총자산 데이터가 0행입니다. 시트 탭 이름 <strong>총자산</strong>과 웹앱 응답을 확인해 주세요.</>
                : <>총자산 <strong>{totalAssetsRowCount}행</strong>을 받았지만 날짜·원금·평가금을 읽지 못했습니다.</>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
