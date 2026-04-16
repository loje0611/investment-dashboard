import type { SheetDataRow } from '../types/api';
import type { PensionRow } from '../data/dashboardDummy';

function toNumber(value: string | number | boolean | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, '').trim());
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseRate(value: string | number | boolean | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const s = String(value).replace(/,/g, '').trim();
  const isNegative = s.includes('▼');
  const num = parseFloat(s.replace(/[▲▼%\s]/g, ''));
  if (Number.isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

function toString(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeHeaderKey(k: string): string {
  return k
    .replace(/\u3000/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function keysAfterYieldColumn(row: SheetDataRow, max: number): string[] {
  const keys = Object.keys(row)
  const idx = keys.findIndex((k) => {
    const n = normalizeHeaderKey(k)
    return n === '수익률' || n === '전체 수익률' || n === '누적 수익률'
  })
  if (idx >= 0 && idx < keys.length - 1) {
    return keys.slice(idx + 1, idx + 1 + max)
  }
  if (keys.length >= 11) return keys.slice(5, 11)
  return []
}

function getPensionProductLabel(row: SheetDataRow): string {
  return (
    toString(row.상품명) ||
    toString(row.종목명) ||
    toString(row.이름) ||
    ''
  );
}

/**
 * 자산 상세 > 연금 현황 테이블용: 합계·빈 행·날짜 행 제외 후 시트 순서 상위 N개만.
 */
function isPensionDetailProductRow(row: SheetDataRow): boolean {
  const n = getPensionProductLabel(row);
  if (!n || n === '-') return false;
  if (/합계|소계|^계$/i.test(n)) return false;
  if (/^날짜$/i.test(n)) return false;
  return true;
}

const PENSION_DETAIL_MAX_ROWS = 80

/** 수익률 열 오른쪽 최대 6개 셀(월별 수익률 등) */
function parseSixValues(row: SheetDataRow, fallback: number): number[] {
  const sixKeys = keysAfterYieldColumn(row, 6)
  if (sixKeys.length === 0) return [0, 0, 0, 0, 0, fallback]
  const values = sixKeys.map((k) => parseRate(row[k]))
  const hasData = values.some((v) => v !== 0)
  if (!hasData) return [0, 0, 0, 0, 0, fallback]
  while (values.length < 6) values.push(values[values.length - 1] ?? 0)
  return values.slice(0, 6)
}

/**
 * 연금 시트 행 배열을 연금 현황 탭용 PensionRow[]로 변환합니다.
 * 컬럼 구조: 상품명, 투자시점(등), 투자원금, 평가금액, 수익률, 이후 6개 월별 수익률.
 * 상품 행만 남기고(개인연금 합계·날짜·빈 행 제외) 시트 순서대로 상한까지 노출합니다.
 */
export function pensionToRows(rows: SheetDataRow[]): PensionRow[] {
  const detailRows = rows.filter(isPensionDetailProductRow).slice(0, PENSION_DETAIL_MAX_ROWS)

  return detailRows.map((row, i) => {
    const name = getPensionProductLabel(row) || '-';
    const principal =
      toNumber(row.투자원금) ||
      toNumber(row['투자 원금']) ||
      toNumber(row.원금) ||
      toNumber(row.매입금액) ||
      toNumber(row['매입 금액']) ||
      0;
    const valuation =
      toNumber(row.평가금액) ||
      toNumber(row['평가 금액']) ||
      toNumber(row.평가금) ||
      toNumber(row.현재평가) ||
      toNumber(row.평가) ||
      0;
    const returnRate =
      principal > 0 && valuation !== 0
        ? ((valuation - principal) / principal) * 100
        : parseRate(row.수익률) ||
          parseRate(row['전체 수익률']) ||
          parseRate(row['누적 수익률']) ||
          0;

    const sixValues = parseSixValues(row, returnRate / 100);
    const isDecimal = sixValues.every((x) => Math.abs(x) <= 2);
    const factor = isDecimal ? 100 : 1;
    const monthlyDeltas =
      sixValues.length >= 2
        ? [
            ...sixValues
              .slice(0, -1)
              .map((v, j) =>
                Number(((v - sixValues[j + 1]) * factor).toFixed(2))
              ),
            0,
          ].slice(0, 6)
        : [0, 0, 0, 0, 0, 0];

    return {
      id: `pension-${i}`,
      name,
      principal,
      valuation,
      returnRate,
      monthlyDeltas,
    };
  });
}
