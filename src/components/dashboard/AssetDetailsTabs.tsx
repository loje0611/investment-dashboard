import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EtfRow, PensionRow, ElsCardItem } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'
import { ProductHistoryModal } from './ProductHistoryModal'
import type { ProductHistoryKind } from '../../api/api'
import { ElsRiskProgressBar } from '../ElsRiskProgressBar'
import { Sparkline } from '../ui/Sparkline'
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

function AssetCard({ name, principal, valuation, returnRate, sparkData, hideAmounts, onTap, index }: {
  name: string; principal: number; valuation: number; returnRate: number
  sparkData?: number[]; hideAmounts: boolean; onTap: () => void; index: number
}) {
  const isProfit = returnRate >= 0
  const profit = valuation - principal

  return (
    <motion.button
      type="button"
      onClick={onTap}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="w-full rounded-2xl border border-stroke bg-surface-card p-4 text-left transition-colors hover:bg-surface-hover active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-accent">{name}</p>
          <p className="mt-1.5 text-lg font-bold tabular-nums leading-snug text-content-primary">
            ₩{formatWonDigits(hideAmounts, valuation)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-xs font-semibold tabular-nums ${isProfit ? 'text-profit' : 'text-loss'}`}>
              {isProfit ? '+' : ''}{returnRate.toFixed(2)}%
            </span>
            <span className="text-[11px] tabular-nums text-content-tertiary">
              {isProfit ? '+' : ''}₩{formatWonDigits(hideAmounts, profit)}
            </span>
          </div>
        </div>
        {sparkData && sparkData.length >= 2 && (
          <div className="shrink-0 pt-1">
            <Sparkline data={sparkData} width={72} height={32} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-stroke pt-2.5">
        <span className="text-[11px] text-content-tertiary">투자원금</span>
        <span className="text-xs tabular-nums text-content-secondary">₩{formatWonDigits(hideAmounts, principal)}</span>
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

      {/* Tab Pills */}
      <div className="mb-3 flex shrink-0 gap-1.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'text-content-primary' : 'text-content-tertiary hover:text-content-secondary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="asset-tab-pill"
                  className="absolute inset-0 rounded-full border border-stroke bg-surface-card"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 text-[10px] tabular-nums ${isActive ? 'text-accent' : 'text-content-tertiary'}`}>
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto scrollbar-hide">
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
                  <div className="space-y-3">
                    {etfTable.map((row, i) => (
                      <AssetCard
                        key={row.id} name={row.name} index={i}
                        principal={row.principal} valuation={row.valuation} returnRate={row.returnRate}
                        sparkData={row.sparklineData} hideAmounts={hideAmounts}
                        onTap={() => setHistoryModal({ open: true, name: row.name, kind: 'ETF' })}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'pension' && (
              <motion.div key="pension" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {pensionTable.length === 0 ? (
                  <p className="py-16 text-center text-sm text-content-tertiary">연금 데이터가 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {pensionTable.map((row, i) => (
                      <AssetCard
                        key={row.id} name={row.name} index={i}
                        principal={row.principal} valuation={row.valuation} returnRate={row.returnRate}
                        sparkData={row.monthlyDeltas} hideAmounts={hideAmounts}
                        onTap={() => setHistoryModal({ open: true, name: row.name, kind: 'PENSION' })}
                      />
                    ))}
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
                            <p className="font-semibold text-content-primary">{item.productName}</p>
                            <p className="shrink-0 text-xs tabular-nums text-content-tertiary">{item.nextRedemptionDate}</p>
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
