import { useEffect, useMemo, useState } from 'react'
import { useStore, useElsProductsWithMappings } from '../../store/useStore'
import { getWorstPerformer } from '../../utils/elsWorstPerformer'
import { portfolioToEtfRows } from '../../utils/portfolioToEtf'
import { pensionToRows } from '../../utils/pensionToRows'
import { portfolioToRebalancingAccounts } from '../../utils/portfolioToRebalancing'
import { rebalancingTablesToAccounts } from '../../utils/rebalancingTablesToAccounts'
import type { ElsCardItem, EtfRow, PensionRow } from '../../data/dashboardDummy'
import { SummaryCardsCarousel } from './SummaryCardsCarousel'
import { GlobalOverview } from './GlobalOverview'
import { AssetDetailsTabs } from './AssetDetailsTabs'
import { RebalancingActionCenter } from './RebalancingActionCenter'
import { BottomNav, type MainTabId } from './BottomNav'
import {
  SUMMARY_CARDS,
  PIE_DATA,
  TREND_DATA,
  ELS_LIST,
  ETF_TABLE,
  PENSION_TABLE,
} from '../../data/dashboardDummy'

function parseBarrierPercent(
  value: string | number | boolean | null | undefined
): number {
  if (value == null) return 0
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value > 0 && value < 1.5 ? value * 100 : value
  }
  const s = String(value).replace(/%/g, '').trim()
  const n = parseFloat(s)
  if (Number.isNaN(n)) return 0
  return n > 0 && n < 1.5 ? n * 100 : n
}

function getCurrentLevelFromRow(
  row: Record<string, unknown>,
  fallback: number
): number {
  const worstPerf = row['Worst Perf.'] ?? row['Worst Perf']
  if (worstPerf != null && worstPerf !== '') {
    const s = String(worstPerf).replace(/%/g, '').trim()
    const n = parseFloat(s)
    if (!Number.isNaN(n)) return n
  }
  const currentLevel = row.현재수준 ?? row['현재 수준']
  if (currentLevel != null) {
    const n = typeof currentLevel === 'number' ? currentLevel : parseFloat(String(currentLevel))
    if (!Number.isNaN(n)) return Math.max(0, Math.min(100, n))
  }
  const curr = row.현재가 != null ? Number(row.현재가) : NaN
  const base = row.기준가 != null ? Number(row.기준가) : NaN
  if (!Number.isNaN(curr) && !Number.isNaN(base) && base !== 0) {
    return Math.max(0, Math.min(100, (curr / base) * 100))
  }
  return fallback
}

function getNextRedemptionDate(row: Record<string, unknown>): string {
  const next = row['다음 평가일']
  if (next != null && String(next).trim() !== '') return String(next).trim()
  const first = row['1차 날짜']
  if (first != null && String(first).trim() !== '') return String(first).trim()
  return ''
}

function formatRedemptionDateDisplay(dateStr: string): string {
  if (!dateStr || dateStr === '-') return dateStr
  const s = String(dateStr).trim()
  const beforeT = s.split('T')[0]
  if (beforeT && /^\d{4}-\d{2}-\d{2}$/.test(beforeT)) return beforeT
  return s
}

