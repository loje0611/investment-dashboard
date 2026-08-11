/** 요약 카드 1개 (금액 + 수익률) */
export interface SummaryCardItem {
  id: string
  title: string
  amount?: number
  rate?: number
}

/** 자산 배분 파이용 */
export interface PieSegment {
  name: string
  value: number
  color: string
}

/** 자산 변동 추이 한 점 */
export interface TrendPoint {
  month: string
  pension: number
  cash: number
  etf: number
}

/** ETF 테이블 행 */
export interface EtfRow {
  id: string
  name: string
  principal: number
  valuation: number
  returnRate: number
  /** 최근 6개월 수익률 추이 (%) */
  sparklineData: number[]
  /** 최근 6개월 월별 수익률 증감분(%p). 양수=상승, 음수=하락 */
  monthlyDeltas: number[]
}

/** 연금 테이블 행 */
export interface PensionRow {
  id: string
  name: string
  principal: number
  valuation: number
  returnRate: number
  /** 최근 6개월 수익률 추이 (%) — 스파크라인용 */
  sparklineData: number[]
  /** 최근 6개월 월별 수익률 증감분(%p). 양수=상승, 음수=하락 */
  monthlyDeltas: number[]
}

/** 현금 테이블 행 */
export interface CashRow {
  id: string
  name: string
  principal: number
  valuation: number
  returnRate: number
  sparklineData: number[]
  monthlyDeltas: number[]
}

/** 리밸런싱: 계좌별 종목 */
export interface RebalancingHolding {
  id: string
  name: string
  currentPrice: number
  quantity: number
  currentValue: number
  currentWeight: number
  targetWeight: number
}

export interface RebalancingAccount {
  id: string
  label: string
  holdings: RebalancingHolding[]
}
