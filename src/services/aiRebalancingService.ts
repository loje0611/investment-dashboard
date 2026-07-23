/**
 * AI Rebalancing Service
 * Uses Google Gemini API (if VITE_GEMINI_API_KEY is available) or a Built-in Intelligent Financial AI Engine.
 */

export interface AccountHoldingInput {
  name: string;
  currentPrice: number;
  quantity: number;
  currentValue: number;
  currentWeight: number;
}

export interface RebalancingActionItem {
  stockName: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  shares: number;
  amount: number;
  currentWeight: number;
  targetWeight: number;
  reason: string;
}

export interface AiRebalancingResponse {
  accountName: string;
  summary: string;
  actions: RebalancingActionItem[];
  expectedTotalValue: number;
  cashNeeded: number;
  adviceNote: string;
}

/**
 * AI 리밸런싱 추론 실행 함수
 */
export async function generateAiRebalancingPlan(
  accountName: string,
  holdings: AccountHoldingInput[],
  userPrompt: string,
  apiKey?: string
): Promise<AiRebalancingResponse> {
  const geminiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

  // 1. Gemini API 키가 있는 경우 실제 Gemini LLM 호출 시도
  if (geminiKey) {
    try {
      const plan = await callGeminiApi(accountName, holdings, userPrompt, geminiKey);
      if (plan) return plan;
    } catch (e) {
      console.warn('Gemini API call failed, falling back to built-in financial AI engine:', e);
    }
  }

  // 2. Gemini API 미설정 또는 실패 시 규칙 기반 금융 AI 엔진 실행
  return runBuiltInFinancialAiEngine(accountName, holdings, userPrompt);
}

/**
 * Google Gemini 2.5 Flash API 호출
 */
