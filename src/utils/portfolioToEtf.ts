import type { SheetDataRow } from '../types/api';
import type { EtfRow } from '../data/dashboardDummy';

function toNumber(value: string | number | boolean | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, '').trim());
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** "▲37.1%", "▼5.1%" 등 수익률 문자열 파싱 */
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
    .trim();
}

/** '수익률' 열 다음부터 최대 6개 키(월별 등). 없으면 레거시: 6~11번째 키 */
function keysAfterYieldColumn(row: SheetDataRow, max: number): string[] {
  const keys = Object.keys(row);
  const idx = keys.findIndex((k) => {
    const n = normalizeHeaderKey(k);
    return n === '수익률' || n === '전체 수익률' || n === '누적 수익률';
  });
  if (idx >= 0 && idx < keys.length - 1) {
    return keys.slice(idx + 1, idx + 1 + max);
  }
  if (keys.length >= 11) return keys.slice(5, 11);
  return [];
}

/**
 * 수익률 오른쪽 월별(또는 시계열) 셀에서 스파크라인용 값 추출.
 * 퍼센트 문자열·숫자 혼재 시 parseRate로 통일.
 */
function parseSparkline(row: SheetDataRow, fallbackRate: number): number[] {
  const sixKeys = keysAfterYieldColumn(row, 6);
  if (sixKeys.length === 0) return [0, 0, 0, 0, 0, fallbackRate];

  const values = sixKeys.map((k) => parseRate(row[k]));
  const hasData = values.some((v) => v !== 0);
  if (!hasData) return [0, 0, 0, 0, 0, fallbackRate];

  while (values.length < 6) values.push(values[values.length - 1] ?? 0);
  return values.slice(0, 6);
}

function isEtfSummaryOrEmptyRow(row: SheetDataRow): boolean {
  const name =
    toString(row.상품명) ||
    toString(row.종목명) ||
    toString(row.이름) ||
    toString(row.종목) ||
    '';
  if (!name || name === '-') return true;
  return /합계|소계|^계$/i.test(name);
}

/**
 * ETF현황 시트 행 배열을 ETF 현황 탭용 EtfRow[]로 변환합니다.
 * 컬럼명: 상품명/종목명, 투자원금/원금, 평가금액/평가금, 수익률/전체 수익률 등
 */
export function portfolioToEtfRows(rows: SheetDataRow[]): EtfRow[] {
  return rows.filter((row) => !isEtfSummaryOrEmptyRow(row)).map((row, i) => {
    const name =
      toString(row.상품명) ||
      toString(row.종목명) ||
      toString(row.이름) ||
      toString(row.종목) ||
      '-';
    const principal =
      toNumber(row.투자원금) ||
      toNumber(row['투자 원금']) ||
      toNumber(row.원금) ||
      toNumber(row.매입금액) ||
      toNumber(row['매입 금액']) ||
      toNumber(row.매입가) * toNumber(row.수량) ||
      0;
    const valuation =
      toNumber(row.평가금액) ||
      toNumber(row['평가 금액']) ||
      toNumber(row.평가금) ||
      toNumber(row.현재평가) ||
      toNumber(row.평가) ||
      0;
    // 투자원금·평가금액이 있으면 항상 계산값 사용(시트 수익률 오류 방지)
    const returnRate =
      principal > 0 && valuation !== 0
        ? ((valuation - principal) / principal) * 100
        : parseRate(row.수익률) ||
          parseRate(row['전체 수익률']) ||
          parseRate(row['누적 수익률']) ||
          toNumber(row['수익률(%)']);
    const sparklineData = parseSparkline(row, returnRate);
    // sparklineData가 소수(0.37=37%)이면 100 곱한 뒤 차이 구해 %p 단위로
    const monthlyDeltas =
      sparklineData.length >= 2
        ? [
            ...sparklineData.slice(0, -1).map((v, j) =>
              Number(((v - sparklineData[j + 1]) * 100).toFixed(2))
            ),
            0,
          ].slice(0, 6)
        : [0, 0, 0, 0, 0, 0];
    return {
      id: `etf-${i}`,
      name,
      principal,
      valuation,
      returnRate,
      sparklineData,
      monthlyDeltas,
    };
  });
}
