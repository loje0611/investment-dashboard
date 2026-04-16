import type { SheetDataRow, ElsRow, ElsCompletedRow, ElsSheetTotals } from '../types/api'
import type { SummaryCardItem, PieSegment } from '../data/dashboardDummy'

function normalizeKey(k: string): string {
  return k.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim()
}

function coerceNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').replace(/원/g, '').replace(/\s/g, '').trim()
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

function rowLabel(row: SheetDataRow): string {
  return String(row['상품명'] ?? row['종목명'] ?? row['이름'] ?? row['항목'] ?? '').trim()
}

/** 합계·집계 행 제외. 항목명이 비어 있으면 데이터 행으로 봅니다(현금 시트 등). */
function isDataRow(row: SheetDataRow): boolean {
  const n = rowLabel(row)
  if (!n) return true
  return !/합계|소계|^계$/i.test(n)
}

/**
 * 연금평가금: 시트와 동일하게 개인연금 행만 (스프레드시트 SUM(C4:C6)에 해당).
 * 퇴직연금·합계 행은 제외합니다.
 */
function isIndividualPensionRow(row: SheetDataRow): boolean {
  const n = rowLabel(row)
  if (!n) return false
  if (/합계|소계|퇴직/.test(n)) return false
  return /개인연금/.test(n)
}

function sumPrincipalValuation(
  rows: SheetDataRow[],
  filter: (row: SheetDataRow) => boolean
): { principal: number; valuation: number } {
  let principal = 0
  let valuation = 0
  for (const row of rows) {
    if (!isDataRow(row) || !filter(row)) continue
    const p =
      coerceNumber(row['투자원금']) ??
      coerceNumber(row['원금']) ??
      coerceNumber(row['매입금액']) ??
      coerceNumber(row['납입원금']) ??
      coerceNumber(row['매수금액']) ??
      0
    const v =
      coerceNumber(row['평가금액']) ??
      coerceNumber(row['평가금']) ??
      coerceNumber(row['현재평가']) ??
      coerceNumber(row['평가']) ??
      coerceNumber(row['잔고평가금액']) ??
      coerceNumber(row['평가잔액']) ??
      coerceNumber(row['평가금합계']) ??
      0
    principal += p
    valuation += v
  }
  return { principal, valuation }
}

/** ETF·ELS(투자중)·현금: 데이터 행 전체 합산 */
function sumAllProductRows(rows: SheetDataRow[]): { principal: number; valuation: number } {
  return sumPrincipalValuation(rows, () => true)
}

/** 현금(기타): 평가금·잔액 등 */
function sumCashOtherRows(rows: SheetDataRow[]): { principal: number; valuation: number } {
  let principal = 0
  let valuation = 0
  for (const row of rows) {
    if (!isDataRow(row)) continue
    const p =
      coerceNumber(row['투자원금']) ??
      coerceNumber(row['원금']) ??
      coerceNumber(row['매입금액']) ??
      0
    let v: number | null =
      coerceNumber(row['평가금액']) ??
      coerceNumber(row['평가금']) ??
      coerceNumber(row['잔액']) ??
      coerceNumber(row['평가액']) ??
      null
    if (v == null) {
      for (const raw of Object.keys(row)) {
        const h = normalizeKey(raw)
        if (h.includes('평가') || h.includes('잔액')) {
          v = coerceNumber(row[raw])
          if (v != null) break
        }
      }
    }
    principal += p
    valuation += v ?? 0
  }
  return { principal, valuation }
}

function sumElsCompletedProfit(rows: ElsCompletedRow[]): number {
  let s = 0
  for (const row of rows) {
    if (!isDataRow(row)) continue
    const profit =
      coerceNumber(row['수익']) ??
      coerceNumber(row['실현수익']) ??
      coerceNumber(row['누적수익']) ??
      coerceNumber(row['실현손익']) ??
      coerceNumber(row['손익']) ??
      coerceNumber(row['세후수익']) ??
      coerceNumber(row['이익']) ??
      0
    s += profit
  }
  return s
}

