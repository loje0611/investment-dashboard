import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EtfRow, PensionRow } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'
import { ProductHistoryModal } from './ProductHistoryModal'
import type { ProductHistoryKind } from '../../api/api'

type TabId = 'etf' | 'pension'

interface AssetDetailsTabsProps {
  etfTable: EtfRow[]
  pensionTable: PensionRow[]
  /** 상세 현황 데이터 로딩 중일 때 true */
  isLoading?: boolean
  hideAmounts: boolean
}

export function AssetDetailsTabs({
  etfTable,
  pensionTable,
  isLoading = false,
  hideAmounts,
}: AssetDetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('etf')
  const [historyModal, setHistoryModal] = useState<{
    open: boolean
    name: string
    kind: ProductHistoryKind
  }>({ open: false, name: '', kind: 'ETF' })

  const openHistory = (name: string, kind: ProductHistoryKind) => {
    setHistoryModal({ open: true, name, kind })
  }

  const closeHistory = () => {
    setHistoryModal((s) => ({ ...s, open: false }))
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'etf', label: 'ETF 현황' },
    { id: 'pension', label: '연금 현황' },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <ProductHistoryModal
        open={historyModal.open}
        onClose={closeHistory}
        productName={historyModal.name}
        productType={historyModal.kind}
      />

      {/* 상단 탭: 항상 고정 */}
      <div className="flex shrink-0 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="asset-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 상품 목록만 스크롤, 스크롤바 숨김(마우스/터치 스크롤 유지) */}
      <div className="min-h-0 flex-1 overflow-auto scrollbar-hide p-4">
        {isLoading ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden />
            <p className="text-sm font-medium">로딩 중...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'etf' && (
              <motion.div
                key="etf"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="overflow-x-hidden overflow-y-visible"
              >
                <table className="w-full table-fixed text-sm" style={{ minWidth: 0 }}>
                  <colgroup>
                    <col style={{ width: '34%' }} />
                    <col style={{ width: '33%' }} />
                    <col style={{ width: '33%' }} />
                  </colgroup>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200/50 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md">
                      <th className="pb-2 pr-2 text-center font-medium">상품명</th>
                      <th className="pb-2 pr-2 text-center font-medium">원금/평가금</th>
                      <th className="whitespace-nowrap pb-2 text-center font-medium">수익률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfTable.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 align-middle"
                      >
                        <td className="py-2 pr-2 text-center">
                          <button
                            type="button"
                            onClick={() => openHistory(row.name, 'ETF')}
                            className="font-medium text-indigo-600 underline decoration-indigo-300/70 underline-offset-2 transition-colors hover:text-indigo-800 hover:decoration-indigo-500"
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-center text-slate-700">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.principal)}
                            </span>
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.valuation)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`whitespace-nowrap py-2 tabular-nums text-xs font-medium text-center ${
                            row.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {row.returnRate >= 0 ? '▲' : '▼'} {Math.abs(row.returnRate).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}

            {activeTab === 'pension' && (
              <motion.div
                key="pension"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="overflow-x-hidden overflow-y-visible"
              >
                <table className="w-full table-fixed text-sm" style={{ minWidth: 0 }}>
                  <colgroup>
                    <col style={{ width: '34%' }} />
                    <col style={{ width: '33%' }} />
                    <col style={{ width: '33%' }} />
                  </colgroup>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200/50 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md">
                      <th className="pb-2 pr-2 text-center font-medium">상품명</th>
                      <th className="pb-2 pr-2 text-center font-medium">원금/평가금</th>
                      <th className="whitespace-nowrap pb-2 text-center font-medium">수익률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pensionTable.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 align-middle"
                      >
                        <td className="py-2 pr-2 text-center">
                          <button
                            type="button"
                            onClick={() => openHistory(row.name, 'PENSION')}
                            className="font-medium text-indigo-600 underline decoration-indigo-300/70 underline-offset-2 transition-colors hover:text-indigo-800 hover:decoration-indigo-500"
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-center text-slate-700">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.principal)}
                            </span>
                            <span className="whitespace-nowrap">
                              ₩{formatWonDigits(hideAmounts, row.valuation)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`whitespace-nowrap py-2 tabular-nums text-xs font-medium text-center ${
                            row.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {row.returnRate >= 0 ? '▲' : '▼'} {Math.abs(row.returnRate).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
