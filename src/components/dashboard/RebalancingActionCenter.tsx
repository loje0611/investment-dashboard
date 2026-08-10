import { useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { formatWonDigits } from '../../utils/maskSensitiveAmount';
import { rebalancingTablesToAccounts } from '../../utils/rebalancingTablesToAccounts';
import {
  computePureRebalancing,
  computeAdditionalBuyRebalancing,
  type RebalancingHoldingInput,
  type RebalancingActionResult,
} from '../../utils/rebalancingCalc';
import { HoldingEditModal } from './HoldingEditModal';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Briefcase,
  Info,
  PieChart,
  Edit3,
  Scale,
  Wallet,
} from 'lucide-react';

const TARGET_ACCOUNTS = [
  'ISA',
  'ISA_정은',
  '연금저축',
  '연금저축_정은',
  '해외투자',
  '해외투자_정은',
  'IRP_회사',
  'IRP_개인',
] as const;

type TargetAccountName = (typeof TARGET_ACCOUNTS)[number];
type RebalancingMode = 'pure' | 'additional';

function mapNameToTargetAccount(rawName: string): TargetAccountName | null {
  const name = rawName.trim();
  if (/^풍차\d+$/.test(name)) return null;

  if (name.includes('ISA_정은') || name.includes('ISA (정은)')) return 'ISA_정은';
  if (name.includes('ISA')) return 'ISA';

  if (name.includes('해외투자_정은') || name.includes('해외 (정은)')) return '해외투자_정은';
  if (name.includes('해외투자') || name.includes('해외')) return '해외투자';

  if (name.includes('연금저축_정은') || name.includes('연금저축 (정은)')) return '연금저축_정은';
  if (name.includes('연금저축')) return '연금저축';

  if (name.includes('퇴직') || name.includes('IRP_회사') || name.includes('IRP (회사)')) return 'IRP_회사';
  if (name.includes('개인연금') || name.includes('IRP_개인') || name.includes('IRP (개인)') || name.includes('IRP')) return 'IRP_개인';

  return null;
}

