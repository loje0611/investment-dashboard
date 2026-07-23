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
 * 콤마(,) 및 큰따옴표("")로 감싸진 CSV 텍스트를 파싱하는 경량 파서
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
        insideQuote = !insideQuote;
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
        수익률: r[11] ?? '0%',
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

      // Skip summary header rows
      if (name.includes('합계') || name.includes('총액')) continue;

      if (category === 'ETF/자문사') {
        etfList.push({
          상품명: name,
          투자원금: principal,
          평가금액: valuation,
          수익률: parseNumber(returnRateStr),
          비고: notes,
        });
      } else if (category === '연금') {
        pensionList.push({
          상품명: name,
          투자원금: principal,
          평가금액: valuation,
          수익률: parseNumber(returnRateStr),
        });
      } else if (category === 'ELS') {
        elsListSheetData.push({
          row_index: i,
          상품명: name,
          증권사_회차: brokerSeries,
          가입금액: principal,
          평가금액: valuation,
          상태: status,
          낙인배리어: 50,
          상환배리어: 80,
          '다음 평가일': notes.replace('발행일: ', ''),
        });
      } else if (category === '현금성') {
        cashOther.push({
          상품명: name,
          투자원금: principal,
          평가금액: valuation,
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

  // 4. 리밸런싱 표 생성 (etfList & pensionList 기반)
  const rebalancing: RebalancingTable[] = [];

  // 4.1 ETF / 자문사 포트폴리오 테이블
  if (etfList.length > 0) {
    const totalEtf = etfList.reduce((sum, item) => sum + (item.평가금액 || 0), 0);
    const etfRows: RebalancingTableRow[] = etfList.map((item, idx) => {
      const val = item.평가금액 || 0;
      const weight = totalEtf > 0 ? parseFloat(((val / totalEtf) * 100).toFixed(1)) : 0;
      return {
        종목명: item.상품명 || `ETF ${idx + 1}`,
        현재가격: val,
        보유수량: 1,
        평가금액: val,
        현재비중: weight,
        목표비중: parseFloat((100 / etfList.length).toFixed(1)), // 균등 목표 비중
      };
    });

    rebalancing.push({
      accountLabel: 'ETF & 자문사 계좌',
      sheet: '포트폴리오',
      rows: etfRows,
    });
  }

  // 4.2 연금 포트폴리오 테이블
  if (pensionList.length > 0) {
    const totalPension = pensionList.reduce((sum, item) => sum + (item.평가금액 || 0), 0);
    const pensionRows: RebalancingTableRow[] = pensionList.map((item, idx) => {
      const val = item.평가금액 || 0;
      const weight = totalPension > 0 ? parseFloat(((val / totalPension) * 100).toFixed(1)) : 0;
      return {
        종목명: item.상품명 || `연금 ${idx + 1}`,
        현재가격: val,
        보유수량: 1,
        평가금액: val,
        현재비중: weight,
        목표비중: parseFloat((100 / pensionList.length).toFixed(1)), // 균등 목표 비중
      };
    });

    rebalancing.push({
      accountLabel: '연금 자산 계좌',
      sheet: '연금',
      rows: pensionRows,
    });
  }

  return {
    totalAssets,
    etfList,
    pensionList,
    elsListSheetData,
    cashOther,
    summaryCards,
    rebalancing,
  };
}