/** SUMPRODUCT(투자원금, 투자기간)/365 */
function elsCompletedWeightedPrincipalDays(rows: ElsCompletedRow[]): number {
  let sp = 0
  for (const row of rows) {
    if (!isDataRow(row)) continue
    const p =
      coerceNumber(row['투자원금']) ??
      coerceNumber(row['원금']) ??
      coerceNumber(row['납입원금']) ??
      0
    const days =
      coerceNumber(row['투자기간']) ??
      coerceNumber(row['보유기간']) ??
      coerceNumber(row['경과일']) ??
      coerceNumber(row['경과일수']) ??
      coerceNumber(row['일수']) ??
      0
    sp += p * days
  }
  return sp / 365
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

const PIE_COLORS: Record<string, string> = {
  ETF: '#6366f1',
  ELS: '#f59e0b',
  연금: '#10b981',
  기타: '#64748b',
}

/**
 * 스프레드시트 원본 시트만으로 홈 요약을 계산합니다 (Dashboard 탭 미사용).
 *
 * - ELS 평가·원금: `elsSheetTotals`가 있으면 'ELS' 시트 B4·C4와 동일. 없으면 ELS(투자중) 행 합산.
 * - 총 자산 평가 = 연금평가금(개인연금만) + ELS평가 + ETF평가 + 기타평가
 * - 연금 수익률 = (연금평가 − 연금원금) / 연금원금 (위와 동일 행 집합)
 * - ELS 누적 수익 = SUM(ELS(완료)[수익]), 수익률 분모 = SUMPRODUCT(원금,투자기간)/365
 */
export function buildHomeOverviewFromRawFormulas(
  pensionRows: SheetDataRow[],
  etfRows: SheetDataRow[],
  elsInvestingRows: ElsRow[],
  elsCompletedRows: ElsCompletedRow[],
  cashOtherRows: SheetDataRow[],
  elsSheetTotals?: ElsSheetTotals | null
): { summaryCards: SummaryCardItem[]; pieData: PieSegment[] } {
  const pen = sumPrincipalValuation(pensionRows, isIndividualPensionRow)
  const etf = sumAllProductRows(etfRows)
  const elsInv =
    elsSheetTotals != null &&
    Number.isFinite(elsSheetTotals.principal) &&
    Number.isFinite(elsSheetTotals.valuation)
      ? { principal: elsSheetTotals.principal, valuation: elsSheetTotals.valuation }
      : sumAllProductRows(elsInvestingRows)
  const other = sumCashOtherRows(cashOtherRows)

  const totalVal = pen.valuation + etf.valuation + elsInv.valuation + other.valuation
  const totalPrincipal = pen.principal + etf.principal + elsInv.principal + other.principal
  const totalRate =
    totalPrincipal > 0 ? ((totalVal - totalPrincipal) / totalPrincipal) * 100 : null

  const penRate = pen.principal > 0 ? ((pen.valuation - pen.principal) / pen.principal) * 100 : null
  const etfRate = etf.principal > 0 ? ((etf.valuation - etf.principal) / etf.principal) * 100 : null
  const elsRate = elsInv.principal > 0 ? ((elsInv.valuation - elsInv.principal) / elsInv.principal) * 100 : null

  const elsProfitSum = sumElsCompletedProfit(elsCompletedRows)
  const elsDenom = elsCompletedWeightedPrincipalDays(elsCompletedRows)
  let elsProfitRate: number | null = null
  if (elsDenom > 0 && Number.isFinite(elsDenom)) {
    const raw = elsProfitSum / elsDenom
    elsProfitRate = Math.abs(raw) < 1.5 ? raw * 100 : raw
  }

  const summaryCards: SummaryCardItem[] = [
    {
      id: 'total',
      title: '총 자산 평가',
      amount: totalVal,
      rate: totalRate != null ? round1(totalRate) : undefined,
    },
    {
      id: 'pension',
      title: '연금 평가',
      amount: pen.valuation,
      rate: penRate != null ? round1(penRate) : undefined,
    },
    {
      id: 'etf',
      title: 'ETF 평가',
      amount: etf.valuation,
      rate: etfRate != null ? round1(etfRate) : undefined,
    },
    {
      id: 'els',
      title: 'ELS 평가',
      amount: elsInv.valuation,
      rate: elsRate != null ? round1(elsRate) : undefined,
    },
    {
      id: 'els-profit',
      title: 'ELS 누적 수익금',
      amount: elsCompletedRows.length > 0 ? elsProfitSum : undefined,
      rate:
        elsCompletedRows.length > 0 && elsProfitRate != null && Number.isFinite(elsProfitRate)
          ? round1(elsProfitRate)
          : undefined,
    },
  ]

  const pieRaw: { name: keyof typeof PIE_COLORS; value: number }[] = []
  if (etf.valuation > 0) pieRaw.push({ name: 'ETF', value: etf.valuation })
  if (elsInv.valuation > 0) pieRaw.push({ name: 'ELS', value: elsInv.valuation })
  if (pen.valuation > 0) pieRaw.push({ name: '연금', value: pen.valuation })
  if (other.valuation > 0) pieRaw.push({ name: '기타', value: other.valuation })

  const pieSum = pieRaw.reduce((a, b) => a + b.value, 0)
  const pieData: PieSegment[] =
    pieSum > 0
      ? pieRaw.map((p) => ({
          name: p.name,
          value: Math.round((p.value / pieSum) * 1000 + Number.EPSILON) / 10,
          color: PIE_COLORS[p.name],
        }))
      : []

  return { summaryCards, pieData }
}
