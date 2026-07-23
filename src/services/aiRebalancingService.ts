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
  targetWeight?: number;
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
 * Google Gemini 1.5 Flash API 호출
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
${holdings.map((h) => `  * ${h.name}: 수량 ${h.quantity}주, 현재가 ${h.currentPrice.toLocaleString()}원, 평가금액 ${h.currentValue.toLocaleString()}원, 현재 비중 ${h.currentWeight.toFixed(1)}%, 목표 비중 ${(h.targetWeight ?? h.currentWeight).toFixed(1)}%`).join('\n')}

[사용자 리밸런싱 요청사항]
"${userPrompt}"

[특이 조건 준수 사항]
- 사용자가 "매도 금지", "매도 안 하고", "매도는 하지 않고", "추가 투입" 등을 명시한 경우 절대로 기존 보유 종목을 매도(SELL)하지 말고 매수(BUY) 또는 유지(HOLD)만 제안해 줘.
- 신규 추가 입금액이 있는 경우 해당 자금 범위 내에서 목표 비중에 따라 효율적으로 분배 매수(BUY)하는 수량(주) 및 금액(원)을 계산해 줘.

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
 * 프롬프트 텍스트에서 추가 입금액(원)을 파싱하는 함수 (한글 수사 포함)
 */
function parseAddCashFromPrompt(text: string): number {
  if (!text) return 0;
  
  // 1. 숫자 + 만원 / 만 (예: 100만원, 100만, 50만원)
  const matchDigitsMan = text.match(/(\d+)\s*만\s*원?/);
  if (matchDigitsMan) {
    return parseInt(matchDigitsMan[1], 10) * 10000;
  }

  // 2. 한글 수사 + 만원 / 만 (예: 백만원, 이백만원, 삼백만원, 천만원, 오십만원)
  const koreanNumMap: Record<string, number> = {
    오십: 50,
    백: 100,
    일백: 100,
    이백: 200,
    삼백: 300,
    사백: 400,
    오백: 500,
    육백: 600,
    칠백: 700,
    팔백: 800,
    구백: 900,
    천: 1000,
    일천: 1000,
  };

  for (const [k, v] of Object.entries(koreanNumMap)) {
    if (text.includes(`${k}만`)) {
      return v * 10000;
    }
  }

  // 3. 숫자 + 원 (예: 1000000원, 500000원)
  const matchDigitsWon = text.match(/(\d{5,})\s*원?/);
  if (matchDigitsWon) {
    return parseInt(matchDigitsWon[1], 10);
  }

  return 0;
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

  // 1. 추가 입금액 및 매도 금지 조건 파싱
  const addCash = parseAddCashFromPrompt(userPrompt);
  const isNoSellMode =
    promptLower.includes('매도 안') ||
    promptLower.includes('매도는 안') ||
    promptLower.includes('매도 금지') ||
    promptLower.includes('매도 없이') ||
    promptLower.includes('매도하지') ||
    promptLower.includes('매도 제외');

  const isDividendMode = promptLower.includes('배당') || promptLower.includes('현금흐름');
  const isSafetyMode = promptLower.includes('안전') || promptLower.includes('채권') || promptLower.includes('방어');
  const isUsMigrateMode = promptLower.includes('미국') || promptLower.includes('이주') || promptLower.includes('pfic') || promptLower.includes('달러');
  const isCashMode = promptLower.includes('현금') || promptLower.includes('확보');

  let summary = `${accountName} 계좌의 최적 리밸런싱 안을 제안합니다.`;
  let adviceNote = '포트폴리오 변동성을 줄이고 가치가 저평가된 항목 위주로 균형을 재조정합니다.';

  if (addCash > 0) {
    const noSellText = isNoSellMode ? ' (기존 종목 매도 없음)' : '';
    summary = `💰 ${addCash.toLocaleString()}원 신규 추가 매수 계획${noSellText}`;
    adviceNote = `추가 자금 ${addCash.toLocaleString()}원을 기존 자산의 목표 비중에 맞춰 최적 분배 매수합니다.`;
  } else if (isUsMigrateMode) {
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
  } else if (userPrompt.trim()) {
    summary = `🎯 사용자 입력을 반영한 전략적 리밸런싱 안 ("${userPrompt.trim()}")`;
    adviceNote = `요청하신 조건("${userPrompt.trim()}")을 반영하여 자산 비중을 재배치했습니다.`;
  }

  // 2. 추가 매수 모드(addCash > 0)일 때의 전용 분배 알고리즘
  if (addCash > 0) {
    // 각 종목별 목표비중 총합
    const targetWeightsSum = holdings.reduce((sum, h) => sum + (h.targetWeight ?? (100 / holdings.length)), 0) || 100;

    let remainingCash = addCash;
    const actions: RebalancingActionItem[] = holdings.map((item) => {
      const weight = item.targetWeight ?? (100 / holdings.length);
      const allocatedCash = (weight / targetWeightsSum) * addCash;
      const price = item.currentPrice > 0 ? item.currentPrice : item.currentValue || 100000;
      
      const isAccountLevel = item.quantity === 1 && Math.abs(item.currentPrice - item.currentValue) < 1;
      let shares = isAccountLevel ? 0 : Math.floor(allocatedCash / price);
      let buyAmount = isAccountLevel ? Math.round(allocatedCash) : shares * price;

      if (buyAmount > remainingCash) {
        buyAmount = remainingCash;
        if (!isAccountLevel && price > 0) {
          shares = Math.floor(buyAmount / price);
          buyAmount = shares * price;
        }
      }

      const action: 'BUY' | 'SELL' | 'HOLD' = buyAmount > 0 ? 'BUY' : 'HOLD';
      if (buyAmount > 0) remainingCash -= buyAmount;

      const newWeight = parseFloat((((item.currentValue + buyAmount) / (totalValuation + addCash)) * 100).toFixed(1));

      return {
        stockName: item.name,
        action,
        shares,
        amount: buyAmount,
        currentWeight: item.currentWeight,
        targetWeight: newWeight,
        reason: buyAmount > 0 ? `신규 자금 중 ${formatWonDigitsSimple(buyAmount)} 분배 매수` : '기존 비중 유지',
      };
    });

    return {
      accountName,
      summary,
      expectedTotalValue: totalValuation + addCash,
      cashNeeded: addCash,
      adviceNote: `${adviceNote} (잔여 예수금: ${remainingCash.toLocaleString()}원)`,
      actions,
    };
  }

  // 3. 일반 리밸런싱 모드 알고리즘
  const actions: RebalancingActionItem[] = holdings.map((item, idx) => {
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let targetWeight = item.targetWeight ?? item.currentWeight;
    let reason = '현재 비중 유지';

    if (isDividendMode) {
      if (item.name.includes('배당') || item.name.includes('SCHD') || item.name.includes('ISA')) {
        action = 'BUY';
        targetWeight = Math.min(100, item.currentWeight + 15);
        reason = '배당 수익률 우수 종목 매수 확대';
      } else if (item.currentWeight > 30 && !isNoSellMode) {
        action = 'SELL';
        targetWeight = Math.max(5, item.currentWeight - 15);
        reason = '고비중 성장 자산 축소를 통한 배당 재원 확보';
      }
    } else if (isUsMigrateMode) {
      if (item.name.includes('해외') || item.name.includes('미국') || item.name.includes('ISA')) {
        action = 'BUY';
        targetWeight = Math.min(100, item.currentWeight + 10);
        reason = '미국 직투 및 달러 기반 자산 비중 확대';
      } else if (!isNoSellMode) {
        action = 'SELL';
        targetWeight = Math.max(0, item.currentWeight - 10);
        reason = '미국 이주 시 PFIC 과세 리스크 종목 이익 실현';
      }
    } else if (isSafetyMode) {
      if (item.name.includes('단기채') || item.name.includes('현금') || item.name.includes('CMA')) {
        action = 'BUY';
        targetWeight = item.currentWeight + 15;
        reason = '안전 방어 자산 매수';
      } else if (idx === 0 && !isNoSellMode) {
        action = 'SELL';
        targetWeight = Math.max(10, item.currentWeight - 15);
        reason = '변동성 자산 일부 비중 축소';
      }
    } else {
      const equalWeight = parseFloat((100 / holdings.length).toFixed(1));
      targetWeight = item.targetWeight ?? equalWeight;
      const diff = item.currentWeight - targetWeight;

      if (diff > 2 && !isNoSellMode) {
        action = 'SELL';
        reason = `목표 비중(${targetWeight}%) 초과분 차익 실현`;
      } else if (diff < -2) {
        action = 'BUY';
        reason = `목표 비중(${targetWeight}%) 미달 매수`;
      }
    }

    // isNoSellMode 일 때 SELL 금지
    if (isNoSellMode && action === 'SELL') {
      action = 'HOLD';
      targetWeight = item.currentWeight;
      reason = '사용자 매도 금지 요청에 따라 보유 유지';
    }

    const targetValue = (targetWeight / 100) * totalValuation;
    const deltaValue = targetValue - item.currentValue;
    const price = item.currentPrice > 0 ? item.currentPrice : item.currentValue || 100000;
    const isAccountLevel = item.quantity === 1 && Math.abs(item.currentPrice - item.currentValue) < 1;
    const shares = isAccountLevel ? 0 : Math.round(Math.abs(deltaValue) / price);

    return {
      stockName: item.name,
      action,
      shares,
      amount: Math.round(Math.abs(deltaValue)),
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

function formatWonDigitsSimple(val: number): string {
  if (val >= 10000) {
    const man = Math.floor(val / 10000);
    return `${man.toLocaleString()}만 원`;
  }
  return `${val.toLocaleString()}원`;
}
