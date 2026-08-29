import { useMemo, useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { motion, AnimatePresence } from 'framer-motion'
import { Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, ReferenceLine } from 'recharts'
import { TrendingUp, ArrowUpRight, ArrowDownRight, BarChart3, LineChart as LineChartIcon, Activity } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { getAssetClassTrend, type AssetClassType, type AssetClassTrendPoint, type ProductTrendPoint } from '../../utils/trendAnalytics'
import { fetchLocalProductHistory } from '../../api/localCsvApi'
import { formatWonDigits, formatAxisAmountShort, formatWonWithWonSymbol } from '../../utils/maskSensitiveAmount'
import { EmptyState } from '../ui/EmptyState'

type ViewMode = 'ASSET_CLASS' | 'PRODUCT'

export function TrendAnalytics() {
  const { totalAssets, etfList, pensionList, isLoading } = useStore(
    useShallow((s) => ({
      totalAssets: s.totalAssets,
      etfList: s.etfList,
      pensionList: s.pensionList,
      isLoading: s.isLoading,
    }))
  )

  const [viewMode, setViewMode] = useState<ViewMode>('ASSET_CLASS')
  const [assetClass, setAssetClass] = useState<AssetClassType>('ALL_ETF')
  
  // Product View State
  const [productType, setProductType] = useState<'ETF' | 'PENSION'>('ETF')
  const [productName, setProductName] = useState<string>('')
  const [productHistory, setProductHistory] = useState<ProductTrendPoint[]>([])

  // Setup Product List
  const availableProducts = useMemo(() => {
    if (productType === 'ETF') {
      return etfList.map(r => r.상품명 || '').filter(Boolean)
    } else {
      return pensionList.map(r => r.상품명 || '').filter(Boolean)
    }
  }, [etfList, pensionList, productType])

  useEffect(() => {
    if (availableProducts.length > 0 && (!productName || !availableProducts.includes(productName))) {
      setProductName(availableProducts[0])
    }
  }, [availableProducts, productName])

  // Load Product History
  useEffect(() => {
    if (!productName) {
      setProductHistory([])
      return
    }
    const data = fetchLocalProductHistory(productName, productType)
    
    // Find base principal from portfolio
    let basePrincipal = 0
    if (productType === 'ETF') {
      const p = etfList.find(r => r.상품명 === productName)
      if (p) basePrincipal = Number(p.투자원금) || 0
    } else {
      const p = pensionList.find(r => r.상품명 === productName)
      if (p) basePrincipal = Number(p.투자원금) || 0
    }

    const processed: ProductTrendPoint[] = []
    let prevValuation = 0
    let prevRate = 0

    data.forEach(([rawDate, rate]) => {
      const dateStr = rawDate.split('T')[0]
      
      // Apply Historical Principal Rules
      let principal = basePrincipal
      if (productName === '해외투자') {
        principal = dateStr < '2026-08-01' ? 22000000 : 26000000
      } else if (productName === '해외투자_정은') {
        principal = dateStr < '2026-08-01' ? 32000000 : 34000000
      }

      const valuation = principal > 0 ? Math.round(principal * (1 + rate / 100)) : 0
      
      const momValuationChange = processed.length > 0 && principal > 0 ? valuation - prevValuation : undefined
      const momReturnRateChange = processed.length > 0 ? rate - prevRate : undefined
      
      processed.push({
        date: dateStr,
        ratePercent: rate,
        principal,
        valuation,
        momValuationChange,
        momReturnRateChange
      })

      prevValuation = valuation
      prevRate = rate
    })

    setProductHistory(processed)
  }, [productName, productType, etfList, pensionList])

  // Process Asset Class Data
  const assetClassData = useMemo(() => {
    return getAssetClassTrend(totalAssets, assetClass)
  }, [totalAssets, assetClass])

  const latestAssetPoint = assetClassData.length > 0 ? assetClassData[assetClassData.length - 1] : null

  // Process Product Summary
  const productSummary = useMemo(() => {
    if (productHistory.length === 0) return null
    const latestRate = productHistory[productHistory.length - 1].ratePercent
    const maxRate = Math.max(...productHistory.map(d => d.ratePercent))
    const minRate = Math.min(...productHistory.map(d => d.ratePercent))
    
    // 최근 6개월 변동폭 (단순화: 전체 길이의 최근 일부를 비교하거나, 날짜로 비교)
    const sixMonthsAgoData = productHistory.length >= 6 ? productHistory[productHistory.length - 6].ratePercent : productHistory[0].ratePercent
    const sixMonthChange = latestRate - sixMonthsAgoData

    return { latestRate, maxRate, minRate, sixMonthChange }
  }, [productHistory])

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-content-tertiary border-t-accent" aria-hidden />
        <p className="text-sm font-semibold text-content-tertiary">데이터를 불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. View Mode Segmented Control */}
      <div className="flex justify-center">
        <div className="flex items-center gap-1 rounded-2xl border border-stroke bg-surface-secondary/40 p-1.5 shadow-inner">
          <button
            onClick={() => setViewMode('ASSET_CLASS')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
              viewMode === 'ASSET_CLASS'
                ? 'bg-surface-card text-content-primary shadow-sm ring-1 ring-stroke'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            <BarChart3 className="h-4 w-4" /> 자산군별 분석
          </button>
          <button
            onClick={() => setViewMode('PRODUCT')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
              viewMode === 'PRODUCT'
                ? 'bg-surface-card text-content-primary shadow-sm ring-1 ring-stroke'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            <LineChartIcon className="h-4 w-4" /> 개별 상품/계좌 분석
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'ASSET_CLASS' ? (
          <motion.div
            key="asset-class"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            {/* Asset Class Tabs */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-content-primary mr-2">자산군 선택</span>
              {[
                { id: 'ALL_ETF', label: '전체 ETF' },
                { id: 'PENSION', label: '연금' },
                { id: 'CASH', label: '현금' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAssetClass(tab.id as AssetClassType)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    assetClass === tab.id
                      ? 'bg-accent text-white shadow-md'
                      : 'border border-stroke bg-surface-card text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Asset Class Chart Area */}
            {assetClassData.length > 0 ? (
              <div className="rounded-2xl border border-stroke bg-surface-card p-5 shadow-glass-sm">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-content-primary flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-accent" />
                      {assetClass === 'ALL_ETF' ? '전체 ETF' : assetClass === 'PENSION' ? '연금' : '현금'} 시계열 추이
                    </h3>
                    <p className="mt-1 text-xs text-content-tertiary">평가일 기준 원금, 평가금 및 수익률 복합 분석</p>
                  </div>
                  
                  {latestAssetPoint && (
                    <div className="flex items-center gap-4 rounded-xl border border-stroke bg-surface-secondary/30 px-4 py-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-content-tertiary">현재 평가금</span>
                        <span className="text-sm font-extrabold tabular-nums text-content-primary">
                          {formatWonWithWonSymbol(latestAssetPoint.valuation)}
                        </span>
                      </div>
                      <div className="flex flex-col border-l border-stroke pl-4">
                        <span className="text-[10px] text-content-tertiary">현재 수익률</span>
                        <span className={`text-sm font-extrabold tabular-nums ${
                          latestAssetPoint.returnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {latestAssetPoint.returnRate >= 0 ? '+' : ''}{latestAssetPoint.returnRate.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={assetClassData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValuation" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} tickLine={false} axisLine={false} />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                        tickFormatter={(v) => formatAxisAmountShort(v, formatWonDigits(v))}
                        width={60}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#f59e0b' }}
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                        width={40}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const row = payload[0].payload as AssetClassTrendPoint
                          return (
                            <div className="rounded-xl border border-stroke-strong bg-surface-elevated/95 p-3.5 shadow-glass backdrop-blur-xl">
                              <p className="mb-2 text-xs font-bold text-content-secondary border-b border-stroke/60 pb-1.5">{label}</p>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-content-secondary">원금</span>
                                  <span className="text-xs font-bold tabular-nums">{formatWonWithWonSymbol(row.principal)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-xs text-content-secondary">평가금</span>
                                  <span className="text-xs font-bold tabular-nums">{formatWonWithWonSymbol(row.valuation)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 border-t border-stroke/60 pt-1.5">
                                  <span className="text-xs text-content-secondary">수익률</span>
                                  <span className={`text-xs font-extrabold tabular-nums ${row.returnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {row.returnRate >= 0 ? '+' : ''}{row.returnRate.toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="valuation"
                        name="평가금액"
                        stroke="var(--color-chart-2)"
                        fill="url(#colorValuation)"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="principal"
                        name="투자원금"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="returnRate"
                        name="수익률 (%)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyState title="시계열 데이터가 없습니다" description="해당 자산군의 이력 데이터가 존재하지 않습니다." />
            )}

            {/* Asset Class Monthly Table */}
            {assetClassData.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-stroke bg-surface-card shadow-glass-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-secondary/50 text-xs text-content-secondary">
                    <tr>
                      <th className="px-4 py-3 font-semibold">평가일</th>
                      <th className="px-4 py-3 font-semibold text-right">투자원금</th>
                      <th className="px-4 py-3 font-semibold text-right">평가금액</th>
                      <th className="px-4 py-3 font-semibold text-right">전월대비 증감(MoM)</th>
                      <th className="px-4 py-3 font-semibold text-right">수익률(%)</th>
                      <th className="px-4 py-3 font-semibold text-right">수익률 변동(p)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke">
                    {[...assetClassData].reverse().map((row, idx) => (
                      <tr key={idx} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-4 py-3 text-content-primary tabular-nums">{row.date}</td>
                        <td className="px-4 py-3 text-right text-content-secondary tabular-nums">{formatWonDigits(row.principal)}원</td>
                        <td className="px-4 py-3 text-right font-bold text-content-primary tabular-nums">{formatWonDigits(row.valuation)}원</td>
                        <td className="px-4 py-3 text-right">
                          {row.momValuationChange != null ? (
                            <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                              row.momValuationChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {row.momValuationChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {formatWonDigits(Math.abs(row.momValuationChange))}
                            </span>
                          ) : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold tabular-nums ${row.returnRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {row.returnRate >= 0 ? '+' : ''}{row.returnRate.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.momReturnRateChange != null ? (
                            <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                              row.momReturnRateChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {row.momReturnRateChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {Math.abs(row.momReturnRateChange).toFixed(2)}%p
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="product"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            {/* Product Selectors */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-stroke bg-surface-card p-4 shadow-glass-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-content-primary">분류</span>
                <div className="flex items-center rounded-lg bg-surface-secondary/50 p-1">
                  <button
                    onClick={() => setProductType('ETF')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${productType === 'ETF' ? 'bg-surface-card text-content-primary shadow-sm' : 'text-content-secondary'}`}
                  >
                    ETF/상품
                  </button>
                  <button
                    onClick={() => setProductType('PENSION')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${productType === 'PENSION' ? 'bg-surface-card text-content-primary shadow-sm' : 'text-content-secondary'}`}
                  >
                    연금계좌
                  </button>
                </div>
              </div>
              <div className="h-px w-full sm:h-8 sm:w-px bg-stroke" />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-bold text-content-primary whitespace-nowrap">상품명</span>
                <select
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full sm:w-auto flex-1 rounded-xl border border-stroke bg-surface-primary px-3 py-2 text-sm text-content-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {availableProducts.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product Summary Cards */}
            {productSummary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-stroke bg-surface-card p-4">
                  <p className="text-xs font-medium text-content-tertiary">현재 수익률</p>
                  <p className={`mt-1 text-xl font-black tabular-nums ${productSummary.latestRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {productSummary.latestRate >= 0 ? '+' : ''}{productSummary.latestRate.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-surface-card p-4">
                  <p className="text-xs font-medium text-content-tertiary">최고 수익률</p>
                  <p className="mt-1 text-xl font-black text-content-primary tabular-nums">
                    {productSummary.maxRate > 0 ? '+' : ''}{productSummary.maxRate.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-surface-card p-4">
                  <p className="text-xs font-medium text-content-tertiary">최저 수익률</p>
                  <p className="mt-1 text-xl font-black text-content-primary tabular-nums">
                    {productSummary.minRate > 0 ? '+' : ''}{productSummary.minRate.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-stroke bg-surface-card p-4">
                  <p className="text-xs font-medium text-content-tertiary">최근 6개월 변동</p>
                  <div className="mt-1 flex items-center gap-1">
                    {productSummary.sixMonthChange >= 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-400" /> : <ArrowDownRight className="h-5 w-5 text-rose-400" />}
                    <p className={`text-xl font-black tabular-nums ${productSummary.sixMonthChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Math.abs(productSummary.sixMonthChange).toFixed(2)}%p
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Product Trend Chart */}
            {productHistory.length > 0 ? (
              <div className="rounded-2xl border border-stroke bg-surface-card p-5 shadow-glass-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent" />
                  <h3 className="text-base font-bold text-content-primary">{productName} 시계열 수익률</h3>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={productHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRateUp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRateDown" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                        tickFormatter={(v) => `${v}%`}
                        width={50}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const val = payload[0].value as number
                          return (
                            <div className="rounded-xl border border-stroke-strong bg-surface-elevated/95 p-3 shadow-glass backdrop-blur-xl">
                              <p className="mb-1 text-xs text-content-tertiary">{label}</p>
                              <p className={`text-sm font-extrabold tabular-nums ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                              </p>
                            </div>
                          )
                        }}
                      />
                      <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
                      <Area
                        type="monotone"
                        dataKey="ratePercent"
                        stroke="#10b981"
                        fill="url(#colorRateUp)"
                        strokeWidth={2}
                        activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyState title="데이터 없음" description="선택한 상품의 이력 데이터가 없습니다." />
            )}

            {/* Product History Monthly Table */}
            {productHistory.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-stroke bg-surface-card shadow-glass-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-secondary/50 text-xs text-content-secondary">
                    <tr>
                      <th className="px-4 py-3 font-semibold">평가일</th>
                      <th className="px-4 py-3 font-semibold text-right">투자원금</th>
                      <th className="px-4 py-3 font-semibold text-right">평가금액</th>
                      <th className="px-4 py-3 font-semibold text-right">증감(MoM)</th>
                      <th className="px-4 py-3 font-semibold text-right">수익률(%)</th>
                      <th className="px-4 py-3 font-semibold text-right">수익률 변동(p)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke">
                    {[...productHistory].reverse().map((row, idx) => (
                      <tr key={idx} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-4 py-3 text-content-primary tabular-nums">{row.date}</td>
                        <td className="px-4 py-3 text-right text-content-secondary tabular-nums">
                          {row.principal ? `${formatWonDigits(row.principal)}원` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-content-primary tabular-nums">
                          {row.valuation ? `${formatWonDigits(row.valuation)}원` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.momValuationChange != null ? (
                            <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                              row.momValuationChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {row.momValuationChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {formatWonDigits(Math.abs(row.momValuationChange))}
                            </span>
                          ) : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold tabular-nums ${row.ratePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {row.ratePercent >= 0 ? '+' : ''}{row.ratePercent.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.momReturnRateChange != null ? (
                            <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                              row.momReturnRateChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {row.momReturnRateChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {Math.abs(row.momReturnRateChange).toFixed(2)}%p
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
