import { useEffect, useMemo, useState } from 'react'
import { useStore, useElsProductsWithMappings } from '../../store/useStore'
import { getWorstPerformer } from '../../utils/elsWorstPerformer'
import { portfolioToEtfRows } from '../../utils/portfolioToEtf'
import { pensionToRows } from '../../utils/pensionToRows'
import { portfolioToRebalancingAccounts } from '../../utils/portfolioToRebalancing'
import { rebalancingTablesToAccounts } from '../../utils/rebalancingTablesToAccounts'
import { totalAssetsToPrincipalValuationTrend } from '../../utils/totalAssetsToPrincipalValuation'
import { buildHomeOverviewFromRawFormulas } from '../../utils/homeOverviewFromRawFormulas'
import { getCurrentLevelFromRow, parseBarrierPercent } from '../../utils/elsRiskCounts'
import type { ElsCardItem, EtfRow, PensionRow } from '../../data/dashboardDummy'
import { SummaryCardsCarousel } from './SummaryCardsCarousel'
import { GlobalOverview } from './GlobalOverview'
import { AssetDetailsTabs } from './AssetDetailsTabs'
import { RebalancingActionCenter } from './RebalancingActionCenter'
import { BottomNav, type MainTabId } from './BottomNav'
import { ElsRegisterModal } from './ElsRegisterModal'
import { AmountHideToggle } from './AmountHideToggle'
import { LogoutButton } from '../LogoutButton'
import { FileQuestion } from 'lucide-react'

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

function HomeLoadingScreen() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
        aria-hidden
      />
      <p className="text-sm font-medium">로딩 중...</p>
    </div>
  )
}

export function DashboardLayout() {
  const {
    els,
    etf,
    pension,
    portfolio,
    rebalancing,
    totalAssets,
    elsCompleted,
    elsSheetTotals,
    cashOther,
    isLoading,
    isLoadingAssets,
    isLoadingRebalancing,
    error,
    fetchData,
    clearError,
    hideAmounts,
  } = useStore()
  const elsProducts = useElsProductsWithMappings()
  const [mainTab, setMainTab] = useState<MainTabId>('home')

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const elsListForTab = useMemo((): ElsCardItem[] => {
    if (!els.length) return []
    return els.map((row, i) => {
      const product = elsProducts[i]
      const worst = product != null ? getWorstPerformer(product) : null
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
  }, [els, elsProducts])

  const etfTableForTab = useMemo((): EtfRow[] => {
    if (!etf.length) return []
    return portfolioToEtfRows(etf)
  }, [etf])

  const pensionTableForTab = useMemo((): PensionRow[] => {
    if (!pension.length) return []
    return pensionToRows(pension)
  }, [pension])

  const principalValuationTrend = useMemo(
    () => totalAssetsToPrincipalValuationTrend(totalAssets),
    [totalAssets]
  )

  const homeOverview = useMemo(
    () =>
      buildHomeOverviewFromRawFormulas(pension, etf, els, elsCompleted, cashOther, elsSheetTotals),
    [pension, etf, els, elsCompleted, cashOther, elsSheetTotals]
  )

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
      <div className="relative mx-auto min-h-screen max-w-[480px] bg-slate-50 pb-20 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <div className="relative min-h-[calc(100vh-3.5rem)]">
          <div
            className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide transition-opacity duration-300 ease-out"
            style={{
              opacity: mainTab === 'home' ? 1 : 0,
              pointerEvents: mainTab === 'home' ? 'auto' : 'none',
              zIndex: mainTab === 'home' ? 1 : 0,
            }}
          >
            <div className="flex flex-col pb-6">
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
                <h1 className="text-xl font-bold text-slate-900">종합 자산</h1>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <AmountHideToggle />
                  <LogoutButton />
                </div>
              </div>
              <div className="px-4">
                {isLoading ? (
                  <HomeLoadingScreen />
                ) : error ? (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-900">
                    <p className="font-medium">데이터를 불러오지 못했습니다</p>
                    <p className="mt-2 whitespace-pre-wrap text-rose-800/90">{error}</p>
                    <button
                      type="button"
                      onClick={() => {
                        clearError()
                        fetchData()
                      }}
                      className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      {homeOverview.summaryCards.length > 0 ? (
                        <SummaryCardsCarousel
                          items={homeOverview.summaryCards}
                          hideAmounts={hideAmounts}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-12 text-center shadow-sm backdrop-blur-sm">
                          <FileQuestion className="mb-3 h-10 w-10 text-slate-300" strokeWidth={1} />
                          <p className="text-sm font-semibold text-slate-600">요약 카드가 없습니다</p>
                          <p className="mt-1 text-xs text-slate-400">
                            총자산 시트에서 표시할 수 있는 최신 행이 없습니다.<br />
                            평가일, 원금, 평가금 열을 확인해 주세요.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-6">
                      <h2 className="text-sm font-semibold text-slate-700">전체 현황</h2>
                      <GlobalOverview
                        pieData={homeOverview.pieData}
                        principalValuationTrend={principalValuationTrend}
                        totalAssetsRowCount={totalAssets.length}
                        hideAmounts={hideAmounts}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            className="absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ease-out"
            style={{
              opacity: mainTab === 'assets' ? 1 : 0,
              pointerEvents: mainTab === 'assets' ? 'auto' : 'none',
              zIndex: mainTab === 'assets' ? 1 : 0,
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
              <h1 className="text-xl font-bold text-slate-900">자산 상세</h1>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <AmountHideToggle />
                <LogoutButton />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
              <AssetDetailsTabs
                elsList={elsListForTab}
                etfTable={etfTableForTab}
                pensionTable={pensionTableForTab}
                isLoading={isLoading || isLoadingAssets}
                hideAmounts={hideAmounts}
              />
            </div>
          </div>

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
              isLoading={isLoading || isLoadingRebalancing}
              compact
              hideAmounts={hideAmounts}
            />
          </div>

          <div
            className="absolute inset-0 flex flex-col overflow-hidden bg-slate-50 transition-opacity duration-300 ease-out"
            style={{
              opacity: mainTab === 'elsRegister' ? 1 : 0,
              pointerEvents: mainTab === 'elsRegister' ? 'auto' : 'none',
              zIndex: mainTab === 'elsRegister' ? 1 : 0,
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
              <h1 className="text-xl font-bold text-slate-900">ELS 등록</h1>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <AmountHideToggle />
                <LogoutButton />
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-start px-4 pt-8 text-center">
              <p className="max-w-xs text-sm text-slate-500">
                등록 폼이 열렸습니다. 화면 하단(또는 중앙)의 패널에서 입력하거나, 바깥 영역을 눌러
                닫을 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {mainTab === 'elsRegister' && (
          <ElsRegisterModal open onClose={() => setMainTab('home')} />
        )}
      </div>

      <BottomNav current={mainTab} onSelect={setMainTab} />
    </div>
  )
}
