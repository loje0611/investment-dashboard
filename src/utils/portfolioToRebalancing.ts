import type { PortfolioRow } from '../types/api';
import type { RebalancingAccount, RebalancingHolding } from '../data/dashboardDummy';

function toNumber(value: string | number | boolean | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(String(value).replace(/,/g, '').trim());
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function toString(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * 포트(New) 시트 행 배열을 리밸런싱 액션 가이드용 RebalancingAccount[]로 변환합니다.
 * 계좌별로 그룹핑하며, 컬럼명: 계좌/종목명/현재가/보유수량/평가금액/현재비중/목표비중 등.
 */
export function portfolioToRebalancingAccounts(
  rows: PortfolioRow[]
): RebalancingAccount[] {
  if (!rows.length) return [];

  const byAccount = new Map<string, RebalancingHolding[]>();
  const accountOrder: string[] = [];
  const accountLabels: Record<string, string> = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const accountKey =
      toString(row.계좌) ||
      toString(row.계좌명) ||
      toString(row.account) ||
      '전체';
    const accountLabel = accountKey;

    const name =
      toString(row.종목명) ||
      toString(row.상품명) ||
      toString(row.종목) ||
      toString(row.name) ||
      '-';
    const currentPrice =
      toNumber(row.현재가) || toNumber(row.가격) || toNumber(row.price) || 0;
    const quantity =
      toNumber(row.보유수량) ||
      toNumber(row.수량) ||
      toNumber(row.quantity) ||
      0;
    let currentValue =
      toNumber(row.평가금액) ||
      toNumber(row.현재평가) ||
      toNumber(row.valuation) ||
      0;
    if (currentValue === 0 && currentPrice > 0 && quantity > 0) {
      currentValue = currentPrice * quantity;
    }
    const currentWeight =
      toNumber(row.현재비중) ||
      toNumber(row.비중) ||
      toNumber(row.currentWeight) ||
      0;
    const targetWeight =
      toNumber(row.목표비중) ||
      toNumber(row.목표비중률) ||
      toNumber(row.targetWeight) ||
      currentWeight;

    if (!name || name === '-') continue;
    if (currentPrice <= 0 && currentValue <= 0) continue;

    if (!byAccount.has(accountKey)) {
      byAccount.set(accountKey, []);
      accountOrder.push(accountKey);
      accountLabels[accountKey] = accountLabel;
    }

    byAccount.get(accountKey)!.push({
      id: `${accountKey}-${i}-${name}`,
      name,
      currentPrice,
      quantity,
      currentValue,
      currentWeight,
      targetWeight,
    });
  }

  const accounts: RebalancingAccount[] = [];
  const hasAll = accountOrder.some((k) => k === '전체');
  if (accountOrder.length === 0) return [];

  const order = hasAll ? ['전체', ...accountOrder.filter((k) => k !== '전체')] : accountOrder;
  order.forEach((key, idx) => {
    let holdings = byAccount.get(key) ?? [];
    if (holdings.length === 0) return;
    const total = holdings.reduce((s, h) => s + h.currentValue, 0);
    if (total > 0) {
      holdings = holdings.map((h) => ({
        ...h,
        currentWeight: h.currentWeight > 0 ? h.currentWeight : (h.currentValue / total) * 100,
      }));
    }
    accounts.push({
      id: key.replace(/\s+/g, '-') || `account-${idx}`,
      label: accountLabels[key] ?? key,
      holdings,
    });
  });

  return accounts;
}
