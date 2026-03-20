import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import type { PieSegment } from '../../data/dashboardDummy'
import type {
  PrincipalValuationPoint,
  PrincipalValuationTrend,
} from '../../utils/totalAssetsToPrincipalValuation'
import {
  formatAxisAmountShort,
  formatWonWithWonSymbol,
} from '../../utils/maskSensitiveAmount'

interface GlobalOverviewProps {
  pieData: PieSegment[]
  /** 총자산 시트 기반 원금·평가 추이 */
  principalValuationTrend: PrincipalValuationTrend | null
  /** API에서 받은 총자산 시트 행 수 (안내 문구용) */
  totalAssetsRowCount?: number
  /** 요약 카드와 동일: 금액 마스크 */
  hideAmounts: boolean
}

function formatYAxis(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`
  return String(value)
}

/** 자산 배분 % — 소수 첫째 자리까지 반올림, 부동소수점 표시 깨짐 방지 */
function formatPiePercent(value: number): string {
  const n = Math.round(Number(value) * 10 + Number.EPSILON) / 10
  return n.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

/** 스택 Area용: 시계열 행 + 평가금−원금(상단 띠). 툴팁은 원본 원금·평가금 표시 */
type TrendStackPoint = PrincipalValuationPoint & { 평가증분: number }

function PrincipalValuationAreaTooltip({
  active,
  payload,
  label,
  hideAmounts,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  hideAmounts: boolean
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as TrendStackPoint | undefined
  if (!row) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md">
      <p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#6366f1]" />
            <span className="text-sm font-medium text-slate-700">원금 총액</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-slate-900">
            {formatWonWithWonSymbol(hideAmounts, row.원금총액)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0d9488]" />
            <span className="text-sm font-medium text-slate-700">평가금 총액</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-slate-900">
            {formatWonWithWonSymbol(hideAmounts, row.평가금총액)}
          </span>
        </div>
      </div>
    </div>
  )
}

function MomDeltaPill({
  title,
  delta,
  hideAmounts,
}: {
  title: string
  delta: number | null
  hideAmounts: boolean
}) {
  if (delta == null) return null
  const up = delta >= 0
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl bg-slate-50/90 px-3 py-2.5">
      <span className="text-[11px] font-medium text-slate-500">전월 대비 · {title}</span>
      <span
        className={`text-sm font-bold tabular-nums ${up ? 'text-emerald-600' : 'text-rose-600'}`}
      >
        {up ? '+' : '−'} {formatWonWithWonSymbol(hideAmounts, Math.abs(delta))}
      </span>
    </div>
  )
}

export function GlobalOverview({
  pieData,
  principalValuationTrend,
  totalAssetsRowCount = 0,
  hideAmounts,
}: GlobalOverviewProps) {
  const showPrincipalValuation =
    principalValuationTrend != null && principalValuationTrend.points.length > 0
  const showPie = pieData.length > 0

  const trendStackData: TrendStackPoint[] = useMemo(() => {
    if (!principalValuationTrend?.points.length) return []
    return principalValuationTrend.points.map((p) => ({
      ...p,
      평가증분: p.평가금총액 - p.원금총액,
    }))
  }, [principalValuationTrend])

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">자산 배분</h3>

        {showPie ? (
          <div className="relative flex min-h-[220px] flex-col items-center justify-center">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 36, bottom: 20, left: 36 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={72}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    label={({ cx, cy, midAngle, outerRadius, name, value }) => {
                      const RADIAN = Math.PI / 180
                      const radius = outerRadius + 22
                      const x = cx + radius * Math.cos(-midAngle * RADIAN)
                      const y = cy + radius * Math.sin(-midAngle * RADIAN)
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="#334155"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          fontSize={13}
                          fontWeight={600}
                        >
                          {`${name} ${formatPiePercent(Number(value))}%`}
                        </text>
                      )
                    }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${formatPiePercent(value)}%`, '비중']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="flex min-h-[120px] items-center justify-center rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            총자산 시트의 최신 행에서 연금·ELS·ETF·현금 평가액을 찾지 못했습니다. 열 이름을
            확인해 주세요.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <div className="mb-3 flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-slate-700">자산 변동 추이</h3>
          {showPrincipalValuation && principalValuationTrend != null && (
            <p className="text-xs text-slate-500">
              최근 기준{' '}
              <span className="font-medium text-slate-600">{principalValuationTrend.latestLabel}</span>
              {' · '}
              원금 총액과 평가금 총액
            </p>
          )}
        </div>
        {showPrincipalValuation && principalValuationTrend != null ? (
          <>
            {(principalValuationTrend.momPrincipal != null ||
              principalValuationTrend.momValuation != null) && (
              <div className="mb-4 flex gap-2">
                <MomDeltaPill
                  title="원금 총액"
                  delta={principalValuationTrend.momPrincipal}
                  hideAmounts={hideAmounts}
                />
                <MomDeltaPill
                  title="평가금 총액"
                  delta={principalValuationTrend.momValuation}
                  hideAmounts={hideAmounts}
                />
              </div>
            )}
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendStackData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFillPrincipal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="trendFillValuation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => formatAxisAmountShort(hideAmounts, v, formatYAxis(v))}
                    width={44}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={(props) => (
                      <PrincipalValuationAreaTooltip {...props} hideAmounts={hideAmounts} />
                    )}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="원금총액"
                    name="원금 총액"
                    stackId="1"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#trendFillPrincipal)"
                    fillOpacity={1}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="평가증분"
                    name="평가금 총액"
                    stackId="1"
                    stroke="#0d9488"
                    strokeWidth={2}
                    fill="url(#trendFillValuation)"
                    fillOpacity={1}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-xs leading-relaxed text-slate-500">
            <p>
              평가일·원금 총액·평가금 총액이 있는 총자산 이력이 있으면 추이 그래프가 표시됩니다.
            </p>
            {totalAssetsRowCount === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                총자산 데이터가 0행입니다. 시트 탭 이름 <strong>총자산</strong>과 웹앱 응답을
                확인해 주세요.
              </p>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                총자산 <strong>{totalAssetsRowCount}행</strong>을 받았지만 날짜·원금·평가금을 읽지
                못했습니다. 헤더(평가일, 원금 총액, 평가금 총액)를 확인해 주세요.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
