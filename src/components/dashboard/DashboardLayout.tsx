import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Loader2, Calculator, RefreshCw, LayoutDashboard, PieChart, Bot, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { getWorstPerformer } from '../../utils/elsWorstPerformer'
import { portfolioToEtfRows } from '../../utils/portfolioToEtf'
import { pensionToRows } from '../../utils/pensionToRows'
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
import { DataSourceToggle } from './DataSourceToggle'
import { AmountHideToggle } from './AmountHideToggle'
import { LogoutButton } from '../LogoutButton'
import { Toast, type ToastData } from '../ui/Toast'
import { postSyncAllInvestment } from '../../api/api'
import { useHashTab } from '../../hooks/useHashTab'

const GlobalOverview = lazy(() => import('./GlobalOverview').then(m => ({ default: m.GlobalOverview })))
const AssetDetailsTabs = lazy(() => import('./AssetDetailsTabs').then(m => ({ default: m.AssetDetailsTabs })))
const RebalancingActionCenter = lazy(() => import('./RebalancingActionCenter').then(m => ({ default: m.RebalancingActionCenter })))
const ElsRegisterModal = lazy(() => import('./ElsRegisterModal').then(m => ({ default: m.ElsRegisterModal })))
const ElsRedeemModal = lazy(() => import('./ElsRedeemModal').then(m => ({ default: m.ElsRedeemModal })))

const VALID_TABS = ['home', 'assets', 'rebalancing'] as const
type MainTabId = (typeof VALID_TABS)[number]

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
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 py-16">
      <div className="h-9 w-9 animate-spin rounded-full border-3 border-content-tertiary border-t-accent" aria-hidden />
      <p className="text-sm font-semibold text-content-tertiary">{label}</p>
    </div>
  )
}

export function DashboardLayout() {
  const {
    etfList, pensionList, totalAssets, elsListSheetData, summaryCards,
    isLoading, isLoadingAssets, hideAmounts,
  } = useStore(
    useShallow((s) => ({
      etfList: s.etfList, pensionList: s.pensionList,
      totalAssets: s.totalAssets, elsListSheetData: s.elsListSheetData, summaryCards: s.summaryCards,
      isLoading: s.isLoading, isLoadingAssets: s.isLoadingAssets,
      hideAmounts: s.hideAmounts,
    }))
  )
  const fetchData = useStore((s) => s.fetchData)

  const [mainTab, setMainTab] = useHashTab<MainTabId>(VALID_TABS, 'home')
  const [isElsRegisterModalOpen, setIsElsRegisterModalOpen] = useState(false)
  const [redeemTarget, setRedeemTarget] = useState<ElsCardItem | null>(null)
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncToast, setSyncToast] = useState<ToastData | null>(null)

  useEffect(() => { fetchData() }, [fetchData])

  const handleSyncAll = useCallback(async () => {
    if (!window.confirm('현재 자산 현황을 시트에 정산 완료 기록하시겠습니까?')) return
    setIsSyncingAll(true)
    setSyncToast({ message: '자산 기록 중…', tone: 'success' })
    try {
      await postSyncAllInvestment()
      setSyncToast({ message: '정산 성공적 완료', tone: 'success' })
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
  const insightText = useMemo(() => generateInsightText(principalValuationTrend), [principalValuationTrend])

  const navItems = [
    { id: 'home' as const, label: '종합 대시보드', icon: LayoutDashboard },
    { id: 'assets' as const, label: '자산 상세', icon: PieChart },
    { id: 'rebalancing' as const, label: 'AI 지능형 리밸런싱', icon: Bot },
  ]

  return (
    <div className="min-h-screen bg-surface-primary text-content-primary">
      {/* 1. Desktop Top Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-stroke bg-surface-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3.5">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-md shadow-accent/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-content-primary">
                Asset Flow <span className="text-accent font-semibold">Desktop</span>
              </h1>
              <p className="text-[11px] font-medium text-content-tertiary">스마트 자산 관리 & AI 리밸런싱</p>
            </div>
          </div>

          {/* Desktop Center Navigation Tabs */}
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

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {mainTab === 'home' && (
              <button
                type="button"
                disabled={isSyncingAll}
                onClick={handleSyncAll}
                className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition-all hover:bg-accent hover:text-white disabled:opacity-50"
                title="자산 현황 월결산 정산 기록"
              >
                {isSyncingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
                <span>월결산 기록</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void fetchData()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-stroke bg-surface-card text-content-secondary transition-colors hover:bg-surface-secondary hover:text-content-primary"
              title="데이터 새로고침"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <DataSourceToggle />
            <AmountHideToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* 2. Main Desktop Content Area */}
      <main className="mx-auto max-w-[1440px] px-6 py-6">
        {mainTab === 'home' && (
          <Suspense fallback={<LazyChunkFallback label="대시보드를 불러오는 중…" />}>
            <GlobalOverview
              cards={homeSummaryCards}
              pieData={homePieData}
              principalValuationTrend={principalValuationTrend}
              insightText={insightText || undefined}
              elsManageTabItems={elsListManageTab}
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
              elsItems={elsListManageTab}
              isLoading={isLoading || isLoadingAssets}
              hideAmounts={hideAmounts}
              onElsRegister={() => setIsElsRegisterModalOpen(true)}
              onElsRedeem={(item) => { if (item.rowIndex != null) setRedeemTarget(item) }}
            />
          </Suspense>
        )}

        {mainTab === 'rebalancing' && (
          <Suspense fallback={<LazyChunkFallback label="AI 리밸런싱을 불러오는 중…" />}>
            <RebalancingActionCenter hideAmounts={hideAmounts} />
          </Suspense>
        )}
      </main>

      {/* Modals & Toast */}
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

      <Toast toast={syncToast} onDismiss={() => setSyncToast(null)} />
    </div>
  )
}
