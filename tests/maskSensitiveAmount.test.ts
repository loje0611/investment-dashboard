import { describe, expect, it } from 'vitest'
import { formatWonDigits, formatWonWithWonSymbol } from '../src/utils/maskSensitiveAmount'

describe('amount formatting (AC-3)', () => {
  it('always renders numeric amounts, never a mask character', () => {
    expect(formatWonDigits(1234567)).toBe('1,234,567')
    expect(formatWonWithWonSymbol(1234567)).toBe('₩1,234,567')
    expect(formatWonDigits(0)).toBe('0')
    expect(formatWonDigits(1234567)).not.toMatch(/#/)
    expect(formatWonWithWonSymbol(1234567)).not.toMatch(/#/)
  })
})
