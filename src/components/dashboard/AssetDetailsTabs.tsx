import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EtfRow, PensionRow, ElsCardItem } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'
import { ProductHistoryModal } from './ProductHistoryModal'
import type { ProductHistoryKind } from '../../api/api'
import { ElsRiskProgressBar } from '../ElsRiskProgressBar'
import { SkeletonCard } from '../ui/SkeletonCard'

type TabId = 'etf' | 'pension' | 'els'

interface AssetDetailsTabsProps {
  etfTable: EtfRow[]
  pensionTable: PensionRow[]
  elsItems: ElsCardItem[]
  isLoading?: boolean
  hideAmounts: boolean
  onElsRegister?: () => void
  onElsRedeem?: (item: ElsCardItem) => void
}

import { Edit3 } from 'lucide-react'
import { PrincipalEditModal } from './PrincipalEditModal'

function AssetCard({ name, valuation, returnRate, hideAmounts, onTap, onEdit, index }: {
  name: string; valuation: number; returnRate: number
  hideAmounts: boolean; onTap: () => void; onEdit?: () => void; index: number
}) {
  const isProfit = returnRate >= 0

  return (
    <motion.button
      type="button"
      onClick={onTap}
      aria-label={`${name} — 평가금 ${valuation.toLocaleString('ko-KR')}원, 수익률 ${returnRate.toFixed(2)}%`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative w-full rounded-2xl border border-stroke bg-surface-card p-4 text-left transition-colors hover:bg-surface-hover active:scale-[0.98]"
    >
      <div className="flex items-center justify-between">
        <p className="truncate text-sm font-semibold text-accent">{name}</p>
        {onEdit && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onEdit()
              }
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-secondary text-content-tertiary transition-colors hover:bg-accent hover:text-white"
            title="원금 수정"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-xl font-bold tabular-nums leading-snug text-content-primary">
          ₩{formatWonDigits(hideAmounts, valuation)}
        </p>
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
          isProfit ? 'bg-profit-bg text-profit' : 'bg-loss-bg text-loss'
        }`}>
          {isProfit ? '+' : ''}{Math.round(returnRate)}%
        </span>
      </div>
    </motion.button>
  )
}

export function AssetDetailsTabs({
  etfTable, pensionTable, elsItems,
  isLoading = false, hideAmounts, onElsRegister, onElsRedeem,
}: AssetDetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('etf')
  const [historyModal, setHistoryModal] = useState<{
    open: boolean; name: string; kind: ProductHistoryKind
  }>({ open: false, name: '', kind: 'ETF' })

  const [editModal, setEditModal] = useState<{
    open: boolean; name: string; principal: number
  }>({ open: false, name: '', principal: 0 })

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'etf', label: 'ETF', count: etfTable.length },
    { id: 'pension', label: '연금', count: pensionTable.length },
    { id: 'els', label: 'ELS', count: elsItems.length },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProductHistoryModal
        open={historyModal.open}
        onClose={() => setHistoryModal((s) => ({ ...s, open: false }))}
        productName={historyModal.name}
        productType={historyModal.kind}
      />

      <PrincipalEditModal
        open={editModal.open}
        onClose={() => setEditModal((s) => ({ ...s, open: false }))}
        productName={editModal.name}
        initialPrincipal={editModal.principal}
      />

      {/* Tab Pills */}
      <div className="mb-3 flex shrink-0 gap-1.5" role="tablist" aria-label="자산 유형">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent text-content-inverse shadow-sm'
                  : 'border border-stroke bg-surface-card text-content-secondary hover:bg-surface-hover'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-tertiary text-content-tertiary'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div
        className="min-h-0 flex-1 overflow-auto scrollbar-hide"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'etf' && (
              <motion.div key="etf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {etfTable.length === 0 ? (
                  <p className="py-16 text-center text-sm text-content-tertiary">ETF 데이터가 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {etfTable.map((row, i) => {
                      const calculatedPrincipal = (row.valuation > 0 && row.returnRate !== -100)
                        ? Math.round(row.valuation / (1 + row.returnRate / 100))
                        : row.valuation;
                      return (
                        <AssetCard
                          key={row.id} name={row.name} index={i}
                          valuation={row.valuation} returnRate={row.returnRate}
                          hideAmounts={hideAmounts}
                          onTap={() => setHistoryModal({ open: true, name: row.name, kind: 'ETF' })}
                          onEdit={() => setEditModal({ open: true, name: row.name, principal: calculatedPrincipal })}
                        />
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'pension' && (
              <motion.div key="pension" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {pensionTable.length === 0 ? (
                  <p className="py-16 text-center text-sm text-content-tertiary">연금 데이터가 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pensionTable.map((row, i) => {
                      const calculatedPrincipal = (row.valuation > 0 && row.returnRate !== -100)
                        ? Math.round(row.valuation / (1 + row.returnRate / 100))
                        : row.valuation;
                      return (
                        <AssetCard
                          key={row.id} name={row.name} index={i}
                          valuation={row.valuation} returnRate={row.returnRate}
                          hideAmounts={hideAmounts}
                          onTap={() => setHistoryModal({ open: true, name: row.name, kind: 'PENSION' })}
                          onEdit={() => setEditModal({ open: true, name: row.name, principal: calculatedPrincipal })}
                        />
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'els' && (
              <motion.div key="els" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {onElsRegister && (
                  <button
                    type="button"
                    onClick={onElsRegister}
                    className="mb-3 w-full rounded-2xl border border-dashed border-accent/30 bg-accent-muted py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
                  >
                    + 상품 추가
                  </button>
                )}
                {elsItems.length === 0 ? (
                  <p className="py-16 text-center text-sm text-content-tertiary">등록된 ELS 상품이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {elsItems.map((item, i) => (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }}>
                        <button
                          type="button"
                          disabled={item.rowIndex == null}
                          onClick={() => { if (item.rowIndex != null) onElsRedeem?.(item) }}
                          className="w-full rounded-2xl border border-stroke bg-surface-card p-4 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-slate-100">{item.productName}</p>
                            <p className="shrink-0 text-xs font-medium tabular-nums text-slate-300">{item.nextRedemptionDate}</p>
                          </div>
                          <div className="mt-3">
                            <ElsRiskProgressBar currentLevel={item.currentLevel} kiBarrier={item.kiBarrier} redemptionBarrier={item.redemptionBarrier} barHeight="h-3" />
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
