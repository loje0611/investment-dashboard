import { useState, useMemo } from 'react'
import type { RebalancingAccount } from '../../data/dashboardDummy'
import { formatWonDigits } from '../../utils/maskSensitiveAmount'
import { AmountHideToggle } from './AmountHideToggle'
import { LogoutButton } from '../LogoutButton'

interface RebalancingActionCenterProps {
  accounts: RebalancingAccount[]
  isLoading?: boolean
  /** 모바일 전용: 여백·테두리 없이 화면에 꽉 차게 */
  compact?: boolean
  hideAmounts: boolean
}

/**
 * 추가 투자금 반영 시: 목표 금액 = (목표 비중/100) × (계좌 평가금액 + 추가 투자금)
 * 필요 금액 = 목표 금액 − 현재 보유 평가금액 → 주수 = 필요 금액 / 현재가 (반올림)
 * (추가 투자금 0이면 기존과 동일: (목표 비중 − 현재 비중) × 계좌 평가금액 / 100 / 현재가)
 */
function calcRebalancingShares(
  targetWeight: number,
  totalValuation: number,
  currentValue: number,
  currentPrice: number,
  additionalInvestment: number = 0
): number {
  if (currentPrice <= 0) return 0
  const newTotal = totalValuation + additionalInvestment
  const targetValue = (targetWeight / 100) * newTotal
  const amount = targetValue - currentValue
  return Math.round(amount / currentPrice)
}

function WeightBar({ current, target }: { current: number; target: number }) {
  const needBuy = target >= current
  const c = Math.min(100, Math.max(0, current))
  const t = Math.min(100, Math.max(0, target))

  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="flex h-full w-full">
        {needBuy ? (
          <>
            <div className="bg-slate-400" style={{ width: `${c}%` }} />
            <div className="bg-emerald-500" style={{ width: `${Math.max(0, t - c)}%` }} />
          </>
        ) : (
          <>
            <div className="bg-emerald-500" style={{ width: `${t}%` }} />
            <div className="bg-red-400" style={{ width: `${Math.max(0, c - t)}%` }} />
          </>
        )}
      </div>
    </div>
  )
}

export function RebalancingActionCenter({
  accounts,
  isLoading = false,
  compact = false,
  hideAmounts,
}: RebalancingActionCenterProps) {
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
    const s = additionalInvestment.replace(/,/g, '').trim()
    const n = parseFloat(s)
    return Number.isNaN(n) || n < 0 ? 0 : n
  }, [additionalInvestment])

  const rows = useMemo(() => {
    if (!selected?.holdings?.length) return []
    return selected.holdings.map((h) => {
      const shares = calcRebalancingShares(
        h.targetWeight,
        totalValuation,
        h.currentValue,
        h.currentPrice,
        additionalInvestmentNum
      )
      return { ...h, rebalancingShares: shares }
    })
  }, [selected?.holdings, totalValuation, additionalInvestmentNum])

  const sectionClass = compact
    ? 'flex min-h-0 flex-1 flex-col bg-white pb-6'
    : 'mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm'

  if (isLoading) {
    return (
      <section className={sectionClass}>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
          <h1 className="text-xl font-bold text-slate-900">리밸런싱</h1>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <AmountHideToggle />
            <LogoutButton />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 px-4 py-12 text-slate-500">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          <span>로딩 중...</span>
        </div>
      </section>
    )
  }

  if (!accounts.length) {
    return (
      <section className={sectionClass}>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
          <h1 className="text-xl font-bold text-slate-900">리밸런싱</h1>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <AmountHideToggle />
            <LogoutButton />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-slate-500">데이터가 없습니다.</div>
      </section>
    )
  }

  return (
    <section className={sectionClass}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold text-slate-900">리밸런싱</h1>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <AmountHideToggle />
          <LogoutButton />
        </div>
      </div>

      {/* 카드 영역: 자산 상세와 동일한 스타일, 계좌 선택 + 상품 목록 */}
      <div className="mx-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* 상단: 계좌 드롭다운 + 추가 투자금 (한 줄로 컴팩트) */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 p-4 sm:flex-nowrap">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0">계좌</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
            <span>추가 투자금</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={additionalInvestment}
              onChange={(e) => setAdditionalInvestment(e.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <span className="text-slate-500">원</span>
          </label>
        </div>

        {/* 상품 목록: 카드 안에서만 스크롤, 스크롤바 숨김(마우스/터치 스크롤 유지) */}
        <div className="min-h-0 flex-1 overflow-auto scrollbar-hide p-4 pt-2">
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 78 }} />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-200 bg-white text-slate-500">
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
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-3 pr-3">
                    <span className="font-medium text-slate-900">{row.name}</span>
                    <WeightBar current={row.currentWeight} target={row.targetWeight} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3">
                    {row.rebalancingShares > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        [추가 매수] {row.rebalancingShares}주
                      </span>
                    ) : row.rebalancingShares < 0 ? (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        [부분 매도] {Math.abs(row.rebalancingShares)}주
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        [유지]
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-slate-700">
                    ₩{formatWonDigits(hideAmounts, row.currentPrice)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-slate-700">{row.quantity}주</td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-slate-700">
                    ₩{formatWonDigits(hideAmounts, row.currentValue)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-slate-700">
                    {row.currentWeight.toFixed(1)}%
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-slate-700">
                    {row.targetWeight.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            계좌 총 평가금액: ₩{formatWonDigits(hideAmounts, totalValuation)}
            {additionalInvestmentNum > 0 && (
              <>
                {' '}
                · 추가 투자금 반영: ₩{formatWonDigits(hideAmounts, totalValuation + additionalInvestmentNum)}{' '}
                기준
              </>
            )}
            {' · '}
            리밸런싱 필요 주수 = (목표 금액 − 현재 보유 평가금액) ÷ 현재가, 목표 금액 = 목표 비중% × (계좌 평가금액 + 추가 투자금) (반올림)
          </p>
        </div>
      </div>
    </section>
  )
}
