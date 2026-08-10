import type { SheetDataRow } from '../types/api';
import type { EtfRow } from '../data/dashboardDummy';
import { getProductSparklineData } from './productHistory';

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
 * ETF현황 CSV 행 배열을 ETF 현황 탭용 EtfRow[]로 변환합니다.
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
    // 투자원금·평가금액이 있으면 항상 계산값 사용(수익률 오류 방지)
    const returnRate =
      principal > 0 && valuation !== 0
        ? ((valuation - principal) / principal) * 100
        : parseRate(row.수익률) ||
          parseRate(row['전체 수익률']) ||
          parseRate(row['누적 수익률']) ||
          toNumber(row['수익률(%)']);
    const sparklineData = getProductSparklineData(name, 'ETF', 6);
    const fallbackSparkline =
      sparklineData.length >= 2
        ? sparklineData
        : [0, 0, 0, 0, 0, returnRate];
    const monthlyDeltas =
      fallbackSparkline.length >= 2
        ? [
            ...fallbackSparkline.slice(0, -1).map((v, j) =>
              Number((v - fallbackSparkline[j + 1]).toFixed(2))
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
      sparklineData: fallbackSparkline,
      monthlyDeltas,
    };
  });
}
