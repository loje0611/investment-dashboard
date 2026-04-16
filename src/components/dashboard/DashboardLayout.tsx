import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
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
import type { ElsCardItem, EtfRow, PensionRow } from '../../data/dashboardDummy'
import type { ElsRow } from '../../types/api'
import { ElsRiskProgressBar } from '../ElsRiskProgressBar'
import { SummaryCardsCarousel } from './SummaryCardsCarousel'
import { BottomNav, type MainTabId } from './BottomNav'
import { AmountHideToggle } from './AmountHideToggle'
import { LogoutButton } from '../LogoutButton'
import { FileQuestion } from 'lucide-react'
import { postSyncAllInvestment } from '../../api/api'

const GlobalOverview = lazy(() => import('./GlobalOverview').then(m => ({ default: m.GlobalOverview })))
const AssetDetailsTabs = lazy(() => import('./AssetDetailsTabs').then(m => ({ default: m.AssetDetailsTabs })))
const RebalancingActionCenter = lazy(() => import('./RebalancingActionCenter').then(m => ({ default: m.RebalancingActionCenter })))
const ElsRegisterModal = lazy(() => import('./ElsRegisterModal').then(m => ({ default: m.ElsRegisterModal })))
const ElsRedeemModal = lazy(() => import('./ElsRedeemModal').then(m => ({ default: m.ElsRedeemModal })))

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

/** lazy 탭/섹션 전용 — 전역 Suspense와 분리해 형제 UI(다른 탭·헤더)가 치환되지 않도록 함 */
function LazyChunkFallback({ label = '로딩 중…' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12 text-slate-500">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
        aria-hidden
      />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

export function DashboardLayout() {
  const {
    etfList,
    pensionList,
    rebalancing,
    totalAssets,
    elsListSheetData,
    summaryCards,
    isLoading,
    isLoadingAssets,
    isLoadingRebalancing,
    error,
    hideAmounts,
  } = useStore(
    useShallow((s) => ({
      etfList: s.etfList,
      pensionList: s.pensionList,
      rebalancing: s.rebalancing,
      totalAssets: s.totalAssets,
      elsListSheetData: s.elsListSheetData,
      summaryCards: s.summaryCards,
      isLoading: s.isLoading,
      isLoadingAssets: s.isLoadingAssets,
      isLoadingRebalancing: s.isLoadingRebalancing,
      error: s.error,
      hideAmounts: s.hideAmounts,
    }))
  )
  const fetchData = useStore((s) => s.fetchData)
  const clearError = useStore((s) => s.clearError)
  const [mainTab, setMainTab] = useState<MainTabId>('home')
  const [isElsRegisterModalOpen, setIsElsRegisterModalOpen] = useState(false)
  const [redeemTarget, setRedeemTarget] = useState<ElsCardItem | null>(null)
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncToast, setSyncToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(
    null
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!syncToast) return
    const t = window.setTimeout(() => setSyncToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [syncToast])

  const handleSyncAll = useCallback(async () => {
    if (!window.confirm('현재 자산 현황을 시트에 기록하시겠습니까?')) return
    setIsSyncingAll(true)
    try {
      await postSyncAllInvestment()
      setSyncToast({
        message: '모든 데이터가 성공적으로 기록되었습니다.',
        tone: 'success',
      })
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
    const notRedeemed = elsListSheetData.filter(
      (row) => String(row['상태'] ?? '').trim() !== '상환완료'
    )
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
    if (!etfList.length) return []
    return portfolioToEtfRows(etfList)
  }, [etfList])

  const pensionTableForTab = useMemo((): PensionRow[] => {
    if (!pensionList.length) return []
    return pensionToRows(pensionList)
  }, [pensionList])

  const principalValuationTrend = useMemo(
    () => totalAssetsToPrincipalValuationTrend(totalAssets),
    [totalAssets]
  )

  const latestSnapshot = useMemo(
    () => getLatestTotalAssetSnapshot(totalAssets),
    [totalAssets]
  )

  const homeSummaryCards = useMemo(
    () =>
      mergeSummaryWithElsProfitCard(
        buildSummaryCardsFromSnapshot(latestSnapshot),
        summaryCards
      ),
    [latestSnapshot, summaryCards]
  )

  const homePieData = useMemo(
    () => buildPieSegmentsFromSnapshot(latestSnapshot),
    [latestSnapshot]
  )

  const rebalancingAccounts = useMemo(() => {
    if (rebalancing && rebalancing.length > 0) {
      const fromTables = rebalancingTablesToAccounts(rebalancing)
      if (fromTables.length > 0) return fromTables
    }
    return []
  }, [rebalancing])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative mx-auto min-h-screen max-w-[480px] bg-slate-50 pb-20 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        <div className="relative min-h-[calc(100vh-3.5rem)]">
          {mainTab === 'home' && (
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
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
                      {homeSummaryCards && homeSummaryCards.length > 0 ? (
                        <SummaryCardsCarousel
                          items={homeSummaryCards}
                          hideAmounts={hideAmounts}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-12 text-center shadow-sm backdrop-blur-sm">
                          <FileQuestion className="mb-3 h-10 w-10 text-slate-300" strokeWidth={1} />
                          <p className="text-sm font-semibold text-slate-600">요약 카드가 없습니다</p>
                          <p className="mt-1 text-xs text-slate-400">
                            총자산 시트에서 표시할 수 있는 최신 행이 없습니다.<br />
                            총자산 14열(평가일·원금 총액·평가금 총액 등)을 확인해 주세요.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-6">
                      <h2 className="text-sm font-semibold text-slate-700">전체 현황</h2>
                      <Suspense
                        fallback={
                          <LazyChunkFallback label="차트 영역을 불러오는 중…" />
                        }
                      >
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
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
              <h1 className="text-xl font-bold text-slate-900">자산 상세</h1>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <AmountHideToggle />
                <LogoutButton />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
              <Suspense fallback={<LazyChunkFallback label="자산 상세를 불러오는 중…" />}>
                <AssetDetailsTabs
                  etfTable={etfTableForTab}
                  pensionTable={pensionTableForTab}
                  isLoading={isLoading || isLoadingAssets}
                  hideAmounts={hideAmounts}
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

          {mainTab === 'elsRegister' && (
          <div className="absolute inset-0 flex flex-col overflow-hidden bg-slate-50">
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
          )}
        </div>

        {isElsRegisterModalOpen && (
          <Suspense fallback={null}>
            <ElsRegisterModal
              open
              onClose={() => setIsElsRegisterModalOpen(false)}
              onSuccess={() => {
                void fetchData()
              }}
            />
          </Suspense>
        )}

        {redeemTarget != null && redeemTarget.rowIndex != null && (
          <Suspense fallback={null}>
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
          </Suspense>
        )}
      </div>

      {syncToast != null && (
        <div
          className="fixed bottom-[4.75rem] left-1/2 z-[60] max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 px-4"
          role="status"
        >
          <div
            className={`rounded-xl px-4 py-3 text-center text-sm font-medium shadow-lg backdrop-blur-sm ${
              syncToast.tone === 'success'
                ? 'border border-emerald-200/80 bg-emerald-50/95 text-emerald-900'
                : 'border border-rose-200/80 bg-rose-50/95 text-rose-900'
            }`}
          >
            {syncToast.message}
          </div>
        </div>
      )}

      <BottomNav
        current={mainTab}
        onSelect={setMainTab}
        isSyncing={isSyncingAll}
        onSyncAll={handleSyncAll}
      />
    </div>
  )
}