function ActionBadge({ action }: { action: RebalancingActionResult['action'] }) {
  const isBuy = action === 'BUY';
  const isSell = action === 'SELL';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black ${
        isBuy
          ? 'bg-emerald-600 text-white'
          : isSell
          ? 'bg-rose-600 text-white'
          : 'bg-gray-500/20 text-content-tertiary'
      }`}
    >
      {isBuy && <TrendingUp className="h-3 w-3" />}
      {isSell && <TrendingDown className="h-3 w-3" />}
      {!isBuy && !isSell && <Minus className="h-3 w-3" />}
      {isBuy ? '매수' : isSell ? '매도' : '유지'}
    </span>
  );
}

function formatActionDetail(
  action: RebalancingActionResult,
  hideAmounts: boolean
): string {
  if (action.action === 'HOLD' || action.amount <= 0) return '조정 불필요';

  const amountStr = formatWonDigits(hideAmounts, action.amount);
  if (action.shares > 0) {
    return `${action.shares.toLocaleString()}주 (${amountStr})`;
  }
  return amountStr;
}

export interface RebalancingActionCenterProps {
  hideAmounts?: boolean;
}

export function RebalancingActionCenter({ hideAmounts: hideAmountsProp }: RebalancingActionCenterProps) {
  const { etfList, pensionList, rebalancing, hideAmountsStore } = useStore(
    useShallow((s) => ({
      etfList: s.etfList,
      pensionList: s.pensionList,
      rebalancing: s.rebalancing,
      hideAmountsStore: s.hideAmounts,
    }))
  );

  const hideAmounts = hideAmountsProp ?? hideAmountsStore;

  const [selectedAccount, setSelectedAccount] = useState<TargetAccountName>('ISA');
  const [rebalancingMode, setRebalancingMode] = useState<RebalancingMode>('pure');
  const [additionalCashInput, setAdditionalCashInput] = useState<string>('');

  const [editModalState, setEditModalState] = useState<{
    open: boolean;
    stockName: string;
    quantity: number;
    price: number;
  }>({
    open: false,
    stockName: '',
    quantity: 0,
    price: 0,
  });

  const accountHoldingsMap = useMemo(() => {
    const map: Record<TargetAccountName, RebalancingHoldingInput[]> = {
      ISA: [],
      ISA_정은: [],
      연금저축: [],
      연금저축_정은: [],
      해외투자: [],
      해외투자_정은: [],
      IRP_회사: [],
      IRP_개인: [],
    };

    const accountsFromTables = rebalancingTablesToAccounts(rebalancing || []);
    accountsFromTables.forEach((acc) => {
      const targetAcc = mapNameToTargetAccount(acc.label);
      if (targetAcc && acc.holdings?.length > 0) {
        acc.holdings.forEach((h) => {
          map[targetAcc].push({
            name: h.name,
            currentPrice: h.currentPrice,
            quantity: h.quantity,
            currentValue: h.currentValue,
            currentWeight: h.currentWeight,
            targetWeight: h.targetWeight,
          });
        });
      }
    });

    etfList.forEach((item) => {
      const name = String(item.상품명 || '').trim();
      const targetAcc = mapNameToTargetAccount(name);
      if (!targetAcc || map[targetAcc].length > 0) return;

      const valuation = Number(item.평가금액) || 0;
      if (valuation > 0) {
        map[targetAcc].push({
          name,
          currentPrice: valuation,
          quantity: 1,
          currentValue: valuation,
          currentWeight: 0,
          targetWeight: 100,
        });
      }
    });

    pensionList.forEach((item) => {
      const name = String(item.상품명 || '').trim();
      const targetAcc = mapNameToTargetAccount(name);
      if (!targetAcc || map[targetAcc].length > 0) return;

      const valuation = Number(item.평가금액) || 0;
      if (valuation > 0) {
        map[targetAcc].push({
          name,
          currentPrice: valuation,
          quantity: 1,
          currentValue: valuation,
          currentWeight: 0,
          targetWeight: 100,
        });
      }
    });

    (Object.keys(map) as TargetAccountName[]).forEach((accKey) => {
      const holdings = map[accKey];
      const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const equalTarget = holdings.length > 0 ? parseFloat((100 / holdings.length).toFixed(1)) : 100;

      holdings.forEach((h) => {
        h.currentWeight = total > 0 ? parseFloat(((h.currentValue / total) * 100).toFixed(1)) : 0;
        if (h.targetWeight == null || h.targetWeight <= 0) {
          h.targetWeight = equalTarget;
        }
      });
    });

    return map;
  }, [etfList, pensionList, rebalancing]);

  const currentHoldings = useMemo(
    () => accountHoldingsMap[selectedAccount] || [],
    [accountHoldingsMap, selectedAccount]
  );

  const additionalCash = useMemo(() => {
    const n = parseInt(additionalCashInput.replace(/,/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [additionalCashInput]);

  const actionResults = useMemo((): RebalancingActionResult[] => {
    if (!currentHoldings.length) return [];

    if (rebalancingMode === 'pure') {
      return computePureRebalancing(currentHoldings);
    }
    return computeAdditionalBuyRebalancing(currentHoldings, additionalCash);
  }, [currentHoldings, rebalancingMode, additionalCash]);

  const actionByName = useMemo(() => {
    const map = new Map<string, RebalancingActionResult>();
    actionResults.forEach((r) => map.set(r.stockName, r));
    return map;
  }, [actionResults]);

  const accountTotalValuation = useMemo(
    () => currentHoldings.reduce((sum, h) => sum + h.currentValue, 0),
    [currentHoldings]
  );

  const hasHoldings = currentHoldings.length > 0;

  return (
    <section className="flex flex-col gap-6">
      {/* 계좌 선택 */}
      <div>
        <label className="mb-2.5 flex items-center justify-between text-sm font-bold text-content-secondary">
          <span className="flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-accent" />
            리밸런싱 대상 계좌 선택
          </span>
          <span className="text-xs font-semibold text-content-tertiary">(8개 핵심 계좌)</span>
        </label>
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
          {TARGET_ACCOUNTS.map((accName) => {
            const isActive = selectedAccount === accName;
            const count = accountHoldingsMap[accName].length;
            return (
              <button
                key={accName}
                type="button"
                onClick={() => setSelectedAccount(accName)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-accent text-content-inverse shadow-md shadow-accent/20 font-black scale-[1.02]'
                    : count === 0
                    ? 'border border-stroke/50 bg-surface-card/50 text-content-tertiary hover:bg-surface-secondary'
                    : 'border border-stroke bg-surface-card text-content-secondary hover:bg-surface-secondary'
                }`}
              >
                <span>{accName}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-surface-tertiary text-content-tertiary'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 리밸런싱 방식 선택 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 rounded-2xl border border-stroke bg-surface-secondary/60 p-1.5">
          <button
            type="button"
            onClick={() => setRebalancingMode('pure')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              rebalancingMode === 'pure'
                ? 'bg-accent text-white shadow-sm'
                : 'text-content-secondary hover:bg-surface-card'
            }`}
          >
            <Scale className="h-4 w-4" />
            순수 리밸런싱
          </button>
          <button
            type="button"
            onClick={() => setRebalancingMode('additional')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              rebalancingMode === 'additional'
                ? 'bg-accent text-white shadow-sm'
                : 'text-content-secondary hover:bg-surface-card'
            }`}
          >
            <Wallet className="h-4 w-4" />
            추가 매수 리밸런싱
          </button>
        </div>

        {rebalancingMode === 'additional' && (
          <div className="flex items-center gap-2">
            <label htmlFor="additional-cash" className="shrink-0 text-xs font-bold text-content-secondary">
              추가 투입 금액
            </label>
            <input
              id="additional-cash"
              type="text"
              inputMode="numeric"
              value={additionalCashInput}
              onChange={(e) => setAdditionalCashInput(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="예: 1000000"
              className="w-full max-w-[200px] rounded-xl border border-stroke bg-surface-card px-3 py-2 text-sm font-bold text-content-primary placeholder:text-content-tertiary focus:border-accent focus:outline-none sm:w-44"
            />
            <span className="text-xs font-semibold text-content-tertiary">원</span>
          </div>
        )}
      </div>

      {rebalancingMode === 'additional' && additionalCash <= 0 && hasHoldings && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          추가 투입 금액을 입력하면 목표 비중에 맞춘 매수 수량이 계산됩니다. (매도 제안 없음)
        </p>
      )}

      {/* 계좌 포트폴리오 + 종목 카드 */}
      <div className="rounded-2xl border border-stroke bg-surface-card p-6 shadow-glass-sm">
        <div className="mb-4 flex items-center justify-between border-b border-stroke pb-3.5">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-accent">
              <PieChart className="h-4 w-4" /> 계좌 보유 포트폴리오
            </span>
            <h3 className="mt-0.5 text-xl font-black text-content-primary">{selectedAccount}</h3>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-content-tertiary">총 평가금액</span>
            <p className="mt-0.5 text-xl font-black text-content-primary">
              {hasHoldings ? formatWonDigits(hideAmounts, accountTotalValuation) : '0원'}
            </p>
          </div>
        </div>

        {hasHoldings && (
          <div className="mb-4">
            <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
              {currentHoldings.map((h, i) => {
                const colors = [
                  'bg-indigo-500',
                  'bg-emerald-500',
                  'bg-amber-500',
                  'bg-sky-500',
                  'bg-rose-500',
                  'bg-violet-500',
                ];
                return (
                  <div
                    key={h.name}
                    style={{ width: `${Math.max(h.currentWeight, 2)}%` }}
                    className={`${colors[i % colors.length]} transition-all duration-500`}
                    title={`${h.name}: 현재 ${h.currentWeight}% / 목표 ${h.targetWeight}%`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {hasHoldings ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {currentHoldings.map((h) => {
              const targetW = h.targetWeight ?? 0;
              const diff = parseFloat((h.currentWeight - targetW).toFixed(1));
              const isOver = diff > 0;
              const isMatch = Math.abs(diff) < 0.1;
              const action = actionByName.get(h.name);

              return (
                <div
                  key={h.name}
                  className="flex flex-col gap-3 rounded-xl border border-stroke/50 bg-surface-secondary/40 p-4 transition-colors hover:bg-surface-secondary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-base text-content-primary">{h.name}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setEditModalState({
                              open: true,
                              stockName: h.name,
                              quantity: h.quantity,
                              price: h.currentPrice,
                            })
                          }
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-tertiary text-content-tertiary transition-colors hover:bg-accent hover:text-white"
                          title="보유 주수 및 단가 수정"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {h.quantity > 1 && (
                        <p className="mt-0.5 text-xs font-semibold text-content-tertiary">
                          {h.quantity.toLocaleString()}주 · 현재가 {formatWonDigits(hideAmounts, h.currentPrice)}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-extrabold text-base text-content-primary">
                      {formatWonDigits(hideAmounts, h.currentValue)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="text-content-secondary">
                      현재 <strong className="text-accent">{h.currentWeight}%</strong>
                    </span>
                    <span className="text-content-tertiary">/</span>
                    <span className="text-content-tertiary">목표 {targetW}%</span>
                    {isMatch ? (
                      <span className="rounded bg-gray-500/10 px-2 py-0.5 text-gray-500">부합</span>
                    ) : (
                      <span
                        className={`rounded px-2 py-0.5 ${
                          isOver
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isOver ? `+${diff}%p 초과` : `${diff}%p 부족`}
                      </span>
                    )}
                  </div>

                  {action && (
                    <div
                      className={`rounded-lg border px-3 py-2.5 ${
                        action.action === 'BUY'
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : action.action === 'SELL'
                          ? 'border-rose-500/30 bg-rose-500/10'
                          : 'border-stroke/50 bg-surface-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <ActionBadge action={action.action} />
                        <span
                          className={`text-sm font-extrabold tabular-nums ${
                            action.action === 'BUY'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : action.action === 'SELL'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-content-tertiary'
                          }`}
                        >
                          {action.action === 'BUY' && '+'}
                          {action.action === 'SELL' && '-'}
                          {formatActionDetail(action, hideAmounts)}
                        </span>
                      </div>
                      {action.action !== 'HOLD' && (
                        <p className="mt-1.5 text-[11px] font-semibold text-content-tertiary">
                          반영 후 예상 비중: {action.projectedWeight}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Info className="h-6 w-6 text-amber-500" />
            </div>
            <p className="text-base font-bold text-content-secondary">등록된 종목이 없습니다</p>
            <p className="text-xs leading-relaxed text-content-tertiary">
              현재 [{selectedAccount}] 계좌에 등록된 데이터가 없습니다.
            </p>
          </div>
        )}
      </div>

      <HoldingEditModal
        open={editModalState.open}
        onClose={() => setEditModalState((s) => ({ ...s, open: false }))}
        accountLabel={selectedAccount}
        stockName={editModalState.stockName}
        initialQuantity={editModalState.quantity}
        initialPrice={editModalState.price}
      />
    </section>
  );
}
