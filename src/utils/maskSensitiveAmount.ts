/** 금액 숨김 활성 시 숫자 대신 표시 */
export const AMOUNT_MASK = '#'

export function formatWonDigits(value: number): string {
  return Math.round(value).toLocaleString('ko-KR')
}

export function formatWonWithWonSymbol(value: number): string {
  return `₩${Math.round(value).toLocaleString('ko-KR')}`
}

export function formatAxisAmountShort(_value: number, formatted: string): string {
  return formatted
}
