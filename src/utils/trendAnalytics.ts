import type { TotalAssetRow } from '../types/api'

export interface AssetClassTrendPoint {
  date: string
  principal: number
  valuation: number
  returnRate: number
  momValuationChange?: number
  momReturnRateChange?: number
}

export interface ProductTrendPoint {
  date: string
  ratePercent: number
  principal?: number
  valuation?: number
  momValuationChange?: number
  momReturnRateChange?: number
}

export type AssetClassType = 'ALL_ETF' | 'PENSION' | 'CASH'

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return String(dateStr).trim().split('T')[0]
}

export function getAssetClassTrend(
  totalAssets: TotalAssetRow[],
  type: AssetClassType
): AssetClassTrendPoint[] {
  if (!totalAssets || totalAssets.length === 0) return []

  const sorted = [...totalAssets].sort((a, b) => {
    const d1 = String(a.평가일 || a.일자 || '')
    const d2 = String(b.평가일 || b.일자 || '')
    return d1.localeCompare(d2)
  })

  const results: AssetClassTrendPoint[] = []

  let prevValuation = 0
  let prevRate = 0

  for (const row of sorted) {
    const rawDateStr = String(row.평가일 || row.일자 || '').trim()
    if (!rawDateStr) continue
    const dateStr = formatDate(rawDateStr)

    let principal = 0
    let valuation = 0

    if (type === 'ALL_ETF') {
      principal = Number(row['ETF 원금'] || 0)
      valuation = Number(row['ETF 평가금'] || 0)
    } else if (type === 'PENSION') {
      principal = Number(row['연금 원금'] || 0)
      valuation = Number(row['연금 평가금'] || 0)
    } else if (type === 'CASH') {
      principal = Number(row['현금 원금'] || 0)
      valuation = Number(row['현금 평가금'] || 0)
    }

    if (principal === 0 && valuation === 0) continue

    const returnRate = principal > 0 ? ((valuation - principal) / principal) * 100 : 0

    const momValuationChange = results.length > 0 ? valuation - prevValuation : undefined
    const momReturnRateChange = results.length > 0 ? returnRate - prevRate : undefined

    results.push({
      date: dateStr,
      principal,
      valuation,
      returnRate,
      momValuationChange,
      momReturnRateChange,
    })

    prevValuation = valuation
    prevRate = returnRate
  }

  return results
}
