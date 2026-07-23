import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { PageHeader } from '../ui/PageHeader';
import { formatWonDigits } from '../../utils/maskSensitiveAmount';
import { rebalancingTablesToAccounts } from '../../utils/rebalancingTablesToAccounts';
import {
  Bot,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Briefcase,
  Send,
  Loader2,
  Info,
  PieChart,
} from 'lucide-react';
import {
  generateAiRebalancingPlan,
  type AiRebalancingResponse,
  type AccountHoldingInput,
} from '../../services/aiRebalancingService';

/** 지정된 8개 핵심 계좌 선택 목록 */
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

const QUICK_PROMPTS = [
  { label: '🇺🇸 미국 이주 대비 (PFIC 피하기)', text: '미국 이주를 대비해 국내 ETF/ELS 비중을 낮추고 미국 직투 달러 자산 비중을 60% 이상으로 확대해 줘.' },
  { label: '💸 배당 강화 (60%)', text: '월 배당 현금 흐름을 극대화하기 위해 배당 성향이 높은 종목 비중을 60%로 확대해 줘.' },
  { label: '🛡️ 안전 자산 확대', text: '하방 리스크를 줄이기 위해 채권 및 안전 자산 비중을 30% 이상 확보해 줘.' },
  { label: '💰 현금 20% 확보', text: '수익이 발생한 종목을 일부 매도하여 현금 비중 20%를 확보해 줘.' },
];

