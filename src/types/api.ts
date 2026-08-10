/**
 * CSV 한 행(레코드) 타입.
 * 컬럼명을 키로 하는 객체입니다.
 */
export interface SheetDataRow {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * 총자산 CSV 한 행 (14열 헤더, 띄어쓰기 포함)
 */
export interface TotalAssetRow extends SheetDataRow {
  평가일?: string | number;
  '연금 원금'?: number | string;
  '연금 평가금'?: number | string;
  'ETF 원금'?: number | string;
  'ETF 평가금'?: number | string;
  '현금 원금'?: number | string;
  '현금 평가금'?: number | string;
  '원금 총액'?: number | string;
  '평가금 총액'?: number | string;
  수익률?: number | string;
  '원금 증감액'?: number | string;
  '평가 증감액'?: number | string;
  일자?: string;
  총자산?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** 포트폴리오 CSV 한 행 */
export interface PortfolioRow extends SheetDataRow {
  종목명?: string;
  수량?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** ETF현황 데이터 한 행 */
export interface EtfSheetRow extends SheetDataRow {
  상품명?: string;
  투자원금?: number;
  평가금액?: number;
  수익률?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** 연금현황 데이터 한 행 */
export interface PensionSheetRow extends SheetDataRow {
  상품명?: string;
  투자원금?: number;
  평가금액?: number;
  수익률?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** 리밸런싱 표 하나 (계좌별 표) */
export interface RebalancingTableRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface RebalancingTable {
  accountLabel: string;
  sheet: string;
  rows: RebalancingTableRow[];
}

/** 대시보드용 데이터 응답 구조 */
export interface DashboardSheetResponse {
  totalAssets?: TotalAssetRow[];
  summaryCards?: import('./dashboard').SummaryCardItem[];
  etfList?: EtfSheetRow[];
  pensionList?: PensionSheetRow[];
  rebalancing?: RebalancingTable[];
}
