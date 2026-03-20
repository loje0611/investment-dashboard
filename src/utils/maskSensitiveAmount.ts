/** 금액 숨김 활성 시 숫자 대신 표시 */
export const AMOUNT_MASK = '#'

export function formatWonDigits(hide: boolean, value: number): string {
  if (hide) return AMOUNT_MASK
  return value.toLocaleString('ko-KR')
}

export function formatWonWithWonSymbol(hide: boolean, value: number): string {
  if (hide) return `₩${AMOUNT_MASK}`
  return `₩${value.toLocaleString('ko-KR')}`
}

export function formatAxisAmountShort(hide: boolean, _value: number, formatted: string): string {
  if (hide) return AMOUNT_MASK
  return formatted
}
