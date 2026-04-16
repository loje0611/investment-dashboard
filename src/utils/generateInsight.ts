import type { PrincipalValuationTrend } from './totalAssetsToPrincipalValuation'

export function generateInsightText(trend: PrincipalValuationTrend | null): string | null {
  if (!trend) return null

  const parts: string[] = []

  if (trend.momValuation != null) {
    const abs = Math.abs(trend.momValuation)
    const formatted = abs >= 100_000_000
      ? `${(abs / 100_000_000).toFixed(1)}억`
      : abs >= 10_000
        ? `${Math.round(abs / 10_000)}만`
        : `${abs.toLocaleString('ko-KR')}`

    if (trend.momValuation > 0) {
      parts.push(`평가금 총액이 전월 대비 ${formatted}원 증가했습니다`)
    } else if (trend.momValuation < 0) {
      parts.push(`평가금 총액이 전월 대비 ${formatted}원 감소했습니다`)
    }
  }

  if (trend.momPrincipal != null && trend.momPrincipal !== 0) {
    const abs = Math.abs(trend.momPrincipal)
    const formatted = abs >= 100_000_000
      ? `${(abs / 100_000_000).toFixed(1)}억`
      : abs >= 10_000
        ? `${Math.round(abs / 10_000)}만`
        : `${abs.toLocaleString('ko-KR')}`

    if (trend.momPrincipal > 0) {
      parts.push(`원금은 ${formatted}원 추가 투입되었습니다`)
    } else {
      parts.push(`원금이 ${formatted}원 감소했습니다`)
    }
  }

  if (trend.momValuation != null && trend.momPrincipal != null) {
    const profitDelta = trend.momValuation - trend.momPrincipal
    if (profitDelta > 0) {
      parts.push('투자 수익이 개선되는 추세입니다')
    } else if (profitDelta < 0 && trend.momValuation >= 0) {
      parts.push('원금 증가에 비해 수익률 개선 폭은 작습니다')
    }
  }

  return parts.length > 0 ? parts.join('. ') + '.' : null
}