/** 계좌명 매핑 함수 (Fuzzy 매칭) */
function mapNameToTargetAccount(rawName: string): TargetAccountName | null {
  const name = rawName.trim();
  if (/^풍차\d+$/.test(name)) return null; // 자문사 위탁 풍차 제외

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
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AiRebalancingResponse | null>(null);

  // 계좌별 보유 종목 데이터 자동 매핑 (로컬 CSV + GAS 리밸런싱 테이블 데이터 연동)
  const accountHoldingsMap = useMemo(() => {
    const map: Record<TargetAccountName, AccountHoldingInput[]> = {
      ISA: [],
      ISA_정은: [],
      연금저축: [],
      연금저축_정은: [],
      해외투자: [],
      해외투자_정은: [],
      IRP_회사: [],
      IRP_개인: [],
    };

    // 1. GAS rebalancing 테이블 세부 데이터가 있는 경우 매핑
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

    // 2. etfList (로컬 CSV 또는 GAS ETF 목록) 매핑 - 해당 계좌에 세부 종목이 없는 경우에만 요약 항목 추가
    etfList.forEach((item) => {
      const name = String(item.상품명 || '').trim();
      const targetAcc = mapNameToTargetAccount(name);
      if (!targetAcc) return;

      // 이미 세부 종목들이 존재하는 계좌라면 총액 요약 항목 추가 금지 (이중 표시 방지)
      if (map[targetAcc].length > 0) return;

      const valuation = item.평가금액 || 0;
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

    // 3. pensionList 매핑 - 해당 계좌에 세부 종목이 없는 경우에만 요약 항목 추가
    pensionList.forEach((item) => {
      const name = String(item.상품명 || '').trim();
      const targetAcc = mapNameToTargetAccount(name);
      if (!targetAcc) return;

      // 이미 세부 종목들이 존재하는 계좌라면 총액 요약 항목 추가 금지 (이중 표시 방지)
      if (map[targetAcc].length > 0) return;

      const valuation = item.평가금액 || 0;
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

    // 각 계좌별 비중(%) 계산 및 목표비중 기본값 자동할당
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

  const accountTotalValuation = useMemo(
    () => currentHoldings.reduce((sum, h) => sum + h.currentValue, 0),
    [currentHoldings]
  );

  const hasHoldings = currentHoldings.length > 0;

  // AI 리밸런싱 실행 핸들러
  const handleRunAiRebalancing = async (overridePrompt?: string) => {
    const promptToUse = overridePrompt || userPrompt;
    if (!promptToUse.trim()) {
      alert('어떻게 리밸런싱하고 싶은지 채팅창에 내용을 입력해 주세요!');
      return;
    }

    if (!hasHoldings) {
      alert('선택된 계좌에 보유 종목이 없습니다. 다른 계좌를 선택해 주세요.');
      return;
    }

    setIsGenerating(true);
    try {
      const plan = await generateAiRebalancingPlan(
        selectedAccount,
        currentHoldings,
        promptToUse
      );
      setAiResult(plan);
    } catch (e) {
      alert('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="flex h-full flex-col overflow-hidden">
      <PageHeader title="AI 지능형 리밸런싱" />

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-10 scrollbar-hide">
        {/* 1. 계좌 선택 바 */}
        <div>
          <label className="mb-2 flex items-center justify-between text-xs font-semibold text-content-tertiary">
            <span className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-accent" />
              리밸런싱 대상 계좌 선택
            </span>
            <span className="text-[11px] text-content-tertiary">
              (8개 계좌 지원)
            </span>
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {TARGET_ACCOUNTS.map((accName) => {
              const isActive = selectedAccount === accName;
              const accHoldings = accountHoldingsMap[accName];
              const count = accHoldings.length;
              return (
                <button
                  key={accName}
                  type="button"
                  onClick={() => {
                    setSelectedAccount(accName);
                    setAiResult(null);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-accent text-content-inverse shadow-md shadow-accent/20 font-semibold scale-[1.02]'
                      : count === 0
                      ? 'border border-stroke/50 bg-surface-card/50 text-content-tertiary hover:bg-surface-secondary'
                      : 'border border-stroke bg-surface-card text-content-secondary hover:bg-surface-secondary'
                  }`}
                >
                  <span>{accName}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-tertiary text-content-tertiary'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 선택된 계좌의 현재 포트폴리오 요약 */}
        <div className="rounded-2xl border border-stroke bg-surface-card p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stroke pb-3">
            <div>
              <span className="text-xs font-semibold text-accent flex items-center gap-1">
                <PieChart className="h-3.5 w-3.5" /> 계좌 보유 포트폴리오
              </span>
              <h3 className="text-base font-bold text-content-primary">{selectedAccount}</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-content-tertiary">총 평가금액</span>
              <p className="text-base font-extrabold text-content-primary">
                {hasHoldings ? formatWonDigits(hideAmounts, accountTotalValuation) : '0원'}
              </p>
            </div>
          </div>

          {/* 자산 비중 프로그레스 바 시각화 */}
          {hasHoldings && (
            <div className="space-y-1.5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
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
                      key={i}
                      style={{ width: `${Math.max(h.currentWeight, 2)}%` }}
                      className={`${colors[i % colors.length]} transition-all duration-500`}
                      title={`${h.name}: 현재 ${h.currentWeight}% / 목표 ${h.targetWeight ?? 0}%`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 보유 종목 상세 목록 */}
          {hasHoldings ? (
            <div className="space-y-2 pt-1">
              {currentHoldings.map((h, i) => {
                const targetW = h.targetWeight ?? 0;
                const diff = parseFloat((h.currentWeight - targetW).toFixed(1));
                const isOver = diff > 0;
                const isMatch = Math.abs(diff) < 0.1;

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-stroke/50 bg-surface-secondary/40 p-2.5 text-xs transition-colors hover:bg-surface-secondary"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-accent" />
                      <div>
                        <p className="font-bold text-content-primary">{h.name}</p>
                        {h.quantity > 1 && (
                          <p className="text-[10px] text-content-tertiary">
                            {h.quantity.toLocaleString()}주 보유 · 현재가 {formatWonDigits(hideAmounts, h.currentPrice)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-content-primary">
                        {formatWonDigits(hideAmounts, h.currentValue)}
                      </p>

                      <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px]">
                        <span className="font-semibold text-content-secondary">
                          현재 <strong className="text-accent">{h.currentWeight}%</strong>
                        </span>
                        <span className="text-content-tertiary">/</span>
                        <span className="text-content-tertiary">
                          목표 {targetW}%
                        </span>

                        {isMatch ? (
                          <span className="rounded bg-gray-500/10 px-1.5 py-0.2 text-[10px] font-bold text-gray-500">
                            부합
                          </span>
                        ) : (
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                              isOver
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isOver ? `+${diff}%p 초과` : `${diff}%p 부족`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <Info className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-content-secondary">등록된 종목이 없습니다</p>
              <p className="text-xs text-content-tertiary leading-relaxed">
                현재 [{selectedAccount}] 계좌에 등록된 데이터가 없습니다.<br />
                portfolio.csv에 항목을 추가하거나 다른 계좌를 선택해 주세요.
              </p>
            </div>
          )}
        </div>

        {/* 3. AI 채팅 프롬프트 콘솔 */}
        <div className={`rounded-2xl border border-accent/20 bg-gradient-to-b from-accent/5 to-transparent p-4 shadow-sm ${!hasHoldings ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Bot className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-content-primary">
                AI 자산관리 프롬프트 채팅
              </h4>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" /> LLM 엔진 대기 중
            </span>
          </div>

          {/* 추천 프롬프트 칩 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setUserPrompt(qp.text);
                  handleRunAiRebalancing(qp.text);
                }}
                className="rounded-lg border border-stroke bg-surface-card px-2.5 py-1 text-[11px] font-medium text-content-secondary transition-all hover:border-accent hover:text-accent"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* 프롬프트 입력 바 */}
          <div className="relative flex items-center">
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder={`예: "${selectedAccount} 계좌의 배당 비중을 60%로 늘리고 기술주는 일부 이익 실현해 줘"`}
              rows={2}
              className="w-full resize-none rounded-xl border border-stroke bg-surface-card p-3 pr-12 text-xs text-content-primary placeholder:text-content-tertiary focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleRunAiRebalancing()}
              disabled={isGenerating || !hasHoldings}
              className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-content-inverse shadow-sm hover:opacity-90 disabled:opacity-50"
              title="AI 리밸런싱 실행"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 4. AI 리밸런싱 결과 보고서 */}
        <AnimatePresence>
          {aiResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4"
            >
              {/* AI 총평 */}
              <div className="border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-4 w-4" /> AI 자문전략 리포트
                </div>
                <p className="mt-1 text-xs font-semibold text-content-primary">{aiResult.summary}</p>
                <p className="mt-1 text-[11px] text-content-secondary leading-relaxed">{aiResult.adviceNote}</p>
              </div>

              {/* 종목별 매수/매도 액션 리스트 */}
              <div className="space-y-2.5">
                <h5 className="text-xs font-bold text-content-secondary">종목별 AI 매수/매도 실행 가이드</h5>
                {aiResult.actions.map((act, idx) => {
                  const isBuy = act.action === 'BUY';
                  const isSell = act.action === 'SELL';
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 text-xs transition-all ${
                        isBuy
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : isSell
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          : 'border-stroke bg-surface-card text-content-secondary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              isBuy
                                ? 'bg-emerald-600 text-white'
                                : isSell
                                ? 'bg-rose-600 text-white'
                                : 'bg-gray-500 text-white'
                            }`}
                          >
                            {isBuy && <TrendingUp className="h-3 w-3" />}
                            {isSell && <TrendingDown className="h-3 w-3" />}
                            {!isBuy && !isSell && <Minus className="h-3 w-3" />}
                            {isBuy ? '매수' : isSell ? '매도' : '유지'}
                          </span>
                          <span className="font-bold text-content-primary">{act.stockName}</span>
                        </div>

                        <div className="text-right font-semibold">
                          {isBuy && `+${formatWonDigits(hideAmounts, act.amount)}`}
                          {isSell && `-${formatWonDigits(hideAmounts, act.amount)}`}
                          {!isBuy && !isSell && '변동 없음'}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-content-tertiary border-t border-stroke/40 pt-1.5">
                        <span>비중 변화: {act.currentWeight}% ➔ <strong className="text-content-primary">{act.targetWeight}%</strong></span>
                        <span className="truncate max-w-[200px]">{act.reason}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 원클릭 적용 버튼 */}
              <button
                type="button"
                onClick={() => alert(`[${selectedAccount}] AI 리밸런싱 계획이 성공적으로 가상 등록되었습니다!`)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.99]"
              >
                <CheckCircle2 className="h-4 w-4" />
                이 AI 리밸런싱 안 적용하기
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
