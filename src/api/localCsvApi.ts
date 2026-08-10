import type {
  DashboardSheetResponse,
  TotalAssetRow,
  EtfSheetRow,
  PensionSheetRow,
  RebalancingTable,
  RebalancingTableRow,
} from '../types/api';

import historyCsvText from '../data/history.csv?raw';
import portfolioCsvText from '../data/portfolio.csv?raw';
import { getProductHistorySeries } from '../utils/productHistory';

/**
 * 콤마(,) 및 큰따옴표("")로 감싸진 CSV 텍스트를 파싱하는 경량 파서 (RFC 4180 준수)
 */
function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && i + 1 < line.length && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    result.push(row);
  }

  return result;
}

function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').replace(/%/g, '').replace(/원/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * 수익률 문자열을 퍼센트 단위 숫자로 변환합니다.
 */
function parseReturnRate(val: string | undefined): number {
  if (!val) return 0;
  const hasPercent = val.includes('%');
  const cleaned = val.replace(/,/g, '').replace(/%/g, '').replace(/원/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (hasPercent) return num;
  if (Math.abs(num) < 1) return num * 100;
  return num;
}

/**
 * 로컬 CSV 파일(history.csv, portfolio.csv)을 파싱하여 DashboardSheetResponse 데이터 구조로 변환합니다.
 */
export async function fetchLocalCsvDashboardData(): Promise<DashboardSheetResponse> {
  const historyRows = parseCsv(historyCsvText);
  const totalAssets: TotalAssetRow[] = [];

  if (historyRows.length > 1) {
    for (let i = 1; i < historyRows.length; i++) {
      const r = historyRows[i];
      if (r.length < 2) continue;

      const dateStr = r[0];
      const rowObj: TotalAssetRow = {
        평가일: dateStr,
        '연금 원금': parseNumber(r[1]),
        '연금 평가금': parseNumber(r[2]),
        'ETF 원금': parseNumber(r[5]),
        'ETF 평가금': parseNumber(r[6]),
        '현금 원금': parseNumber(r[7]),
        '현금 평가금': parseNumber(r[8]),
        '원금 총액': parseNumber(r[9]),
        '평가금 총액': parseNumber(r[10]),
        '원금 증감액': parseNumber(r[12]),
        '평가 증감액': parseNumber(r[13]),
        일자: dateStr,
        총자산: parseNumber(r[10]),
      };
      totalAssets.push(rowObj);
    }
  }

  const portfolioRows = parseCsv(portfolioCsvText);
  const etfList: EtfSheetRow[] = [];
  const pensionList: PensionSheetRow[] = [];
  const rebalancingAccountMap: Record<string, RebalancingTableRow[]> = {};

  if (portfolioRows.length > 1) {
    for (let i = 1; i < portfolioRows.length; i++) {
      const r = portfolioRows[i];
      if (r.length < 5) continue;

      const category = r[0];
      const name = r[1];
      const principal = parseNumber(r[3]);
      const valuation = parseNumber(r[4]);
      const returnRateStr = r[5] ?? '0%';
      const notes = r[7] ?? '';
      const quantity = parseNumber(r[8]);
      const currentPrice = parseNumber(r[9]);
      const targetWeightStr = r[10] ?? '';

      if (name.includes('합계') || name.includes('총액')) continue;
      if (category === 'ELS') continue;

      if (category === 'ETF/자문사') {
        etfList.push({
          상품명: name,
          투자원금: principal,
          평가금액: valuation,
          수익률: parseReturnRate(returnRateStr),
          비고: notes,
        });
      } else if (category === '연금') {
        pensionList.push({
          상품명: name,
          투자원금: principal,
          평가금액: valuation,
          수익률: parseReturnRate(returnRateStr),
        });
      } else if (category.startsWith('보유종목_')) {
        const accName = category.replace('보유종목_', '');
        if (!rebalancingAccountMap[accName]) {
          rebalancingAccountMap[accName] = [];
        }
        rebalancingAccountMap[accName].push({
          계좌명: accName,
          종목명: name,
          현재가: currentPrice > 0 ? currentPrice : valuation,
          보유수량: quantity > 0 ? quantity : 1,
          평가금액: valuation,
          현재비중: parseReturnRate(returnRateStr) / 100,
          목표비중: parseReturnRate(targetWeightStr) / 100,
        });
      }
    }
  }

  const rebalancing: RebalancingTable[] = Object.entries(rebalancingAccountMap).map(([accountLabel, rows]) => ({
    accountLabel,
    sheet: '포트_CSV',
    rows,
  }));

  return {
    totalAssets,
    etfList,
    pensionList,
    rebalancing,
  };
}

/**
 * 로컬 etf_history.csv / pension_history.csv에서 개별 상품의 일자별 수익률 이력을 반환합니다.
 */
export function fetchLocalProductHistory(
  productName: string,
  type: 'ETF' | 'PENSION'
): [string, number][] {
  return getProductHistorySeries(productName, type);
}
