import { describe, expect, it } from 'vitest'
import { getAssetClassTrend } from '../src/utils/trendAnalytics'
import type { TotalAssetRow } from '../src/types/api'

const rows: TotalAssetRow[] = [
  {
    평가일: '2026-01-15',
    'ETF 원금': 100_000,
    'ETF 평가금': 110_000,
    '연금 원금': 50_000,
    '연금 평가금': 45_000,
    '현금 원금': 20_000,
    '현금 평가금': 20_000,
  },
  {
    평가일: '2026-02-15',
    'ETF 원금': 100_000,
    'ETF 평가금': 120_000,
    '연금 원금': 50_000,
    '연금 평가금': 55_000,
    '현금 원금': 30_000,
    '현금 평가금': 30_000,
  },
  {
    평가일: '2026-03-15',
    'ETF 원금': 0,
    'ETF 평가금': 0,
    '연금 원금': 0,
    '연금 평가금': 0,
    '현금 원금': 0,
    '현금 평가금': 0,
  },
]

describe('getAssetClassTrend', () => {
  it('returns empty array for empty input', () => {
    expect(getAssetClassTrend([], 'ALL_ETF')).toEqual([])
  })

  it('builds ETF series with return rate and MoM deltas', () => {
    const etf = getAssetClassTrend(rows, 'ALL_ETF')
    expect(etf).toHaveLength(2)
    expect(etf[0]).toMatchObject({
      date: '2026-01-15',
      principal: 100_000,
      valuation: 110_000,
      returnRate: 10,
    })
    expect(etf[0].momValuationChange).toBeUndefined()
    expect(etf[1].momValuationChange).toBe(10_000)
    expect(etf[1].momReturnRateChange).toBe(10)
    expect(etf[1].returnRate).toBe(20)
  })

  it('switches pension vs cash series independently (AC-3)', () => {
    const pension = getAssetClassTrend(rows, 'PENSION')
    const cash = getAssetClassTrend(rows, 'CASH')
    expect(pension[0].valuation).toBe(45_000)
    expect(pension[0].returnRate).toBe(-10)
    expect(cash[0].valuation).toBe(20_000)
    expect(cash[0].returnRate).toBe(0)
    expect(cash[1].momValuationChange).toBe(10_000)
  })

  it('falls back to 0% return when principal is 0 but valuation exists', () => {
    const points = getAssetClassTrend(
      [{ 평가일: '2026-04-01', 'ETF 원금': 0, 'ETF 평가금': 5000 }],
      'ALL_ETF',
    )
    expect(points).toHaveLength(1)
    expect(points[0].returnRate).toBe(0)
  })

  it('skips rows where both principal and valuation are 0', () => {
    const etf = getAssetClassTrend(rows, 'ALL_ETF')
    expect(etf.some((p) => p.date === '2026-03-15')).toBe(false)
  })
})
