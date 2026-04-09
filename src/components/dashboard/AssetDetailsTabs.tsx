import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bar, BarChart, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { ElsRiskProgressBar } from '../ElsRiskProgressBar'
import type { ElsCardItem, EtfRow, PensionRow } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'

type TabId = 'els' | 'etf' | 'pension'

interface AssetDetailsTabsProps {
  elsList: ElsCardItem[]
  etfTable: EtfRow[]
  pensionTable: PensionRow[]
  /** 상세 현황 데이터 로딩 중일 때 true */
  isLoading?: boolean
  hideAmounts: boolean
}

const BAR_SPARKLINE_WIDTH = 80
const BAR_SPARKLINE_HEIGHT = 40

function BarSparkline({ data }: { data: number[] }) {
  const safe = Array.isArray(data) && data.length > 0 ? data : [0]
  const chartData = safe.map((v, i) => ({ index: i, delta: Number(v) }))
  const maxAbs = Math.max(...safe.map((v) => Math.abs(v)), 0.01)
  const yDomain = [-maxAbs - 0.5, maxAbs + 0.5]

  return (
    <div className="flex items-center justify-center py-0.5" style={{ minHeight: BAR_SPARKLINE_HEIGHT }}>
      <BarChart width={BAR_SPARKLINE_WIDTH} height={BAR_SPARKLINE_HEIGHT} data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <XAxis dataKey="index" hide />
        <YAxis hide domain={yDomain} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const v = payload[0].value as number
            return (
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium tracking-wide text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] backdrop-blur-md">
                {v >= 0 ? '+' : ''}{v}%p
              </div>
            )
          }}
          cursor={false}
        />
        <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />
        <Bar dataKey="delta" radius={1} minPointSize={2} isAnimationActive={false}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={safe[i] >= 0 ? '#ef4444' : '#3b82f6'} />
          ))}
        </Bar>
      </BarChart>
    </div>
  )
}

export function AssetDetailsTabs({
  elsList,
  etfTable,
  pensionTable,
  isLoading = false,
  hideAmounts,
}: AssetDetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('els')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'els', label: 'ELS 현황' },
    { id: 'etf', label: 'ETF 현황' },
    { id: 'pension', label: '연금 현황' },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* 상단 탭: 항상 고정 */}
      <div className="flex shrink-0 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="asset-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 상품 목록만 스크롤, 스크롤바 숨김(마우스/터치 스크롤 유지) */}
      <div className="min-h-0 flex-1 overflow-auto scrollbar-hide p-4">
        {isLoading ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden />
            <p className="text-sm font-medium">로딩 중...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'els' && (
              <motion.div
                key="els"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {elsList.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                      <p className="shrink-0 text-sm text-slate-500 tabular-nums">
                        {item.nextRedemptionDate}
                      </p>
                    </div>
                    <div className="mt-3">
                      <ElsRiskProgressBar
                        currentLevel={item.currentLevel}
                        kiBarrier={item.kiBarrier}
                        redemptionBarrier={item.redemptionBarrier}
                        barHeight="h-3"
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {activeTab === 'etf' && (
              <motion.div
                key="etf"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="overflow-x-hidden overflow-y-visible"
              >
                <table className="w-full table-fixed text-sm" style={{ minWidth: 0 }}>
                  <colgroup>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '30%' }} />
                  </colgroup>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200/50 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md">
                      <th className="pb-2 pr-2 text-center font-medium">상품명</th>
                      <th className="pb-2 pr-2 text-center font-medium">원금/평가금</th>
                      <th className="whitespace-nowrap pb-2 pr-2 text-center font-medium">수익률</th>
                      <th className="pb-2 text-center font-medium">최근 6개월 추이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfTable.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="border-b border-slate-100 align-middle"
                      >
                        <td className="py-2 pr-2 text-center text-slate-900">
                          <span className="font-medium">{row.name}</span>
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-center text-slate-700">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.principal)}
                            </span>
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.valuation)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`whitespace-nowrap py-2 pr-2 tabular-nums text-xs font-medium text-center ${
                            row.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {row.returnRate >= 0 ? '▲' : '▼'} {Math.abs(row.returnRate).toFixed(2)}%
                        </td>
                        <td className="py-2 align-middle text-center">
                          <BarSparkline data={row.monthlyDeltas} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}

            {activeTab === 'pension' && (
              <motion.div
                key="pension"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="overflow-x-hidden overflow-y-visible"
              >
                <table className="w-full table-fixed text-sm" style={{ minWidth: 0 }}>
                  <colgroup>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '30%' }} />
                  </colgroup>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200/50 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md">
                      <th className="pb-2 pr-2 text-center font-medium">상품명</th>
                      <th className="pb-2 pr-2 text-center font-medium">원금/평가금</th>
                      <th className="whitespace-nowrap pb-2 pr-2 text-center font-medium">수익률</th>
                      <th className="pb-2 text-center font-medium">최근 6개월 추이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pensionTable.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="border-b border-slate-100 align-middle"
                      >
                        <td className="py-2 pr-2 text-center text-slate-900">
                          <span className="font-medium">{row.name}</span>
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-center text-slate-700">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.principal)}
                            </span>
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.valuation)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`whitespace-nowrap py-2 pr-2 tabular-nums text-xs font-medium text-center ${
                            row.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {row.returnRate >= 0 ? '▲' : '▼'} {Math.abs(row.returnRate).toFixed(2)}%
                        </td>
                        <td className="py-2 align-middle text-center">
                          <BarSparkline data={row.monthlyDeltas} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
