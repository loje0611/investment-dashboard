import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { PieSegment, TrendPoint } from '../../data/dashboardDummy'

interface GlobalOverviewProps {
  pieData: PieSegment[]
  trendData: TrendPoint[]
}

function formatYAxis(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`
  return String(value)
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md">
        <p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm font-medium text-slate-700">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums text-slate-900">
                {formatYAxis(entry.value)}원
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export function GlobalOverview({ pieData, trendData }: GlobalOverviewProps) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* 자산 배분 도넛 (위) */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">자산 배분</h3>
        
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
                    const RADIAN = Math.PI / 180;
                    // 반지름보다 훨씬 바깥(양옆)으로 밀어냄
                    const radius = outerRadius + 22;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
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
                        {`${name} ${value}%`}
                      </text>
                    );
                  }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}%`, '비중']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 자산 변동 추이 라인 (아래) */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">자산 변동 추이</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPension" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEtf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatYAxis} width={48} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="pension" name="연금 평가금" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPension)" />
              <Area type="monotone" dataKey="els" name="ELS 평가금" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorEls)" />
              <Area type="monotone" dataKey="etf" name="ETF 평가금" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorEtf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
