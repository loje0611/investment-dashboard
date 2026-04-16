import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { Loader2, Calculator, RefreshCw } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { getWorstPerformer } from '../../utils/elsWorstPerformer'
import { portfolioToEtfRows } from '../../utils/portfolioToEtf'
import { pensionToRows } from '../../utils/pensionToRows'
import { rebalancingTablesToAccounts } from '../../utils/rebalancingTablesToAccounts'
import { totalAssetsToPrincipalValuationTrend } from '../../utils/totalAssetsToPrincipalValuation'
import {
  getLatestTotalAssetSnapshot,
  buildSummaryCardsFromSnapshot,
  buildPieSegmentsFromSnapshot,
  mergeSummaryWithElsProfitCard,
} from '../../utils/homeFromTotalAssets'
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
import { generateInsightText } from '../../utils/generateInsight'
import type { ElsCardItem, EtfRow, PensionRow } from '../../data/dashboardDummy'
import type { ElsRow } from '../../types/api'
import { SummaryCardsCarousel } from './SummaryCardsCarousel'
import { BottomNav, type MainTabId } from './BottomNav'
import { PageHeader } from '../ui/PageHeader'
import { EmptyState } from '../ui/EmptyState'
import { HomeSkeleton } from '../ui/SkeletonCard'
import { Toast, type ToastData } from '../ui/Toast'
import { postSyncAllInvestment } from '../../api/api'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useHashTab } from '../../hooks/useHashTab'

const GlobalOverview = lazy(() => import('./GlobalOverview').then(m => ({ default: m.GlobalOverview })))
const AssetDetailsTabs = lazy(() => import('./AssetDetailsTabs').then(m => ({ default: m.AssetDetailsTabs })))
const RebalancingActionCenter = lazy(() => import('./RebalancingActionCenter').then(m => ({ default: m.RebalancingActionCenter })))
const ElsRegisterModal = lazy(() => import('./ElsRegisterModal').then(m => ({ default: m.ElsRegisterModal })))
const ElsRedeemModal = lazy(() => import('./ElsRedeemModal').then(m => ({ default: m.ElsRedeemModal })))

