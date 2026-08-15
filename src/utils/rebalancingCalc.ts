/** 리밸런싱 계산에 사용하는 보유 종목 입력 */
export interface RebalancingHoldingInput {
  name: string;
  currentPrice: number;
  quantity: number;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
}

export type RebalancingActionType = 'BUY' | 'SELL' | 'HOLD';

/** 종목별 리밸런싱 매매 가이드 결과 */
export interface RebalancingActionResult {
  stockName: string;
  action: RebalancingActionType;
  shares: number;
  amount: number;
  currentWeight: number;
  projectedWeight: number;
}

interface BuyLineItem {
  item: RebalancingHoldingInput;
  price: number;
  accountLevel: boolean;
  shares: number;
  buyAmount: number;
}

function isAccountLevelHolding(h: RebalancingHoldingInput): boolean {
  return (
    h.quantity <= 1 &&
    h.currentPrice > 0 &&
    Math.abs(h.currentPrice - h.currentValue) < 1
  );
}

function effectivePrice(h: RebalancingHoldingInput): number {
  if (h.currentPrice > 0) return h.currentPrice;
  if (h.quantity > 0 && h.currentValue > 0) return h.currentValue / h.quantity;
  return h.currentValue > 0 ? h.currentValue : 1;
}

function defaultTargetWeight(holdings: RebalancingHoldingInput[]): number {
  return holdings.length > 0 ? 100 / holdings.length : 100;
}

function targetWeightOf(item: RebalancingHoldingInput, holdings: RebalancingHoldingInput[]): number {
  return item.targetWeight > 0 ? item.targetWeight : defaultTargetWeight(holdings);
}

function holdResult(item: RebalancingHoldingInput): RebalancingActionResult {
  return {
    stockName: item.name,
    action: 'HOLD',
    shares: 0,
    amount: 0,
    currentWeight: item.currentWeight,
    projectedWeight: item.currentWeight,
  };
}

/**
 * 순수 리밸런싱: 매도·매수를 모두 포함해 CSV 목표 비중(%)에 맞추도록 수량/금액을 계산합니다.
 * 주식 수는 항상 내림(정수)이며, 금액 = 주식 수 × 현재가 입니다.
 */
export function computePureRebalancing(
  holdings: RebalancingHoldingInput[]
): RebalancingActionResult[] {
  if (!holdings.length) return [];

  const totalValuation = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (totalValuation <= 0) return holdings.map(holdResult);

  return holdings.map((item) => {
    const targetWeight = targetWeightOf(item, holdings);
    const targetValue = (targetWeight / 100) * totalValuation;
    const deltaValue = targetValue - item.currentValue;
    const price = effectivePrice(item);
    const accountLevel = isAccountLevelHolding(item);

    if (Math.abs(deltaValue) < 1) {
      return holdResult(item);
    }

    const action: RebalancingActionType = deltaValue > 0 ? 'BUY' : 'SELL';

    let shares = 0;
    let amount = 0;

    if (accountLevel) {
      amount = Math.floor(Math.abs(deltaValue));
    } else {
      shares = Math.floor(Math.abs(deltaValue) / price);
      amount = shares * price;
    }

    if (amount <= 0) {
      return holdResult(item);
    }

    const projectedValue =
      item.currentValue + (action === 'BUY' ? amount : -amount);
    const projectedWeight = parseFloat(
      ((projectedValue / totalValuation) * 100).toFixed(1)
    );

    return {
      stockName: item.name,
      action,
      shares,
      amount,
      currentWeight: item.currentWeight,
      projectedWeight,
    };
  });
}

/**
 * 잔여 예수금을 최소화하기 위해 구매 가능한 종목에 1주씩 추가 매수합니다.
 * 총 매수 금액은 addCash를 절대 초과하지 않습니다.
 */
