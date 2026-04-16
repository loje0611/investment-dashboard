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
  els: number
  etf: number
}

/** ELS 카드 한 건 */
export interface ElsCardItem {
  id: string
  productName: string
  nextRedemptionDate: string
  currentLevel: number
  kiBarrier: number
  redemptionBarrier: number
  /** ELS목록 시트 행(1-based). 상환 API용 */
  rowIndex?: number
  /** 시트 가입금액(원) — 상환 금액 기본값 힌트 */
  joinAmount?: number
  /** 이미 상환완료면 카드 탭 비활성 */
  isRedeemed?: boolean
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
  /** 최근 6개월 월별 수익률 증감분(%p). 양수=상승, 음수=하락 */
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
