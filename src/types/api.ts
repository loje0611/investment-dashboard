/**
 * Google Apps Script 웹앱에서 반환하는 JSON 배열의 한 행(레코드) 타입.
 * 시트 컬럼명을 키로 하는 객체입니다.
 * 실제 시트 구조에 맞게 이 인터페이스를 확장하거나 새로 정의해서 사용하세요.
 */
export interface SheetDataRow {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * GAS 웹앱 에러 응답 구조
 */
export interface GasErrorResponse {
  error: string;
}

/**
 * 성공 시 응답은 데이터 배열이므로, 에러 여부는 'error' 키 존재로 구분합니다.
 */
export function isGasErrorResponse(
  data: unknown
): data is GasErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as GasErrorResponse).error === 'string'
  );
}

/**
 * 총자산 시트 한 행 (14열 헤더, 띄어쓰기 포함)
 */
export interface TotalAssetRow extends SheetDataRow {
  평가일?: string | number;
  '연금 원금'?: number | string;
  '연금 평가금'?: number | string;
  'ELS 원금'?: number | string;
  'ELS 평가금'?: number | string;
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

/** 포트폴리오 시트 한 행 (시트 컬럼에 맞게 확장 가능) */
export interface PortfolioRow extends SheetDataRow {
  종목명?: string;
  수량?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** ELS 시트 한 행 (시트 컬럼에 맞게 확장 가능) */
export interface ElsRow extends SheetDataRow {
  /** GAS가 ELS목록 조회 시 부여하는 시트 행번호(1-based) */
  row_index?: number;
  상품명?: string;
  평가일?: string;
  /** 다음 평가일 (예: '2026.05.20') */
  '다음 평가일'?: string;
  /** 낙인(KI) 배리어 (%). 프로그레스 바 등에서 사용 */
  낙인배리어?: number;
  /** 상환 배리어 (%). 프로그레스 바 등에서 사용 */
  상환배리어?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** ETF현황 시트 한 행 (GAS `readSheetAsObjects_('ETF현황', …)`) */
export interface EtfSheetRow extends SheetDataRow {
  상품명?: string;
  투자원금?: number;
  평가금액?: number;
  수익률?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** 연금현황 시트 한 행 (GAS `readSheetAsObjects_('연금현황', …)`) */
export interface PensionSheetRow extends SheetDataRow {
  상품명?: string;
  투자원금?: number;
  평가금액?: number;
  수익률?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** 리밸런싱 표 하나 (포트 Old/New 시트 내 계좌별 표) */
export interface RebalancingTableRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface RebalancingTable {
  accountLabel: string;
  sheet: string;
  rows: RebalancingTableRow[];
}

/** ELS(완료) 시트 한 행 */
export interface ElsCompletedRow extends SheetDataRow {
  투자원금?: number | string;
  수익?: number | string;
  투자기간?: number | string;
}

/** 'ELS' 시트 B4·C4 요약 (투자원금·평가금액) */
export interface ElsSheetTotals {
  principal: number;
  valuation: number;
}

/** 대시보드용 GAS 응답 */
export interface DashboardSheetResponse {
  totalAssets?: TotalAssetRow[];
  portfolio?: PortfolioRow[];
  rebalancing?: RebalancingTable[];
  etf?: EtfSheetRow[];
  pension?: PensionSheetRow[];
  els?: ElsRow[];
  /** 'ELS' 탭 고정 셀 합계 (B4, C4). 없으면 ELS(투자중) 행 합산으로 대체 */
  elsSheetTotals?: ElsSheetTotals | null;
  elsCompleted?: ElsCompletedRow[];
  /** 현금(기타) 시트 */
  cashOther?: SheetDataRow[];
  /** 'ELS목록' 시트 데이터 */
  elsListSheetData?: ElsRow[];
  /** 서버 연산 요약 카드 */
  summaryCards?: import('../data/dashboardDummy').SummaryCardItem[];
  /** 서버 연산 파이 차트 */
  pieData?: import('../data/dashboardDummy').PieSegment[];
}
