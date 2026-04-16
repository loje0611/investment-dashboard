import { useState, useMemo } from 'react'
import type { RebalancingAccount } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'
import { PageHeader } from '../ui/PageHeader'

interface RebalancingActionCenterProps {
  accounts: RebalancingAccount[]
  isLoading?: boolean
  compact?: boolean
  hideAmounts: boolean
}

function calcRebalancingShares(
  targetWeight: number, totalValuation: number, currentValue: number,
  currentPrice: number, additionalInvestment: number = 0
): number {
  if (currentPrice <= 0) return 0
  const newTotal = totalValuation + additionalInvestment
  const targetValue = (targetWeight / 100) * newTotal
  return Math.round((targetValue - currentValue) / currentPrice)
}

function WeightBar({ current, target }: { current: number; target: number }) {
  const needBuy = target >= current
  const c = Math.min(100, Math.max(0, current))
  const t = Math.min(100, Math.max(0, target))

  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-primary">
      <div className="flex h-full w-full">
        {needBuy ? (
          <>
            <div className="bg-content-tertiary" style={{ width: `${c}%` }} />
            <div className="bg-profit" style={{ width: `${Math.max(0, t - c)}%` }} />
          </>
        ) : (
          <>
            <div className="bg-profit" style={{ width: `${t}%` }} />
            <div className="bg-loss" style={{ width: `${Math.max(0, c - t)}%` }} />
          </>
        )}
      </div>
    </div>
  )
}

export function RebalancingActionCenter({ accounts, isLoading = false, compact = false, hideAmounts }: RebalancingActionCenterProps) {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? 'all')
  const [additionalInvestment, setAdditionalInvestment] = useState<string>('')

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? accounts[0],
    [accounts, selectedId]
  )
  const totalValuation = useMemo(
    () => (selected?.holdings ?? []).reduce((s, h) => s + h.currentValue, 0),
    [selected]
  )
  const additionalInvestmentNum = useMemo(() => {
    const n = parseFloat(additionalInvestment.replace(/,/g, '').trim())
    return Number.isNaN(n) || n < 0 ? 0 : n
  }, [additionalInvestment])

  const rows = useMemo(() => {
    if (!selected?.holdings?.length) return []
    return selected.holdings.map((h) => ({
      ...h,
      rebalancingShares: calcRebalancingShares(h.targetWeight, totalValuation, h.currentValue, h.currentPrice, additionalInvestmentNum),
    }))
  }, [selected?.holdings, totalValuation, additionalInvestmentNum])

  const sectionClass = compact
    ? 'flex min-h-0 flex-1 flex-col pb-6'
    : 'mt-10 rounded-xl border border-stroke bg-surface-card p-6'

  if (isLoading) {
    return (
      <section className={sectionClass}>
        <PageHeader title="리밸런싱" />
        <div className="flex flex-1 items-center justify-center gap-2 px-4 py-12 text-content-tertiary">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-content-tertiary border-t-accent" />
          <span>로딩 중...</span>
        </div>
      </section>
    )
  }

  if (!accounts.length) {
    return (
      <section className={sectionClass}>
        <PageHeader title="리밸런싱" />
        <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-content-tertiary">데이터가 없습니다.</div>
      </section>
    )
  }

  return (
    <section className={sectionClass}>
      <PageHeader title="리밸런싱" />

      <div className="mx-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-stroke bg-surface-card">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-stroke p-4 sm:flex-nowrap">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-content-secondary">
            <span className="shrink-0">계좌</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-stroke-strong bg-surface-elevated py-2 pl-3 pr-8 text-sm text-content-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.label}</option>
              ))}
            </select>
          </label>
          <label className="flex shrink-0 items-center gap-2 text-sm text-content-secondary">
            <span>추가 투자금</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={additionalInvestment}
              onChange={(e) => setAdditionalInvestment(e.target.value)}
              className="w-28 rounded-md border border-stroke-strong bg-surface-elevated px-2 py-1.5 text-right text-sm tabular-nums text-content-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <span className="text-content-tertiary">원</span>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto scrollbar-hide p-4 pt-2">
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: '24%' }} /><col style={{ width: 105 }} /><col style={{ width: 95 }} />
              <col style={{ width: 72 }} /><col style={{ width: 110 }} /><col style={{ width: 78 }} /><col style={{ width: 78 }} />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10 border-b border-stroke bg-surface-card text-content-tertiary">
                <th className="pb-2 pr-3 text-center font-medium">종목명</th>
                <th className="pb-2 pr-3 text-center font-medium">액션</th>
                <th className="pb-2 pr-3 text-center font-medium">현재가</th>
                <th className="pb-2 pr-3 text-center font-medium">보유수량</th>
                <th className="pb-2 pr-3 text-center font-medium">평가금액</th>
                <th className="pb-2 pr-3 text-center font-medium">현재비중</th>
                <th className="pb-2 text-center font-medium">목표비중</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-stroke">
                  <td className="py-3 pr-3">
                    <span className="font-medium text-content-primary">{row.name}</span>
                    <WeightBar current={row.currentWeight} target={row.targetWeight} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3">
                    {row.rebalancingShares > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-profit-bg px-2 py-0.5 text-xs font-medium text-profit">
                        [추가 매수] {row.rebalancingShares}주
                      </span>
                    ) : row.rebalancingShares < 0 ? (
                      <span className="inline-flex items-center rounded-md bg-loss-bg px-2 py-0.5 text-xs font-medium text-loss">
                        [부분 매도] {Math.abs(row.rebalancingShares)}주
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-surface-elevated px-2 py-0.5 text-xs font-medium text-content-tertiary">
                        [유지]
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-content-secondary">₩{formatWonDigits(hideAmounts, row.currentPrice)}</td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-content-secondary">{row.quantity}주</td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-content-secondary">₩{formatWonDigits(hideAmounts, row.currentValue)}</td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-content-secondary">{row.currentWeight.toFixed(1)}%</td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-content-secondary">{row.targetWeight.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-content-tertiary">
            계좌 총 평가금액: ₩{formatWonDigits(hideAmounts, totalValuation)}
            {additionalInvestmentNum > 0 && (<> · 추가 투자금 반영: ₩{formatWonDigits(hideAmounts, totalValuation + additionalInvestmentNum)} 기준</>)}
          </p>
        </div>
      </div>
    </section>
  )
}