export function DashboardLayout() {
  const { els, etf, pension, portfolio, rebalancing, isLoading, isLoadingAssets, isLoadingRebalancing, fetchData } = useStore()
  const elsProducts = useElsProductsWithMappings()
  const [mainTab, setMainTab] = useState<MainTabId>('home')

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const elsListForTab = useMemo((): ElsCardItem[] => {
    if (!els.length) return ELS_LIST
    const fromApi = els.map((row, i) => {
      const product = elsProducts[i]
      const worst = product ? getWorstPerformer(product) : null
      const levelFromWorst = worst != null ? 100 + worst.percentage : 0
      const currentLevel = getCurrentLevelFromRow(row, levelFromWorst)
      const kiBarrier = parseBarrierPercent(row.낙인배리어 ?? row.KI) || 70
      const redemptionBarrier = parseBarrierPercent(row.상환배리어 ?? row['다음 배리어']) || 90
      const nextDate = getNextRedemptionDate(row)
      const productName = row.상품명 != null ? String(row.상품명).trim() : ''
      return {
        id: `els-${i}`,
        productName: productName || '-',
        nextRedemptionDate: nextDate ? formatRedemptionDateDisplay(nextDate) : '-',
        currentLevel,
        kiBarrier,
        redemptionBarrier,
      }
    })
    const hasMeaningfulData = fromApi.some(
      (item) => item.productName !== '-' || item.nextRedemptionDate !== '-' || item.currentLevel !== 0
    )
    return hasMeaningfulData ? fromApi : ELS_LIST
  }, [els, elsProducts])

  const etfTableForTab = useMemo((): EtfRow[] => {
    if (!etf.length) return ETF_TABLE
    const fromApi = portfolioToEtfRows(etf)
    const hasMeaningful = fromApi.some((r) => r.name !== '-' || r.principal > 0 || r.valuation > 0)
    return hasMeaningful ? fromApi : ETF_TABLE
  }, [etf])

  const pensionTableForTab = useMemo((): PensionRow[] => {
    if (!pension.length) return PENSION_TABLE
    const fromApi = pensionToRows(pension)
    const hasMeaningful = fromApi.some((r) => r.name !== '-' || r.principal > 0 || r.valuation > 0)
    return hasMeaningful ? fromApi : PENSION_TABLE
  }, [pension])

  const rebalancingAccounts = useMemo(() => {
    if (rebalancing && rebalancing.length > 0) {
      const fromTables = rebalancingTablesToAccounts(rebalancing)
      if (fromTables.length > 0) return fromTables
    }
    const fromPortfolio = portfolioToRebalancingAccounts(portfolio)
    return fromPortfolio.length > 0 ? fromPortfolio : []
  }, [rebalancing, portfolio])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 모바일 프레임: 최대 480px 중앙 정렬, PC에서도 폰처럼 보이게 */}
      <div className="relative mx-auto min-h-screen max-w-[480px] bg-slate-50 pb-20 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        {/* 메인 콘텐츠: 탭별로 전환, 스크롤 없이 화면 단위 전환 */}
        <div className="relative min-h-[calc(100vh-3.5rem)]">
          {/* 홈(대시보드) */}
          <div
            className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide transition-opacity duration-300 ease-out"
            style={{
              opacity: mainTab === 'home' ? 1 : 0,
              pointerEvents: mainTab === 'home' ? 'auto' : 'none',
              zIndex: mainTab === 'home' ? 1 : 0,
            }}
          >
            <div className="flex flex-col pb-6">
              <h1 className="shrink-0 px-4 pt-6 pb-3 text-xl font-bold text-slate-900">종합 자산</h1>
              <div className="px-4">
              <div className="mb-6">
                <SummaryCardsCarousel items={SUMMARY_CARDS} />
              </div>
              <div className="space-y-6">
                <h2 className="text-sm font-semibold text-slate-700">전체 현황</h2>
                <GlobalOverview pieData={PIE_DATA} trendData={TREND_DATA} />
              </div>
              </div>
            </div>
          </div>

          {/* 자산 상세: 타이틀·탭 고정, 상품 목록만 스크롤·가로 스크롤바 항상 노출 */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ease-out"
            style={{
              opacity: mainTab === 'assets' ? 1 : 0,
              pointerEvents: mainTab === 'assets' ? 'auto' : 'none',
              zIndex: mainTab === 'assets' ? 1 : 0,
            }}
          >
            <h1 className="shrink-0 px-4 pt-6 pb-3 text-xl font-bold text-slate-900">자산 상세</h1>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
              <AssetDetailsTabs
                elsList={elsListForTab}
                etfTable={etfTableForTab}
                pensionTable={pensionTableForTab}
                isLoading={isLoadingAssets}
              />
            </div>
          </div>

          {/* 리밸런싱: 타이틀·필터 고정, 테이블만 스크롤·가로 스크롤바 항상 노출 */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ease-out"
            style={{
              opacity: mainTab === 'rebalancing' ? 1 : 0,
              pointerEvents: mainTab === 'rebalancing' ? 'auto' : 'none',
              zIndex: mainTab === 'rebalancing' ? 1 : 0,
            }}
          >
            <RebalancingActionCenter
              accounts={rebalancingAccounts}
              isLoading={isLoadingRebalancing}
              compact
            />
          </div>
        </div>
      </div>

      <BottomNav current={mainTab} onSelect={setMainTab} />
    </div>
  )
}
