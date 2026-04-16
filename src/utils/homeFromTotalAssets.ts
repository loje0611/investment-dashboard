import type { PieSegment, SummaryCardItem } from '../data/dashboardDummy'
import type { TotalAssetRow } from '../types/api'
import { parseTotalAssetHistoryRows } from './totalAssetsToPrincipalValuation'

/** 총자산 시트 14열 헤더(띄어쓰기 포함) — GAS `convertValuesToObjects_` 키와 동일 */
export const TOTAL_ASSET_HEADERS_14 = [
  '평가일',
  '연금 원금',
  '연금 평가금',
  'ELS 원금',
  'ELS 평가금',
  'ETF 원금',
  'ETF 평가금',
  '현금 원금',
  '현금 평가금',
  '원금 총액',
  '평가금 총액',
  '수익률',
  '원금 증감액',
  '평가 증감액',
] as const

function normalizeHeaderKey(k: string): string {
  return k
    .replace(/\u3000/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function coerceNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').replace(/원/g, '').replace(/%/g, '').replace(/\s/g, '').trim()
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

/** 시트 컬럼명과 동일한 키로 값 조회 (전각·공백 차이 허용) */
export function getTotalAssetCell(row: TotalAssetRow, header: string): unknown {
  const want = normalizeHeaderKey(header)
  for (const raw of Object.keys(row)) {
    if (normalizeHeaderKey(raw) === want) return row[raw]
  }
  return undefined
}

/** 시트에 저장된 수익률: 소수(0.12) 또는 퍼센트(12) 혼재 대비 */
function normalizePercentYield(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  if (raw === 0) return 0
  if (Math.abs(raw) < 1.5) return raw * 100
  return raw
}

export interface LatestTotalAssetSnapshot {
  row: TotalAssetRow
  /** 표시용: 평가금 총액 */
  totalValuation: number
  totalPrincipal: number
  totalYieldPercent: number | null
  연금평가금: number
  연금원금: number
  els평가금: number
  els원금: number
  etf평가금: number
  etf원금: number
  현금평가금: number
}

/**
 * 총자산 이력에서 차트·요약에 쓸 최신 행 스냅샷.
 * `parseTotalAssetHistoryRows`로 날짜·원금 총액·평가금 총액이 읽히는 행 중 최신을 택한 뒤, 14열 세부 평가금을 같은 행에서 읽습니다.
 */
export function getLatestTotalAssetSnapshot(rows: TotalAssetRow[]): LatestTotalAssetSnapshot | null {
  const parsed = parseTotalAssetHistoryRows(rows)
  if (!parsed.length) return null
  const latest = parsed[parsed.length - 1]
  const row = latest.row

  const num = (h: (typeof TOTAL_ASSET_HEADERS_14)[number]) => coerceNumber(getTotalAssetCell(row, h)) ?? 0

  const 연금평가금 = num('연금 평가금')
  const 연금원금 = num('연금 원금')
  const els평가금 = num('ELS 평가금')
  const els원금 = num('ELS 원금')
  const etf평가금 = num('ETF 평가금')
  const etf원금 = num('ETF 원금')
  const 현금평가금 = num('현금 평가금')

  const totalValuation = coerceNumber(getTotalAssetCell(row, '평가금 총액')) ?? latest.valuation
  const totalPrincipal = coerceNumber(getTotalAssetCell(row, '원금 총액')) ?? latest.principal

  const sheetYield = coerceNumber(getTotalAssetCell(row, '수익률'))
  let totalYieldPercent = normalizePercentYield(sheetYield)
  if (totalYieldPercent == null && totalPrincipal > 0) {
    totalYieldPercent = ((totalValuation - totalPrincipal) / totalPrincipal) * 100
  }

  return {
    row,
    totalValuation,
    totalPrincipal,
    totalYieldPercent,
    연금평가금,
    연금원금,
    els평가금,
    els원금,
    etf평가금,
    etf원금,
    현금평가금,
  }
}

function segmentRate(principal: number, valuation: number): number | null {
  if (principal > 0 && Number.isFinite(valuation)) {
    return ((valuation - principal) / principal) * 100
  }
  return null
}

/** 스냅샷을 직접 받아 요약 카드 4개를 생성 (중복 파싱 방지) */
export function buildSummaryCardsFromSnapshot(
  snap: LatestTotalAssetSnapshot | null
): SummaryCardItem[] {
  if (!snap) return []

  return [
    {
      id: 'total',
      title: '총 자산 평가',
      amount: snap.totalValuation,
      rate: snap.totalYieldPercent ?? undefined,
    },
    {
      id: 'pension',
      title: '연금 평가',
      amount: snap.연금평가금,
      rate: segmentRate(snap.연금원금, snap.연금평가금) ?? undefined,
    },
    {
      id: 'etf',
      title: 'ETF 평가',
      amount: snap.etf평가금,
      rate: segmentRate(snap.etf원금, snap.etf평가금) ?? undefined,
    },
    {
      id: 'els',
      title: 'ELS 평가',
      amount: snap.els평가금,
      rate: segmentRate(snap.els원금, snap.els평가금) ?? undefined,
    },
  ]
}

/** @deprecated buildSummaryCardsFromSnapshot 사용 권장 */
export function buildSummaryCardsFromLatestTotalAssets(
  rows: TotalAssetRow[]
): SummaryCardItem[] {
  return buildSummaryCardsFromSnapshot(getLatestTotalAssetSnapshot(rows))
}

const PIE_COLORS: Record<string, string> = {
  ETF: '#6366f1',
  ELS: '#f59e0b',
  연금: '#10b981',
  기타: '#64748b',
}

/** 스냅샷을 직접 받아 파이 비중(%) 계산 (중복 파싱 방지) */
export function buildPieSegmentsFromSnapshot(snap: LatestTotalAssetSnapshot | null): PieSegment[] {
  if (!snap) return []

  const parts: { name: keyof typeof PIE_COLORS; value: number }[] = []
  if (snap.etf평가금 > 0) parts.push({ name: 'ETF', value: snap.etf평가금 })
  if (snap.els평가금 > 0) parts.push({ name: 'ELS', value: snap.els평가금 })
  if (snap.연금평가금 > 0) parts.push({ name: '연금', value: snap.연금평가금 })
  if (snap.현금평가금 > 0) parts.push({ name: '기타', value: snap.현금평가금 })

  const sum = parts.reduce((a, b) => a + b.value, 0)
  if (sum <= 0) return []

  return parts.map((p) => ({
    name: p.name,
    value: Math.round((p.value / sum) * 1000 + Number.EPSILON) / 10,
    color: PIE_COLORS[p.name],
  }))
}

/** @deprecated buildPieSegmentsFromSnapshot 사용 권장 */
export function buildPieSegmentsFromLatestTotalAssets(rows: TotalAssetRow[]): PieSegment[] {
  return buildPieSegmentsFromSnapshot(getLatestTotalAssetSnapshot(rows))
}

/** API `els-profit` 카드를 유지해 5장 구성으로 병합 */
export function mergeSummaryWithElsProfitCard(
  coreFromTotalAssets: SummaryCardItem[],
  apiCards: SummaryCardItem[]
): SummaryCardItem[] {
  const profit = apiCards.find((c) => c.id === 'els-profit')
  if (!coreFromTotalAssets.length) return apiCards
  if (profit) return [...coreFromTotalAssets, profit]
  return coreFromTotalAssets
}
