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

/** 총자산 시트 한 행 (시트 컬럼에 맞게 확장 가능) */
export interface TotalAssetRow extends SheetDataRow {
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

/** ETF 시트 한 행 (ETF 현황 탭 전용, 'ETF' 시트에서만 읽음) */
export interface EtfSheetRow extends SheetDataRow {
  상품명?: string;
  투자원금?: number;
  평가금액?: number;
  수익률?: number;
  [key: string]: string | number | boolean | null | undefined;
}

/** 연금 시트 한 행 (연금 현황 탭 전용, '연금' 시트에서만 읽음) */
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

/** 대시보드용 GAS 응답 */
export interface DashboardSheetResponse {
  totalAssets?: TotalAssetRow[];
  portfolio?: PortfolioRow[];
  rebalancing?: RebalancingTable[];
  etf?: EtfSheetRow[];
  pension?: PensionSheetRow[];
  els?: ElsRow[];
}
