import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EtfRow, PensionRow, ElsCardItem } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'
import { ProductHistoryModal } from './ProductHistoryModal'
import type { ProductHistoryKind } from '../../api/api'
import { ElsRiskProgressBar } from '../ElsRiskProgressBar'

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

function AssetRow({ name, principal, valuation, returnRate, hideAmounts, onTap }: {
  name: string; principal: number; valuation: number; returnRate: number; hideAmounts: boolean; onTap: () => void
}) {
  const isProfit = returnRate >= 0
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full items-center gap-3 border-b border-stroke px-1 py-3.5 text-left transition-colors hover:bg-surface-hover"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-accent">{name}</p>
        <p className="mt-0.5 text-xs tabular-nums text-content-tertiary">
          ₩{formatWonDigits(hideAmounts, principal)} → ₩{formatWonDigits(hideAmounts, valuation)}
        </p>
      </div>
      <span className={`shrink-0 text-xs font-semibold tabular-nums ${isProfit ? 'text-profit' : 'text-loss'}`}>
        {isProfit ? '▲' : '▼'} {Math.abs(returnRate).toFixed(2)}%
      </span>
    </button>
  )
}

export function AssetDetailsTabs({
  etfTable,
  pensionTable,
  elsItems,
  isLoading = false,
  hideAmounts,
  onElsRegister,
  onElsRedeem,
}: AssetDetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('etf')
  const [historyModal, setHistoryModal] = useState<{
    open: boolean; name: string; kind: ProductHistoryKind
  }>({ open: false, name: '', kind: 'ETF' })

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'etf', label: 'ETF', count: etfTable.length },
    { id: 'pension', label: '연금', count: pensionTable.length },
    { id: 'els', label: 'ELS', count: elsItems.length },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-stroke bg-surface-card">
      <ProductHistoryModal
        open={historyModal.open}
        onClose={() => setHistoryModal((s) => ({ ...s, open: false }))}
        productName={historyModal.name}
        productType={historyModal.kind}
      />

      <div className="flex shrink-0 border-b border-stroke">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                isActive ? 'text-content-primary' : 'text-content-tertiary hover:text-content-secondary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="asset-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[10px] tabular-nums ${isActive ? 'text-accent' : 'text-content-tertiary'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto scrollbar-hide p-4">
        {isLoading ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-content-tertiary border-t-accent" aria-hidden />
            <p className="text-sm font-medium text-content-tertiary">로딩 중...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'etf' && (
              <motion.div key="etf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {etfTable.length === 0 ? (
                  <p className="py-12 text-center text-sm text-content-tertiary">ETF 데이터가 없습니다.</p>
                ) : (
                  etfTable.map((row) => (
                    <AssetRow key={row.id} name={row.name} principal={row.principal} valuation={row.valuation} returnRate={row.returnRate} hideAmounts={hideAmounts} onTap={() => setHistoryModal({ open: true, name: row.name, kind: 'ETF' })} />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'pension' && (
              <motion.div key="pension" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {pensionTable.length === 0 ? (
                  <p className="py-12 text-center text-sm text-content-tertiary">연금 데이터가 없습니다.</p>
                ) : (
                  pensionTable.map((row) => (
                    <AssetRow key={row.id} name={row.name} principal={row.principal} valuation={row.valuation} returnRate={row.returnRate} hideAmounts={hideAmounts} onTap={() => setHistoryModal({ open: true, name: row.name, kind: 'PENSION' })} />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'els' && (
              <motion.div key="els" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {onElsRegister && (
                  <button
                    type="button"
                    onClick={onElsRegister}
                    className="mb-3 w-full rounded-xl border border-dashed border-accent/30 bg-accent-muted py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
                  >
                    + 상품 추가
                  </button>
                )}
                {elsItems.length === 0 ? (
                  <p className="py-12 text-center text-sm text-content-tertiary">등록된 ELS 상품이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {elsItems.map((item, i) => (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }}>
                        <button
                          type="button"
                          disabled={item.rowIndex == null}
                          onClick={() => { if (item.rowIndex != null) onElsRedeem?.(item) }}
                          className="w-full rounded-xl border border-stroke bg-surface-elevated p-4 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-content-primary">{item.productName}</p>
                            <p className="shrink-0 text-sm tabular-nums text-content-tertiary">{item.nextRedemptionDate}</p>
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
