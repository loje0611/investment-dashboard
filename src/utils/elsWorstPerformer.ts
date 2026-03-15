import type { ElsProduct, WorstPerformerResult } from '../types/els';

/**
 * 최초 기준가 대비 현재가의 변동률(%)을 계산합니다.
 * (현재가 / 최초 기준가 - 1) * 100
 * @returns 소수 포함 퍼센트 값 (예: -5.25)
 */
function getPriceChangePercentage(
  currentPrice: number,
  initialPrice: number
): number {
  if (initialPrice === 0) return 0;
  return ((currentPrice / initialPrice - 1) * 100);
}

/**
 * ELS 상품 하나에 대해, 2~3개 기초자산 중
 * 최초 기준가 대비 변동률이 가장 낮은 자산(Worst Performer)과 그 퍼센트를 반환합니다.
 *
 * @param product - 기초자산 배열이 포함된 ELS 상품 객체
 * @returns Worst Performer의 이름, 퍼센트, 인덱스 (자산이 없으면 null)
 */
export function getWorstPerformer(product: ElsProduct): WorstPerformerResult | null {
  const { assets } = product;
  if (!assets?.length) return null;

  let worst: WorstPerformerResult | null = null;

  for (let i = 0; i < assets.length; i++) {
    const { name, initialPrice, currentPrice } = assets[i];
    const percentage = getPriceChangePercentage(currentPrice, initialPrice);

    if (worst === null || percentage < worst.percentage) {
      worst = { assetName: name, percentage, assetIndex: i };
    }
  }

  return worst;
}

/**
 * ELS 상품 객체 배열 전체에 대해, 각 상품별 Worst Performer와 퍼센트를 계산합니다.
 *
 * @param products - ELS 상품 객체 배열
 * @returns 상품 순서와 동일한 순서의 Worst Performer 결과 배열 (자산 없는 상품은 null)
 */
export function getWorstPerformers(products: ElsProduct[]): (WorstPerformerResult | null)[] {
  return products.map(getWorstPerformer);
}