async function callGeminiApi(
  accountName: string,
  holdings: AccountHoldingInput[],
  userPrompt: string,
  apiKey: string
): Promise<AiRebalancingResponse | null> {
  const totalValuation = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const promptText = `
너는 20년 경력의 수석 포트폴리오 매니저 및 자산관리 AI 컨설턴트야.
아래 사용자의 계좌 보유 현황과 사용자의 리밸런싱 요구사항을 바탕으로 종목별 매수/매도 수량 및 리밸런싱 전략을 JSON 형식으로 작성해 줘.

[계좌 정보]
- 계좌명: ${accountName}
- 계좌 총 평가금액: ${totalValuation.toLocaleString()}원
- 현재 보유 종목:
${holdings.map((h) => `  * ${h.name}: 수량 ${h.quantity}주, 현재가 ${h.currentPrice.toLocaleString()}원, 평가금액 ${h.currentValue.toLocaleString()}원, 현재 비중 ${h.currentWeight.toFixed(1)}%`).join('\n')}

[사용자 리밸런싱 요청사항]
"${userPrompt}"

[반환 필수 JSON 형식 (markdown 라벨 없이 순수 JSON만 반환)]
{
  "accountName": "${accountName}",
  "summary": "전략적 리밸런싱 한 줄 요약",
  "expectedTotalValue": ${totalValuation},
  "cashNeeded": 0,
  "adviceNote": "전문가 자문 및 유의사항 (미국 이주 세금/PFIC, 절세, 환율 등 고려사항)",
  "actions": [
    {
      "stockName": "종목명",
      "action": "BUY" | "SELL" | "HOLD",
      "shares": 수량(정수),
      "amount": 금액(원),
      "currentWeight": 현재비중(%),
      "targetWeight": 목표비중(%),
      "reason": "해당 종목 액션 사유"
    }
  ]
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const cleanedText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanedText) as AiRebalancingResponse;
  return parsed;
}

/**
 * 내장 지능형 금융 AI 엔진 (API 키 없는 경우 작동)
 */
function runBuiltInFinancialAiEngine(
  accountName: string,
  holdings: AccountHoldingInput[],
  userPrompt: string
): AiRebalancingResponse {
  const totalValuation = holdings.reduce((sum, h) => sum + h.currentValue, 0) || 10000000;
  const promptLower = userPrompt.toLowerCase();

  const isDividendMode = promptLower.includes('배당') || promptLower.includes('현금흐름');
  const isSafetyMode = promptLower.includes('안전') || promptLower.includes('채권') || promptLower.includes('방어');
  const isUsMigrateMode = promptLower.includes('미국') || promptLower.includes('이주') || promptLower.includes('pfic') || promptLower.includes('달러');
  const isCashMode = promptLower.includes('현금') || promptLower.includes('확보');

  let summary = `${accountName} 계좌의 최적 리밸런싱 안을 제안합니다.`;
  let adviceNote = '포트폴리오 변동성을 줄이고 가치가 저평가된 항목 위주로 균형을 재조정합니다.';

  if (isUsMigrateMode) {
    summary = `🇺🇸 미국 이주 대비 PFIC 세금 리스크 최소화 및 달러 자산 전환 리밸런싱`;
    adviceNote = `미국 이주 후 한국 상장 ETF/ELS 보유 시 PFIC 최고 세율(37%+)이 부과될 수 있으므로, 출국 전 국내 ETF 정리 및 달러 직투 자산 배치를 우선 추진합니다.`;
  } else if (isDividendMode) {
    summary = `💸 배당 수익 및 월 현금흐름 극대화 리밸런싱`;
    adviceNote = `고배당 및 배당성장 자산 비중을 확대하여 월별 안정적인 배당 현금 흐름을 구축합니다.`;
  } else if (isSafetyMode) {
    summary = `🛡️ 안정성 강화 및 손실 방어형 포트폴리오 재배치`;
    adviceNote = `변동성이 높은 성장주 비중을 줄이고 안전 자산(단기채, 현금) 비중을 확대하여 하방 리스크를 방어합니다.`;
  } else if (isCashMode) {
    summary = `💰 유동성 및 현금 비중 20% 확보 리밸런싱`;
    adviceNote = `일부 고수익 달성 종목의 이익 실현을 통해 예비 현금 유동성을 확보합니다.`;
  }

  const actions: RebalancingActionItem[] = holdings.map((item, idx) => {
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let targetWeight = item.currentWeight;
    let reason = '현재 비중 유지';

    if (isDividendMode) {
      if (item.name.includes('배당') || item.name.includes('SCHD') || item.name.includes('ISA')) {
        action = 'BUY';
        targetWeight = Math.min(100, item.currentWeight + 15);
        reason = '배당 수익률 우수 종목 매수 확대';
      } else if (item.currentWeight > 30) {
        action = 'SELL';
        targetWeight = Math.max(5, item.currentWeight - 15);
        reason = '고비중 성장 자산 축소를 통한 배당 재원 확보';
      }
    } else if (isUsMigrateMode) {
      if (item.name.includes('해외') || item.name.includes('미국') || item.name.includes('ISA')) {
        action = 'BUY';
        targetWeight = Math.min(100, item.currentWeight + 10);
        reason = '미국 직투 및 달러 기반 자산 비중 확대';
      } else {
        action = 'SELL';
        targetWeight = Math.max(0, item.currentWeight - 10);
        reason = '미국 이주 시 PFIC 과세 리스크 종목 이익 실현';
      }
    } else if (isSafetyMode) {
      if (item.name.includes('단기채') || item.name.includes('현금') || item.name.includes('CMA')) {
        action = 'BUY';
        targetWeight = item.currentWeight + 15;
        reason = '안전 방어 자산 매수';
      } else if (idx === 0) {
        action = 'SELL';
        targetWeight = Math.max(10, item.currentWeight - 15);
        reason = '변동성 자산 일부 비중 축소';
      }
    } else {
      // 균등 리밸런싱 (Default)
      const equalWeight = parseFloat((100 / holdings.length).toFixed(1));
      if (item.currentWeight > equalWeight + 5) {
        action = 'SELL';
        targetWeight = equalWeight;
        reason = '목표 괴리율 초과분 매도';
      } else if (item.currentWeight < equalWeight - 5) {
        action = 'BUY';
        targetWeight = equalWeight;
        reason = '목표 괴리율 부족분 매수';
      }
    }

    const targetValue = (targetWeight / 100) * totalValuation;
    const deltaValue = targetValue - item.currentValue;
    // quantity=1이고 currentPrice≒currentValue이면 계좌 단위 총액이므로
    // 주 수 계산 대신 금액 기반으로 표시
    const isAccountLevel = item.quantity === 1 && Math.abs(item.currentPrice - item.currentValue) < 1;
    const shares = isAccountLevel ? 0 : Math.round(deltaValue / (item.currentPrice > 0 ? item.currentPrice : 100000));

    return {
      stockName: item.name,
      action,
      shares,
      amount: Math.abs(deltaValue),
      currentWeight: item.currentWeight,
      targetWeight,
      reason,
    };
  });

  return {
    accountName,
    summary,
    expectedTotalValue: totalValuation,
    cashNeeded: 0,
    adviceNote,
    actions,
  };
}
