import type { RebalancingTableRow } from '../types/api';
import type { RebalancingAccount, RebalancingHolding } from '../data/dashboardDummy';

function toNumber(value: string | number | boolean | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(String(value).replace(/,/g, '').replace(/%/g, '').trim());
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function toString(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  return String(value).trim();
}

/** 표마다 다른 헤더명/오타를 허용: 여러 후보 키 중 첫 번째로 유효한 값 반환 */
function getByKeys<T>(
  row: RebalancingTableRow,
  keys: string[],
  parse: (v: unknown) => T,
  fallback: T
): T {
  for (const k of keys) {
    if (!(k in row)) continue;
    const v = parse(row[k]);
    if (typeof fallback === 'number') {
      if (typeof v === 'number' && !Number.isNaN(v)) return v as T;
    } else {
      if (String(v).trim() !== '') return v as T;
    }
  }
  return fallback;
}

/**
 * 키 이름이 패턴을 포함하는 컬럼 찾기.
 * 예: patterns=['종류'] → "종류", "종류(연금저축)", "종류(IRP)", "종류(해외)" 모두 매칭.
 */
function getByPattern<T>(
  row: RebalancingTableRow,
  patterns: string[],
  parse: (v: unknown) => T,
  fallback: T
): T {
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const key = keys.find(
      (k) => k === pattern || k.startsWith(pattern) || k.includes(pattern)
    );
    if (key != null && row[key] != null && row[key] !== '') {
      const v = parse(row[key]);
      if (typeof fallback === 'number') {
        if (typeof v === 'number' && !Number.isNaN(v as number)) return v;
      } else if (String(v).trim() !== '') return v;
    }
  }
  return fallback;
}

/** 종목명: 포트_API는 종목명, 그 외 종류(연금저축), 종류, 상품명 등 */
const NAME_KEYS = [
  '종목명',
  '종류',
  '상품명',
  '종목',
  'name',
  '상품',
];
const NAME_PATTERNS = ['종류', '종목명', '상품명', '종목'];

/** 현재가: 현재가격, 현재가, 현재가($) 등 */
const PRICE_KEYS = [
  '현재가격',
  '현재가',
  '가격',
  'price',
  '포트가격',
];
const PRICE_PATTERNS = ['현재가격', '현재가', '가격'];

/** 수량: 보유수량, 수량_회사+수량_개인, 보유수, 수량, 최종 수량 등 */
function getQuantity(row: RebalancingTableRow): number {
  const single = getByKeys(row, ['보유수량', '보유수', '수량', 'quantity', '최종 수량', '최종수량'], toNumber, 0);
  if (single > 0) return single;
  const byPattern = getByPattern(row, ['보유수량', '보유수', '수량'], toNumber, 0);
  if (byPattern > 0) return byPattern;
  const company = toNumber(row['수량_회사']);
  const individual = toNumber(row['수량_개인']);
  if (company !== 0 || individual !== 0) return company + individual;
  return 0;
}

/** 평가금액: 평가금액, 최종 금액, 구매금액 등 */
const VALUE_KEYS = [
  '최종 금액',
  '최종금액',
  '평가금액',
  '현재평가',
  'valuation',
];
const VALUE_PATTERNS = ['최종 금액', '최종금액', '평가금액', '구매금액'];

/** 현재 비중: 현재비율, 최초 비율 등 */
const CURRENT_WEIGHT_KEYS = [
  '현재비율',
  '현재비중',
  '비중',
  '최초 비율',
  'currentWeight',
];
const CURRENT_WEIGHT_PATTERNS = ['현재비율', '현재비중', '비중'];

/** 목표 비중: 포트비율, 최종 비율, 목표비중 등 */
const TARGET_WEIGHT_KEYS = [
  '포트비율',
  '최종 비율',
  '최종비율',
  '목표비중',
  '목표비중률',
  'targetWeight',
];
const TARGET_WEIGHT_PATTERNS = ['포트비율', '최종 비율', '목표비중'];

/**
 * GAS에서 내려온 계좌별 표(리밸런싱) 배열을 RebalancingAccount[]로 변환합니다.
 * 표마다 헤더 열 이름이 다르거나 오타(헌재가격, 포드비율 등)가 있어도 유연하게 매핑합니다.
 */
export function rebalancingTablesToAccounts(
  tables: Array<{ accountLabel: string; sheet: string; rows: RebalancingTableRow[] }>
): RebalancingAccount[] {
  if (!tables || tables.length === 0) return [];

  const accounts: RebalancingAccount[] = [];

  tables.forEach((table, tableIndex) => {
    const { accountLabel, sheet, rows } = table;
    if (!rows || rows.length === 0) return;

    const holdings: RebalancingHolding[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const nameStr =
        getByKeys(row, NAME_KEYS, toString, '') ||
        getByPattern(row, NAME_PATTERNS, toString, '');
      const name = nameStr && nameStr !== '' ? nameStr : '-';

      const currentPrice =
        getByKeys(row, PRICE_KEYS, toNumber, 0) ||
        getByPattern(row, PRICE_PATTERNS, toNumber, 0);

      const quantity = getQuantity(row);

      let currentValue =
        getByKeys(row, VALUE_KEYS, toNumber, 0) ||
        getByPattern(row, VALUE_PATTERNS, toNumber, 0);
      if (currentValue === 0 && currentPrice > 0 && quantity > 0) {
        currentValue = currentPrice * quantity;
      }

      let currentWeight =
        getByKeys(row, CURRENT_WEIGHT_KEYS, toNumber, 0) ||
        getByPattern(row, CURRENT_WEIGHT_PATTERNS, toNumber, 0);
      if (currentWeight > 1 && currentWeight <= 100) {
        /* already in % */
      } else if (currentWeight > 0 && currentWeight <= 1) {
        currentWeight = currentWeight * 100;
      }

      let targetWeight =
        getByKeys(row, TARGET_WEIGHT_KEYS, toNumber, 0) ||
        getByPattern(row, TARGET_WEIGHT_PATTERNS, toNumber, 0) ||
        currentWeight;
      if (targetWeight > 0 && targetWeight <= 1) {
        targetWeight = targetWeight * 100;
      }

      if (!name || name === '-') continue;
      if (currentPrice <= 0 && currentValue <= 0) continue;

      holdings.push({
        id: `${sheet}-${tableIndex}-${i}-${name}`,
        name,
        currentPrice,
        quantity,
        currentValue,
        currentWeight,
        targetWeight,
      });
    }

    if (holdings.length === 0) return;

    const total = holdings.reduce((s, h) => s + h.currentValue, 0);
    const holdingsWithWeight = total > 0
      ? holdings.map((h) => ({
          ...h,
          currentWeight: h.currentWeight > 0 ? h.currentWeight : (h.currentValue / total) * 100,
        }))
      : holdings;

    const sheetSuffix = sheet === '포트(Old)' ? ' (Old)' : sheet === '포트(New)' ? ' (New)' : '';
    accounts.push({
      id: `${sheet}-${tableIndex}-${String(accountLabel).replace(/\s+/g, '-')}`,
      label: `${accountLabel}${sheetSuffix}`,
      holdings: holdingsWithWeight,
    });
  });

  return accounts;
}
