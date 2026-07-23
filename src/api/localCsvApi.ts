import type {
  DashboardSheetResponse,
  TotalAssetRow,
  EtfSheetRow,
  PensionSheetRow,
  ElsRow,
  SheetDataRow,
  RebalancingTable,
  RebalancingTableRow,
} from '../types/api';
import type { SummaryCardItem } from '../types/dashboard';

import historyCsvText from '../data/history.csv?raw';
import portfolioCsvText from '../data/portfolio.csv?raw';

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
        // RFC 4180: "" inside a quoted field represents a literal "
        if (insideQuote && i + 1 < line.length && line[i + 1] === '"') {
          entry += '"';
          i++; // skip the second quote
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
  // 1. history.csv 파싱
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
        'ELS 원금': parseNumber(r[3]),
        'ELS 평가금': parseNumber(r[4]),
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

  // 2. portfolio.csv 파싱
  const portfolioRows = parseCsv(portfolioCsvText);
  const etfList: EtfSheetRow[] = [];
  const pensionList: PensionSheetRow[] = [];
  const elsListSheetData: ElsRow[] = [];
  const cashOther: SheetDataRow[] = [];
  const rebalancingAccountMap: Record<string, RebalancingTableRow[]> = {};

  if (portfolioRows.length > 1) {
    for (let i = 1; i < portfolioRows.length; i++) {
      const r = portfolioRows[i];
      if (r.length < 5) continue;

      const category = r[0];
      const name = r[1];
      const brokerSeries = r[2];
      const principal = parseNumber(r[3]);
      const valuation = parseNumber(r[4]);
      const returnRateStr = r[5] ?? '0%';
      const status = r[6] ?? '운용 중';
      const notes = r[7] ?? '';
      const quantity = parseNumber(r[8]);
      const currentPrice = parseNumber(r[9]);
      const targetWeightStr = r[10] ?? '';

      // Skip summary header rows
      if (name.includes('합계') || name.includes('총액')) continue;

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
      } else if (category === 'ELS') {
        const ticker1 = r[11] ?? '';
        const base1 = parseNumber(r[12]);
        const cur1 = parseNumber(r[13]);

        const ticker2 = r[14] ?? '';
        const base2 = parseNumber(r[15]);
        const cur2 = parseNumber(r[16]);

        const ticker3 = r[17] ?? '';
        const base3 = parseNumber(r[18]);
        const cur3 = parseNumber(r[19]);

        const nextEvalDate = r[20] ?? '';

        elsListSheetData.push({
          row_index: i,
          상품명: name,
          증권사_회차: brokerSeries,
          가입금액: principal,
          평가금액: valuation,
          상태: status,
          낙인배리어: 50,
          상환배리어: 80,
          티커1: ticker1 || undefined,
          기준가1: base1 > 0 ? base1 : undefined,
          현재가1: cur1 > 0 ? cur1 : undefined,
          티커2: ticker2 || undefined,
          기준가2: base2 > 0 ? base2 : undefined,
          현재가2: cur2 > 0 ? cur2 : undefined,
          티커3: ticker3 || undefined,
          기준가3: base3 > 0 ? base3 : undefined,
          현재가3: cur3 > 0 ? cur3 : undefined,
          '1차 평가일': nextEvalDate || undefined,
          '다음 평가일': nextEvalDate || notes.replace('발행일: ', ''),
        });
      } else if (category === '현금성') {
        cashOther.push({
          상품명: name,
          투자원금: principal,
          평가금액: valuation,
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

  // 3. 최신 서머리 카드 계산
  const latestAsset = totalAssets.length > 0 ? totalAssets[totalAssets.length - 1] : null;
  const principalTotal = (latestAsset?.['원금 총액'] as number) || 0;
  const valuationTotal = (latestAsset?.['평가금 총액'] as number) || 0;
  const profitLoss = valuationTotal - principalTotal;
  const returnRateNum = principalTotal > 0 ? parseFloat(((profitLoss / principalTotal) * 100).toFixed(1)) : 0;

  const summaryCards: SummaryCardItem[] = [
    {
      id: 'card-total-val',
      title: '평가금 총액',
      amount: valuationTotal,
      rate: returnRateNum,
    },
    {
      id: 'card-total-principal',
      title: '원금 총액',
      amount: principalTotal,
    },
    {
      id: 'card-total-profit',
      title: '누적 손익',
      amount: profitLoss,
      rate: returnRateNum,
    },
  ];

  // 4. 리밸런싱 표 생성 (rebalancingAccountMap 기반)
  const rebalancing: RebalancingTable[] = Object.entries(rebalancingAccountMap).map(([accountLabel, rows]) => ({
    accountLabel,
    sheet: '포트_API',
    rows,
  }));

  return {
    totalAssets,
    summaryCards,
    etfList,
    pensionList,
    elsListSheetData,
    cashOther,
    rebalancing,
  };
}

/**
 * 로컬 history.csv 및 portfolio.csv 데이터를 파싱하여 개별 종목/자산군의 일자별 수익률 히스토리를 반환합니다.
 */
export function fetchLocalProductHistory(
  productName: string,
  type: 'ETF' | 'PENSION'
): [string, number][] {
  const historyRows = parseCsv(historyCsvText);
  if (historyRows.length <= 1) return [];

  // portfolio.csv에서 선택된 종목의 최신 수익률 조회
  const portfolioRows = parseCsv(portfolioCsvText);
  let currentProductReturnRate: number | null = null;
  for (let i = 1; i < portfolioRows.length; i++) {
    const r = portfolioRows[i];
    if (r.length >= 6 && r[1] === productName) {
      currentProductReturnRate = parseReturnRate(r[5]);
      break;
    }
  }

  const result: [string, number][] = [];

  for (let i = 1; i < historyRows.length; i++) {
    const r = historyRows[i];
    if (r.length < 11) continue;

    const dateStr = r[0].split('T')[0];
    let rate = 0;

    if (type === 'ETF') {
      const principal = parseNumber(r[5]); // ETF 원금
      const valuation = parseNumber(r[6]); // ETF 평가금
      if (principal > 0) {
        rate = parseFloat((((valuation - principal) / principal) * 100).toFixed(2));
      }
    } else if (type === 'PENSION') {
      const principal = parseNumber(r[1]); // 연금 원금
      const valuation = parseNumber(r[2]); // 연금 평가금
      if (principal > 0) {
        rate = parseFloat((((valuation - principal) / principal) * 100).toFixed(2));
      }
    }

    result.push([dateStr, rate]);
  }

  // 만약 개별 종목의 최신 수익률 정보가 존재하는 경우, 개별 종목 수익률 오프셋을 반영하여 스케일링
  if (result.length > 0 && currentProductReturnRate !== null) {
    const lastRate = result[result.length - 1][1];
    const diff = currentProductReturnRate - lastRate;
    return result.map(([date, r]) => {
      const scaledRate = parseFloat((r + diff).toFixed(2));
      return [date, scaledRate];
    });
  }

  return result;
}