const VALID_TABS = ['home', 'assets', 'rebalancing'] as const
const ELS_TRY_MAPPINGS_FOR_SHEET = [
  ELS_INVESTING_SHEET_MAPPING, ELS_SINGLE_PRICE_MAPPING, DEFAULT_ELS_ASSET_MAPPING,
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

function LazyChunkFallback({ label = '로딩 중…' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-content-tertiary border-t-accent" aria-hidden />
      <p className="text-sm font-medium text-content-tertiary">{label}</p>
    </div>
  )
}

export function DashboardLayout() {
  const {
    etfList, pensionList, rebalancing, totalAssets, elsListSheetData, summaryCards,
    isLoading, isLoadingAssets, isLoadingRebalancing, error, hideAmounts,
  } = useStore(
    useShallow((s) => ({
      etfList: s.etfList, pensionList: s.pensionList, rebalancing: s.rebalancing,
      totalAssets: s.totalAssets, elsListSheetData: s.elsListSheetData, summaryCards: s.summaryCards,
      isLoading: s.isLoading, isLoadingAssets: s.isLoadingAssets,
      isLoadingRebalancing: s.isLoadingRebalancing, error: s.error, hideAmounts: s.hideAmounts,
    }))
  )
  const fetchData = useStore((s) => s.fetchData)
  const clearError = useStore((s) => s.clearError)

  const [mainTab, setMainTab] = useHashTab<MainTabId>(VALID_TABS, 'home')
  const [isElsRegisterModalOpen, setIsElsRegisterModalOpen] = useState(false)
  const [redeemTarget, setRedeemTarget] = useState<ElsCardItem | null>(null)
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncToast, setSyncToast] = useState<ToastData | null>(null)

  useEffect(() => { fetchData() }, [fetchData])

  const { scrollRef, pullDistance, refreshing, handlers } = usePullToRefresh(
    useCallback(async () => { await fetchData() }, [fetchData])
  )

  const handleSyncAll = useCallback(async () => {
    if (!window.confirm('현재 자산 현황을 시트에 기록하시겠습니까?')) return
    setIsSyncingAll(true)
    try {
      await postSyncAllInvestment()
      setSyncToast({ message: '모든 데이터가 성공적으로 기록되었습니다.', tone: 'success' })
      await fetchData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '동기화에 실패했습니다.'
      setSyncToast({ message: msg, tone: 'error' })
    } finally {
      setIsSyncingAll(false)
    }
  }, [fetchData])

  const elsListManageTab = useMemo((): ElsCardItem[] => {
    if (!elsListSheetData.length) return []
    const notRedeemed = elsListSheetData.filter((row) => String(row['상태'] ?? '').trim() !== '상환완료')
    if (!notRedeemed.length) return []
    const sorted = [...notRedeemed].sort(compareElsListRowsByNextEval)
    const products = elsRowsToElsProductsWithMappings(sorted, ELS_TRY_MAPPINGS_FOR_SHEET)
    return sorted.map((row, i) => {
      const product = products[i] ?? null
      const worst = product != null ? getWorstPerformer(product) : null
      const levelFromWorst = worst != null ? 100 + worst.percentage : 0
      const currentLevel = getCurrentLevelFromRow(row, levelFromWorst)
      const kiBarrier = parseBarrierPercent(row.낙인배리어 ?? row.KI) || 70
      const redemptionBarrier = parseBarrierPercent(row.상환배리어 ?? row['다음 배리어']) || 90
      const productName = row.상품명 != null ? String(row.상품명).trim() :
        (row.증권사 ? `${row.증권사} ELS ${row.상품회차 || ''}회`.trim() : '')
      return {
        id: `els-manage-${i}`, productName: productName || '-',
        nextRedemptionDate: formatNextEarlyRedemptionWithCountdown(row),
        currentLevel, kiBarrier, redemptionBarrier,
        rowIndex: sheetRowIndexFromRow(row), joinAmount: parseJoinAmountFromElsRow(row),
      }
    })
  }, [elsListSheetData])

  const etfTableForTab = useMemo((): EtfRow[] => etfList.length ? portfolioToEtfRows(etfList) : [], [etfList])
  const pensionTableForTab = useMemo((): PensionRow[] => pensionList.length ? pensionToRows(pensionList) : [], [pensionList])
  const principalValuationTrend = useMemo(() => totalAssetsToPrincipalValuationTrend(totalAssets), [totalAssets])
  const latestSnapshot = useMemo(() => getLatestTotalAssetSnapshot(totalAssets), [totalAssets])
  const homeSummaryCards = useMemo(() => mergeSummaryWithElsProfitCard(buildSummaryCardsFromSnapshot(latestSnapshot), summaryCards), [latestSnapshot, summaryCards])
  const homePieData = useMemo(() => buildPieSegmentsFromSnapshot(latestSnapshot), [latestSnapshot])
  const rebalancingAccounts = useMemo(() => {
    if (rebalancing?.length) {
      const fromTables = rebalancingTablesToAccounts(rebalancing)
      if (fromTables.length > 0) return fromTables
    }
    return []
  }, [rebalancing])
  const insightText = useMemo(() => generateInsightText(principalValuationTrend), [principalValuationTrend])

  return (
    <div className="min-h-screen bg-surface-primary">
      <div className="relative mx-auto min-h-screen max-w-[480px] bg-surface-primary pb-20 shadow-[0_0_0_1px_var(--color-border)]">
        <div className="relative min-h-[calc(100vh-3.5rem)]">

          {mainTab === 'home' && (
            <div
              ref={scrollRef}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide"
              {...handlers}
            >
              {/* Pull to refresh indicator */}
              <div
                className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
                style={{ height: pullDistance > 0 ? pullDistance : 0 }}
                aria-hidden
              >
                <RefreshCw
                  className={`h-5 w-5 text-accent transition-transform ${refreshing ? 'animate-spin' : ''}`}
                  style={{ transform: refreshing ? undefined : `rotate(${Math.min(pullDistance * 3, 360)}deg)` }}
                />
              </div>

              <div className="flex flex-col pb-6">
                <PageHeader title="종합 자산" />
                <div className="px-4">
                  {isLoading ? (
                    <HomeSkeleton />
                  ) : error ? (
                    <div className="rounded-2xl border border-loss/20 bg-loss-bg px-4 py-6 text-sm text-loss">
                      <p className="font-medium">데이터를 불러오지 못했습니다</p>
                      <p className="mt-2 whitespace-pre-wrap text-loss/80">{error}</p>
                      <button
                        type="button"
                        onClick={() => { clearError(); fetchData() }}
                        className="mt-4 rounded-lg bg-loss px-4 py-2 text-sm font-medium text-content-inverse hover:opacity-90"
                      >
                        다시 시도
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6">
                        {homeSummaryCards?.length ? (
                          <SummaryCardsCarousel items={homeSummaryCards} hideAmounts={hideAmounts} />
                        ) : (
                          <EmptyState
                            title="요약 카드가 없습니다"
                            description="총자산 시트에서 표시할 수 있는 최신 행이 없습니다."
                          />
                        )}
                      </div>

                      {/* Smart Insight */}
                      {insightText && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="mb-4 rounded-xl bg-accent-muted px-4 py-3"
                        >
                          <p className="text-xs font-medium leading-relaxed text-accent">
                            💡 {insightText}
                          </p>
                        </motion.div>
                      )}

                      <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-content-secondary">전체 현황</h2>
                        <Suspense fallback={<LazyChunkFallback label="차트 영역을 불러오는 중…" />}>
                          <GlobalOverview
                            pieData={homePieData}
                            principalValuationTrend={principalValuationTrend}
                            totalAssetsRowCount={totalAssets.length}
                            hideAmounts={hideAmounts}
                          />
                        </Suspense>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {mainTab === 'assets' && (
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              <PageHeader title="자산 상세" />
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
                <Suspense fallback={<LazyChunkFallback label="자산 상세를 불러오는 중…" />}>
                  <AssetDetailsTabs
                    etfTable={etfTableForTab}
                    pensionTable={pensionTableForTab}
                    elsItems={elsListManageTab}
                    isLoading={isLoading || isLoadingAssets}
                    hideAmounts={hideAmounts}
                    onElsRegister={() => setIsElsRegisterModalOpen(true)}
                    onElsRedeem={(item) => { if (item.rowIndex != null) setRedeemTarget(item) }}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {mainTab === 'rebalancing' && (
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              <Suspense fallback={<LazyChunkFallback label="리밸런싱을 불러오는 중…" />}>
                <RebalancingActionCenter
                  accounts={rebalancingAccounts}
                  isLoading={isLoading || isLoadingRebalancing}
                  compact
                  hideAmounts={hideAmounts}
                />
              </Suspense>
            </div>
          )}
        </div>

        {isElsRegisterModalOpen && (
          <Suspense fallback={null}>
            <ElsRegisterModal open onClose={() => setIsElsRegisterModalOpen(false)} onSuccess={() => { void fetchData() }} />
          </Suspense>
        )}

        {redeemTarget != null && redeemTarget.rowIndex != null && (
          <Suspense fallback={null}>
            <ElsRedeemModal
              open onClose={() => setRedeemTarget(null)}
              rowIndex={redeemTarget.rowIndex} productName={redeemTarget.productName}
              defaultRedeemAmount={redeemTarget.joinAmount}
              onSuccess={() => { void fetchData() }}
            />
          </Suspense>
        )}
      </div>

      <Toast toast={syncToast} onDismiss={() => setSyncToast(null)} />

      {/* FAB — 자산 정산 기록 */}
      <motion.button
        type="button"
        aria-label="자산 정산 기록"
        disabled={isSyncingAll}
        onClick={handleSyncAll}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-[5rem] right-[max(calc((100vw-480px)/2+1rem),1rem)] z-50 flex h-12 w-12 items-center justify-center rounded-full bg-accent shadow-glass transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {isSyncingAll ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : (
          <Calculator className="h-5 w-5 text-white" strokeWidth={2} />
        )}
      </motion.button>

      <BottomNav current={mainTab} onSelect={setMainTab} />
    </div>
  )
}
