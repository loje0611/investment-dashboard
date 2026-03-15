/** 기초자산 한 개 (현재가·최초 기준가) */
export interface UnderlyingAsset {
  /** 자산명 또는 코드 (예: 'KOSPI200', 'USDKRW') */
  name: string;
  /** 최초 기준가 */
  initialPrice: number;
  /** 현재가 */
  currentPrice: number;
}

/** ELS 상품 (2~3개 기초자산 포함) */
export interface ElsProduct {
  /** 상품 식별용 (선택) */
  id?: string;
  /** 상품명 (선택) */
  productName?: string;
  /** 기초자산 2~3개 */
  assets: UnderlyingAsset[];
}

/**
 * 시트 한 행(ElsRow)에서 기초자산 N개의 컬럼 매핑.
 * 각 기초자산마다 이름·기준가·현재가 컬럼 키를 지정합니다.
 */
export interface AssetColumnMappingItem {
  /** 자산명이 들어 있는 컬럼 키 */
  nameKey: string;
  /** 최초 기준가 컬럼 키 */
  initialPriceKey: string;
  /** 현재가 컬럼 키 */
  currentPriceKey: string;
}

/** ELS 시트 행 → ElsProduct 변환 시 사용하는 기초자산 컬럼 매핑 (2~3개) */
export type AssetColumnMapping = AssetColumnMappingItem[];

/** 상품별 Worst Performer 결과 */
export interface WorstPerformerResult {
  /** 해당 기초자산 이름 */
  assetName: string;
  /** 최초 기준가 대비 변동률 (%) */
  percentage: number;
  /** 기초자산 인덱스 (0-based) */
  assetIndex: number;
}
