import type { ElsRow } from '../types/api';
import type { ElsProduct, UnderlyingAsset, AssetColumnMapping } from '../types/els';

function toNumber(value: string | number | boolean | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, '').trim());
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function toString(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * 시트 한 행(ElsRow)에서 기초자산 배열을 뽑아 UnderlyingAsset[]로 만듭니다.
 * 매핑에 있는 컬럼만 사용하며, 기준가·현재가가 하나라도 있으면 포함합니다.
 * (티커2/티커3가 없어도 기준가2/현재가2 등만 있으면 자산으로 인식)
 */
function extractAssets(row: ElsRow, mapping: AssetColumnMapping): UnderlyingAsset[] {
  const assets: UnderlyingAsset[] = [];
  for (const { nameKey, initialPriceKey, currentPriceKey } of mapping) {
    const initialPrice = toNumber(row[initialPriceKey]);
    const currentPrice = toNumber(row[currentPriceKey]);
    if (initialPrice === 0 && currentPrice === 0) continue;
    const name = toString(row[nameKey]);
    assets.push({
      name: name || `자산 ${assets.length + 1}`,
      initialPrice,
      currentPrice,
    });
  }
  return assets;
}

/** 기본 기초자산 컬럼 매핑 (시트 컬럼명이 다르면 변환 시 두 번째 인자로 커스텀 매핑 전달) */
export const DEFAULT_ELS_ASSET_MAPPING: AssetColumnMapping = [
  { nameKey: '기초자산1', initialPriceKey: '기초자산1_기준가', currentPriceKey: '기초자산1_현재가' },
  { nameKey: '기초자산2', initialPriceKey: '기초자산2_기준가', currentPriceKey: '기초자산2_현재가' },
  { nameKey: '기초자산3', initialPriceKey: '기초자산3_기준가', currentPriceKey: '기초자산3_현재가' },
];

/** ELS(투자중) 시트 형식: 티커1~3 + 기준가1~3/현재가1~3 */
export const ELS_INVESTING_SHEET_MAPPING: AssetColumnMapping = [
  { nameKey: '티커1', initialPriceKey: '기준가1', currentPriceKey: '현재가1' },
  { nameKey: '티커2', initialPriceKey: '기준가2', currentPriceKey: '현재가2' },
  { nameKey: '티커3', initialPriceKey: '기준가3', currentPriceKey: '현재가3' },
];

/** 시트에 기준가/현재가 단일 컬럼만 있을 때 (한 행 = 한 기초자산 수준) */
export const ELS_SINGLE_PRICE_MAPPING: AssetColumnMapping = [
  { nameKey: '상품명', initialPriceKey: '기준가', currentPriceKey: '현재가' },
];

/**
 * ELS 시트 한 행(ElsRow)을 ElsProduct로 변환합니다.
 * 상품명은 row의 '상품명' 컬럼을 사용하고, 기초자산은 mapping에 따라 row에서 추출합니다.
 *
 * @param row - 시트에서 내려온 ELS 한 행
 * @param mapping - 기초자산 컬럼 매핑 (미입력 시 DEFAULT_ELS_ASSET_MAPPING 사용)
 */
export function elsRowToElsProduct(
  row: ElsRow,
  mapping: AssetColumnMapping = DEFAULT_ELS_ASSET_MAPPING
): ElsProduct {
  const productName = row.상품명 != null ? String(row.상품명).trim() : undefined;
  const assets = extractAssets(row, mapping);
  return {
    productName: productName || undefined,
    assets,
  };
}

/**
 * ELS 시트 행 배열을 ElsProduct 배열로 일괄 변환합니다.
 * getWorstPerformer, ElsRiskProgressBar 등 ElsProduct 기반 로직에 넣을 때 사용하세요.
 *
 * @param rows - ElsRow 배열 (스토어의 els 등)
 * @param mapping - 기초자산 컬럼 매핑 (미입력 시 DEFAULT_ELS_ASSET_MAPPING 사용)
 */
export function elsRowsToElsProducts(
  rows: ElsRow[],
  mapping: AssetColumnMapping = DEFAULT_ELS_ASSET_MAPPING
): ElsProduct[] {
  return rows.map((row) => elsRowToElsProduct(row, mapping));
}

/**
 * 여러 매핑을 순서대로 시도해, 기초자산이 하나라도 나오는 첫 결과를 반환합니다.
 * ELS(투자중) 시트처럼 컬럼명이 다양할 때 사용.
 */
export function elsRowToElsProductWithMappings(
  row: ElsRow,
  mappings: AssetColumnMapping[]
): ElsProduct {
  for (const m of mappings) {
    const product = elsRowToElsProduct(row, m);
    if (product.assets.length > 0) return product;
  }
  return elsRowToElsProduct(row, DEFAULT_ELS_ASSET_MAPPING);
}

export function elsRowsToElsProductsWithMappings(
  rows: ElsRow[],
  mappings: AssetColumnMapping[]
): ElsProduct[] {
  return rows.map((row) => elsRowToElsProductWithMappings(row, mappings));
}
