import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { getWorstPerformer } from '../../utils/elsWorstPerformer'
import { portfolioToEtfRows } from '../../utils/portfolioToEtf'
import { pensionToRows } from '../../utils/pensionToRows'
import { portfolioToRebalancingAccounts } from '../../utils/portfolioToRebalancing'
import { rebalancingTablesToAccounts } from '../../utils/rebalancingTablesToAccounts'
import { totalAssetsToPrincipalValuationTrend } from '../../utils/totalAssetsToPrincipalValuation'
import { getCurrentLevelFromRow, parseBarrierPercent } from '../../utils/elsRiskCounts'
import {
  compareElsListRowsByNextEval,
  formatNextEarlyRedemptionWithCountdown,
} from '../../utils/elsListForDashboard'
import {
  DEFAULT_ELS_ASSET_MAPPING,
  ELS_INVESTING_SHEET_MAPPING,
  ELS_SINGLE_PRICE_MAPPING,
  elsRowsToElsProductsWithMappings,
} from '../../utils/elsRowToProduct'
import type { ElsCardItem, EtfRow, PensionRow } from '../../data/dashboardDummy'
import type { ElsRow } from '../../types/api'
import { ElsRiskProgressBar } from '../ElsRiskProgressBar'
import { SummaryCardsCarousel } from './SummaryCardsCarousel'
import { GlobalOverview } from './GlobalOverview'
import { AssetDetailsTabs } from './AssetDetailsTabs'
import { RebalancingActionCenter } from './RebalancingActionCenter'
import { BottomNav, type MainTabId } from './BottomNav'
import { ElsRegisterModal } from './ElsRegisterModal'
import { ElsRedeemModal } from './ElsRedeemModal'
import { AmountHideToggle } from './AmountHideToggle'
import { LogoutButton } from '../LogoutButton'
import { FileQuestion } from 'lucide-react'

const ELS_TRY_MAPPINGS_FOR_SHEET = [
  ELS_INVESTING_SHEET_MAPPING,
  ELS_SINGLE_PRICE_MAPPING,
  DEFAULT_ELS_ASSET_MAPPING,
]

function parseJoinAmountFromElsRow(row: ElsRow): number | undefined {
  const v = row['가입금액']
  if (v == null) return undefined
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const n = parseFloat(String(v).replace(/,/g, '').replace(/원/g, '').trim())
  return Number.isFinite(n) ? n : undefined
}

function sheetRowIndexFromRow(row: ElsRow): number | undefined {
  const ri = row.row_index
  if (ri == null) return undefined
  if (typeof ri === 'number' && Number.isFinite(ri)) return Math.floor(ri)
  const s = String(ri).trim()
  if (s === '') return undefined
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
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
    etf,
    pension,
    portfolio,
    rebalancing,
    totalAssets,
    elsListSheetData,
    summaryCards,
    pieData,
    isLoading,
    isLoadingAssets,
    isLoadingRebalancing,
    error,
    fetchData,
    clearError,
    hideAmounts,
  } = useStore()
  const [mainTab, setMainTab] = useState<MainTabId>('home')
  const [isElsRegisterModalOpen, setIsElsRegisterModalOpen] = useState(false)
  const [redeemTarget, setRedeemTarget] = useState<ElsCardItem | null>(null)

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const elsListManageTab = useMemo((): ElsCardItem[] => {
    if (!elsListSheetData.length) return []
    const notRedeemed = elsListSheetData.filter(
      (row) => String(row['상태'] ?? '').trim() !== '상환완료'
    )
    if (!notRedeemed.length) return []
    const sorted = [...notRedeemed].sort(compareElsListRowsByNextEval)
    return sorted.map((row, i) => {
      const [product] = elsRowsToElsProductsWithMappings([row], ELS_TRY_MAPPINGS_FOR_SHEET)
      const worst = product != null ? getWorstPerformer(product) : null
      const levelFromWorst = worst != null ? 100 + worst.percentage : 0
      const currentLevel = getCurrentLevelFromRow(row, levelFromWorst)
      const kiBarrier = parseBarrierPercent(row.낙인배리어 ?? row.KI) || 70
      const redemptionBarrier = parseBarrierPercent(row.상환배리어 ?? row['다음 배리어']) || 90
      const productName = row.상품명 != null ? String(row.상품명).trim() : 
        (row.증권사 ? `${row.증권사} ELS ${row.상품회차 || ''}회`.trim() : '')
      return {
        id: `els-manage-${i}`,
        productName: productName || '-',
        nextRedemptionDate: formatNextEarlyRedemptionWithCountdown(row),
        currentLevel,
        kiBarrier,
        redemptionBarrier,
        rowIndex: sheetRowIndexFromRow(row),
        joinAmount: parseJoinAmountFromElsRow(row),
      }
    })
  }, [elsListSheetData])

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
                      {summaryCards && summaryCards.length > 0 ? (
                        <SummaryCardsCarousel
                          items={summaryCards}
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
                        pieData={pieData || []}
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
              <h1 className="text-xl font-bold text-slate-900">ELS 관리</h1>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsElsRegisterModalOpen(true)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  상품 추가
                </button>
                <AmountHideToggle />
                <LogoutButton />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto scrollbar-hide p-4">
              {isLoading || isLoadingAssets ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12 text-slate-500">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden />
                  <p className="text-sm font-medium">로딩 중...</p>
                </div>
              ) : elsListManageTab.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                   <p className="text-sm">등록된 ELS 상품이 없습니다.</p>
                 </div>
              ) : (
                <div className="space-y-4">
                  {elsListManageTab.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      <button
                        type="button"
                        disabled={item.rowIndex == null}
                        onClick={() => {
                          if (item.rowIndex != null) {
                            setRedeemTarget(item)
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/80 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-white"
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
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {isElsRegisterModalOpen && (
          <ElsRegisterModal open onClose={() => setIsElsRegisterModalOpen(false)} />
        )}

        {redeemTarget != null && redeemTarget.rowIndex != null && (
          <ElsRedeemModal
            open
            onClose={() => setRedeemTarget(null)}
            rowIndex={redeemTarget.rowIndex}
            productName={redeemTarget.productName}
            defaultRedeemAmount={redeemTarget.joinAmount}
            onSuccess={() => {
              void fetchData()
            }}
          />
        )}
      </div>

      <BottomNav current={mainTab} onSelect={setMainTab} />
    </div>
  )
}
