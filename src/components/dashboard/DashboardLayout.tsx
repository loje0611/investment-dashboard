import { lazy, Suspense, useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { LayoutDashboard, PieChart, Scale, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { rebalancingTablesToAccounts } from '../../utils/rebalancingTablesToAccounts'
import { portfolioToEtfRows } from '../../utils/portfolioToEtf'
import { pensionToRows } from '../../utils/pensionToRows'
import { totalAssetsToPrincipalValuationTrend } from '../../utils/totalAssetsToPrincipalValuation'
import {
  buildSummaryCardsFromSnapshot,
  buildPieSegmentsFromSnapshot,
} from '../../utils/homeFromTotalAssets'
import { generateInsightText } from '../../utils/generateInsight'
import type { EtfRow, PensionRow } from '../../types/dashboard'
import { useHashTab } from '../../hooks/useHashTab'

const GlobalOverview = lazy(() => import('./GlobalOverview').then(m => ({ default: m.GlobalOverview })))
const AssetDetailsTabs = lazy(() => import('./AssetDetailsTabs').then(m => ({ default: m.AssetDetailsTabs })))
const RebalancingActionCenter = lazy(() => import('./RebalancingActionCenter').then(m => ({ default: m.RebalancingActionCenter })))

const VALID_TABS = ['home', 'assets', 'rebalancing'] as const
type MainTabId = (typeof VALID_TABS)[number]

function LazyChunkFallback({ label = '로딩 중…' }: { label?: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 py-16">
      <div className="h-9 w-9 animate-spin rounded-full border-3 border-content-tertiary border-t-accent" aria-hidden />
      <p className="text-sm font-semibold text-content-tertiary">{label}</p>
    </div>
  )
}

export function DashboardLayout() {
  const {
    etfList, pensionList, cashList, totalAssets, rebalancing,
    isLoading, isLoadingAssets, hideAmounts,
  } = useStore(
    useShallow((s) => ({
      etfList: s.etfList, pensionList: s.pensionList, cashList: s.cashList,
      totalAssets: s.totalAssets, rebalancing: s.rebalancing,
      isLoading: s.isLoading, isLoadingAssets: s.isLoadingAssets,
      hideAmounts: s.hideAmounts,
    }))
  )
  const fetchData = useStore((s) => s.fetchData)

  const realTimeAccountValuationMap = useMemo(() => {
    const map: Record<string, { totalValuation: number; totalPrincipal: number }> = {}
    const accountsFromTables = rebalancingTablesToAccounts(rebalancing || [])

    accountsFromTables.forEach((acc) => {
      const accName = acc.label.trim()
      let totalVal = 0
      let totalPrin = 0

      acc.holdings.forEach((h) => {
        const val = (h.quantity > 0 && h.currentPrice > 0)
          ? (h.quantity * h.currentPrice)
          : h.currentValue
        totalVal += val
        totalPrin += h.currentValue
      })

      if (totalVal > 0) {
        map[accName] = { totalValuation: totalVal, totalPrincipal: totalPrin }
      }
    })

    return map
  }, [rebalancing])

  const [mainTab, setMainTab] = useHashTab<MainTabId>(VALID_TABS, 'home')

  useEffect(() => { fetchData() }, [fetchData])

  const cashTableForTab = useMemo(() => {
    return cashList.map((row, idx) => ({
      id: `cash-${idx}`,
      name: row.상품명 || '이름 없음',
      principal: row.투자원금 || 0,
      valuation: row.평가금액 || 0,
      returnRate: row.수익률 || 0,
      sparklineData: [], // Cash doesn't have sparklines yet
      monthlyDeltas: [],
    }))
  }, [cashList])

  const etfTableForTab = useMemo((): EtfRow[] => {
    const rows = etfList.length ? portfolioToEtfRows(etfList) : []
    return rows.map((row) => {
      const name = row.name.trim()
      let key: string | null = null
      if (name.includes('ISA_정은') || name.includes('ISA (정은)')) key = 'ISA_정은'
      else if (name.includes('ISA')) key = 'ISA'
      else if (name.includes('해외투자_정은') || name.includes('해외 (정은)')) key = '해외투자_정은'
      else if (name.includes('해외투자') || name.includes('해외')) key = '해외투자'

      if (key && realTimeAccountValuationMap[key]) {
        const { totalValuation } = realTimeAccountValuationMap[key]
        const principal = row.principal
        const returnRate = principal > 0
          ? Math.round(((totalValuation - principal) / principal) * 100)
          : row.returnRate
        return { ...row, principal, valuation: totalValuation, returnRate }
      }
      return row
    })
  }, [etfList, realTimeAccountValuationMap])

  const pensionTableForTab = useMemo((): PensionRow[] => {
    const rows = pensionList.length ? pensionToRows(pensionList) : []
    return rows.map((row) => {
      const name = row.name.trim()
      let keys: string[] = []
      if (name.includes('연금저축_정은') || name.includes('연금저축 (정은)')) keys = ['연금저축_정은']
      else if (name.includes('연금저축')) keys = ['연금저축']
      else if (name.includes('퇴직연금')) keys = ['IRP_회사', 'IRP_개인']
      else if (name.includes('IRP_회사') || name.includes('IRP (회사)')) keys = ['IRP_회사']
      else if (name.includes('개인연금') || name.includes('IRP_개인') || name.includes('IRP (개인)')) keys = ['IRP_개인']

      if (keys.length > 0) {
        let sumValuation = 0
        let hasValue = false
        for (const k of keys) {
          if (realTimeAccountValuationMap[k]) {
            sumValuation += realTimeAccountValuationMap[k].totalValuation
            hasValue = true
          }
        }
        if (hasValue) {
          const principal = row.principal
          const returnRate = principal > 0
            ? Math.round(((sumValuation - principal) / principal) * 100)
            : row.returnRate
          return { ...row, principal, valuation: sumValuation, returnRate }
        }
      }
      return row
    })
  }, [pensionList, realTimeAccountValuationMap])

  const currentSnapshot = useMemo(() => {
    let etfVal = 0, etfPrin = 0
    etfTableForTab.forEach((r) => { etfVal += r.valuation; etfPrin += r.principal })

    let penVal = 0, penPrin = 0
    pensionTableForTab.forEach((r) => { penVal += r.valuation; penPrin += r.principal })

    let cashVal = 0, cashPrin = 0
    cashTableForTab.forEach((r) => { cashVal += r.valuation; cashPrin += r.principal })

    const totalVal = etfVal + penVal + cashVal
    const totalPrin = etfPrin + penPrin + cashPrin
    const totalYield = totalPrin > 0 ? ((totalVal - totalPrin) / totalPrin) * 100 : null

    return {
      row: {},
      totalValuation: totalVal,
      totalPrincipal: totalPrin,
      totalYieldPercent: totalYield,
      연금평가금: penVal, 연금원금: penPrin,
      etf평가금: etfVal, etf원금: etfPrin,
      현금평가금: cashVal, 현금원금: cashPrin,
    } as any
  }, [etfTableForTab, pensionTableForTab, cashTableForTab])

  const principalValuationTrend = useMemo(() => totalAssetsToPrincipalValuationTrend(totalAssets), [totalAssets])
  const homeSummaryCards = useMemo(() => buildSummaryCardsFromSnapshot(currentSnapshot), [currentSnapshot])
  const homePieData = useMemo(() => buildPieSegmentsFromSnapshot(currentSnapshot), [currentSnapshot])
  const insightText = useMemo(() => generateInsightText(principalValuationTrend), [principalValuationTrend])

  const navItems = [
    { id: 'home' as const, label: '홈', icon: LayoutDashboard },
    { id: 'assets' as const, label: '자산 상세', icon: PieChart },
    { id: 'rebalancing' as const, label: '리밸런싱', icon: Scale },
  ]

  return (
    <div className="min-h-screen bg-surface-primary text-content-primary">
      <header className="sticky top-0 z-40 border-b border-stroke bg-surface-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-md shadow-accent/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-content-primary">
                Asset Flow <span className="text-accent font-semibold">Desktop</span>
              </h1>
              <p className="text-[11px] font-medium text-content-tertiary">스마트 자산 관리 & 리밸런싱</p>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 rounded-2xl border border-stroke bg-surface-secondary/60 p-1.5 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = mainTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMainTab(item.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow-md shadow-accent/25 scale-[1.02]'
                      : 'text-content-secondary hover:bg-surface-card hover:text-content-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">
        {mainTab === 'home' && (
          <Suspense fallback={<LazyChunkFallback label="대시보드를 불러오는 중…" />}>
            <GlobalOverview
              cards={homeSummaryCards}
              pieData={homePieData}
              principalValuationTrend={principalValuationTrend}
              insightText={insightText || undefined}
              isLoading={isLoading}
              hideAmounts={hideAmounts}
            />
          </Suspense>
        )}

        {mainTab === 'assets' && (
          <Suspense fallback={<LazyChunkFallback label="자산 상세를 불러오는 중…" />}>
            <AssetDetailsTabs
              etfTable={etfTableForTab}
              pensionTable={pensionTableForTab}
              cashTable={cashTableForTab}
              isLoading={isLoading || isLoadingAssets}
              hideAmounts={hideAmounts}
            />
          </Suspense>
        )}

        {mainTab === 'rebalancing' && (
          <Suspense fallback={<LazyChunkFallback label="리밸런싱을 불러오는 중…" />}>
            <RebalancingActionCenter hideAmounts={hideAmounts} />
          </Suspense>
        )}
      </main>
    </div>
  )
}
