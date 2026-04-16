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

export const SUMMARY_CARDS: SummaryCardItem[] = [
  { id: 'total', title: '총 자산 평가', amount: 245_158_004, rate: 18.4 },
  { id: 'pension', title: '연금 평가', amount: 35_214_403, rate: 26.2 },
  { id: 'etf', title: 'ETF 평가', amount: 155_063_090, rate: 20.9 },
  { id: 'els', title: 'ELS 평가', amount: 43_880_511, rate: 9.7 },
  { id: 'els-profit', title: 'ELS 누적 수익금', amount: 6_583_870, rate: 4.6 },
]

export const PIE_DATA: PieSegment[] = [
  { name: 'ETF', value: 63.3, color: '#6366f1' }, // indigo
  { name: 'ELS', value: 17.9, color: '#f59e0b' }, // amber
  { name: '연금', value: 14.4, color: '#10b981' }, // emerald
]

export const TREND_DATA: TrendPoint[] = [
  { month: '25.10', pension: 30_000_000, els: 41_000_000, etf: 132_000_000 },
  { month: '25.11', pension: 31_500_000, els: 42_500_000, etf: 138_000_000 },
  { month: '25.12', pension: 33_000_000, els: 43_000_000, etf: 145_000_000 },
  { month: '26.01', pension: 34_000_000, els: 43_500_000, etf: 148_000_000 },
  { month: '26.02', pension: 34_500_000, els: 43_700_000, etf: 152_000_000 },
  { month: '26.03', pension: 35_214_403, els: 43_880_511, etf: 155_063_090 },
]

export const ETF_TABLE: EtfRow[] = [
  { id: '1', name: 'KODEX 200', principal: 50_000_000, valuation: 62_000_000, returnRate: 24.0, sparklineData: [0, 4, 8, 14, 20, 24], monthlyDeltas: [1.2, -0.5, 2.3, 0.8, -1.5, 1.0] },
  { id: '2', name: 'TIGER 미국S&P500', principal: 40_000_000, valuation: 48_063_090, returnRate: 20.16, sparklineData: [0, 3, 7, 12, 17, 20.16], monthlyDeltas: [0.5, 1.8, -0.3, 1.2, 0.9, -0.2] },
  { id: '3', name: 'KODEX 배당성장', principal: 38_000_000, valuation: 45_000_000, returnRate: 18.42, sparklineData: [0, 2, 6, 10, 15, 18.42], monthlyDeltas: [2.1, 0.4, 1.5, -0.8, 1.0, 0.6] },
]

export const PENSION_TABLE: PensionRow[] = [
  { id: '1', name: '연금저축펀드 가입금', principal: 18_000_000, valuation: 22_000_000, returnRate: 22.22, monthlyDeltas: [0.8, 1.2, -0.3, 1.5, 0.6, 0.4] },
  { id: '2', name: 'IRP', principal: 10_500_000, valuation: 13_214_403, returnRate: 25.85, monthlyDeltas: [1.1, 0.5, 1.8, -0.2, 0.9, 0.7] },
]

/** 리밸런싱: 계좌별 종목 (종목명, 현재가, 보유수량, 현재 평가금액, 현재 비중, 목표 비중) */
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

export const REBALANCING_ACCOUNTS: RebalancingAccount[] = [
  {
    id: 'all',
    label: '전체',
    holdings: [
      { id: '1', name: 'KODEX 200', currentPrice: 42500, quantity: 100, currentValue: 4_250_000, currentWeight: 38, targetWeight: 40 },
      { id: '2', name: 'TIGER 미국S&P500', currentPrice: 15200, quantity: 80, currentValue: 1_216_000, currentWeight: 10.9, targetWeight: 12 },
      { id: '3', name: 'KODEX 배당성장', currentPrice: 11200, quantity: 50, currentValue: 560_000, currentWeight: 5, targetWeight: 5 },
      { id: '4', name: 'KODEX 2차전지산업', currentPrice: 8900, quantity: 30, currentValue: 267_000, currentWeight: 2.4, targetWeight: 3 },
    ],
  },
  {
    id: 'pension',
    label: '연금저축',
    holdings: [
      { id: 'p1', name: 'KODEX 200', currentPrice: 42500, quantity: 40, currentValue: 1_700_000, currentWeight: 35, targetWeight: 40 },
      { id: 'p2', name: 'TIGER 미국S&P500', currentPrice: 15200, quantity: 30, currentValue: 456_000, currentWeight: 9.4, targetWeight: 12 },
      { id: 'p3', name: 'KODEX 배당성장', currentPrice: 11200, quantity: 20, currentValue: 224_000, currentWeight: 4.6, targetWeight: 5 },
    ],
  },
  {
    id: 'irp',
    label: 'IRP',
    holdings: [
      { id: 'r1', name: 'KODEX 200', currentPrice: 42500, quantity: 30, currentValue: 1_275_000, currentWeight: 42, targetWeight: 40 },
      { id: 'r2', name: 'TIGER 미국S&P500', currentPrice: 15200, quantity: 25, currentValue: 380_000, currentWeight: 12.5, targetWeight: 12 },
      { id: 'r3', name: 'KODEX 2차전지산업', currentPrice: 8900, quantity: 15, currentValue: 133_500, currentWeight: 4.4, targetWeight: 5 },
    ],
  },
  {
    id: 'isa',
    label: 'ISA',
    holdings: [
      { id: 'i1', name: 'KODEX 200', currentPrice: 42500, quantity: 20, currentValue: 850_000, currentWeight: 34, targetWeight: 35 },
      { id: 'i2', name: 'TIGER 미국S&P500', currentPrice: 15200, quantity: 15, currentValue: 228_000, currentWeight: 9.1, targetWeight: 10 },
    ],
  },
  {
    id: 'general',
    label: '일반',
    holdings: [
      { id: 'g1', name: 'KODEX 배당성장', currentPrice: 11200, quantity: 10, currentValue: 112_000, currentWeight: 6, targetWeight: 5 },
      { id: 'g2', name: 'KODEX 2차전지산업', currentPrice: 8900, quantity: 5, currentValue: 44_500, currentWeight: 2.4, targetWeight: 3 },
    ],
  },
]