function greedySpendRemainingCash(itemBuys: BuyLineItem[], remainingCash: number): number {
  let remaining = remainingCash;

  while (remaining > 0) {
    const candidates = itemBuys.filter(
      (ib) => !ib.accountLevel && ib.price > 0 && ib.price <= remaining
    );
    if (!candidates.length) break;

    // 남은 예수금을 최대한 소진하기 위해 구매 가능한 종목 중 단가가 높은 순으로 1주씩 추가
    candidates.sort((a, b) => b.price - a.price);
    const pick = candidates[0];
    pick.shares += 1;
    pick.buyAmount += pick.price;
    remaining -= pick.price;
  }

  return remaining;
}

/**
 * 주식 단위로 소진하지 못한 잔액을 계좌 단위(수량=1) 상품에 배분합니다.
 */
function distributeRemainderToAccountLevel(
  itemBuys: BuyLineItem[],
  holdings: RebalancingHoldingInput[],
  remaining: number
): number {
  if (remaining <= 0) return 0;

  const accountItems = itemBuys.filter((ib) => ib.accountLevel);
  if (!accountItems.length) return remaining;

  const weightSum = accountItems.reduce(
    (sum, ib) => sum + targetWeightOf(ib.item, holdings),
    0
  );

  let left = remaining;
  for (const ib of accountItems) {
    if (left <= 0) break;
    const weight = targetWeightOf(ib.item, holdings);
    const add = Math.min(left, Math.floor((weight / weightSum) * remaining));
    if (add > 0) {
      ib.buyAmount += add;
      left -= add;
    }
  }

  // 마지막 계좌 단위 상품에 잔여 1원 단위까지 흡수 (총액 상한 유지)
  if (left > 0) {
    accountItems[accountItems.length - 1].buyAmount += left;
    left = 0;
  }

  return left;
}

/**
 * 추가 매수 리밸런싱: 신규 현금만 투입하며 매도 없이 목표 비중에 맞게 매수 수량/금액을 계산합니다.
 * - 주식 수는 내림(정수)
 * - 추천 매수 금액 합계 ≤ 추가 투입 금액
 * - 잔여 예수금 최소화 (greedy + 계좌 단위 상품 잔액 배분)
 */
export function computeAdditionalBuyRebalancing(
  holdings: RebalancingHoldingInput[],
  addCash: number
): RebalancingActionResult[] {
  if (!holdings.length) return [];
  if (addCash <= 0) return holdings.map(holdResult);

  const totalValuation = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const targetWeightsSum =
    holdings.reduce((sum, h) => sum + targetWeightOf(h, holdings), 0) || 100;

  const itemBuys: BuyLineItem[] = holdings.map((item) => {
    const weight = targetWeightOf(item, holdings);
    const allocatedCash = (weight / targetWeightsSum) * addCash;
    const price = effectivePrice(item);
    const accountLevel = isAccountLevelHolding(item);

    if (accountLevel) {
      const buyAmount = Math.floor(allocatedCash);
      return { item, price, accountLevel, shares: 0, buyAmount };
    }

    const shares = Math.floor(allocatedCash / price);
    const buyAmount = shares * price;
    return { item, price, accountLevel, shares, buyAmount };
  });

  let remainingCash = addCash - itemBuys.reduce((sum, ib) => sum + ib.buyAmount, 0);
  remainingCash = greedySpendRemainingCash(itemBuys, remainingCash);
  distributeRemainderToAccountLevel(itemBuys, holdings, remainingCash);

  const totalSpent = itemBuys.reduce((sum, ib) => sum + ib.buyAmount, 0);
  const newTotal = totalValuation + totalSpent;

  return itemBuys.map(({ item, shares, buyAmount }) => {
    const projectedWeight =
      newTotal > 0
        ? parseFloat((((item.currentValue + buyAmount) / newTotal) * 100).toFixed(1))
        : item.currentWeight;

    return {
      stockName: item.name,
      action: buyAmount > 0 ? 'BUY' : 'HOLD',
      shares,
      amount: buyAmount,
      currentWeight: item.currentWeight,
      projectedWeight,
    };
  });
}
