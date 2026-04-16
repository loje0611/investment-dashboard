import type { TotalAssetRow } from '../types/api'

export interface PrincipalValuationPoint {
  /** X축 라벨 (yy.mm) */
  label: string
  원금총액: number
  평가금총액: number
}

export interface PrincipalValuationTrend {
  points: PrincipalValuationPoint[]
  /** 최신 평가일 행 기준 전월 대비 원금 변화 (시트 컬럼 우선, 없으면 이전 행과 차이) */
  momPrincipal: number | null
  /** 최신 평가일 행 기준 전월 대비 평가금 변화 */
  momValuation: number | null
  /** 최신 데이터 라벨 (표시용) */
  latestLabel: string | null
}

/**
 * 전각·탭·연속 공백 정리 (시트 헤더가 탭으로 붙어 있거나 "원금　총액" 형태일 때 대응)
 */
function normalizeKey(k: string): string {
  return k
    .replace(/\u3000/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 「총자산」시트 표준 헤더(1행, 14열):
 * 평가일, 연금 원금, 연금 평가금, ELS 원금, ELS 평가금, ETF 원금, ETF 평가금, 현금 원금, 현금 평가금,
 * 원금 총액, 평가금 총액, 수익률, 원금 증감액, 평가 증감액
 * 차트·추이는 평가일·원금 총액·평가금 총액 열만 사용합니다.
 */
const DATE_KEYS = [
  '평가일',
  '일자',
  '날짜',
  '기준일',
  '평가기준일',
  '평가 기준일',
  '연월',
  '년월',
  'date',
] as const
const PRINCIPAL_KEYS = [
  /** 총자산 시트 본문 열 */
  '원금 총액',
  '원금총액',
  '원금 합계',
  '원금합계',
  '투자원금합계',
  '총 투자원금',
  '총투자원금',
  '투자원금',
  '원금',
] as const
/** 총자산·기타 이력: 합계 열 우선(연금/ELS/ETF/현금 평가금 열은 사용하지 않음) */
const VALUATION_KEYS = [
  /** 총자산 시트 본문 합계 열 */
  '평가금 총액',
  '평가금총액',
  '평가 합계',
  '평가합계',
  '총 평가금',
  '총평가금',
  '총 평가금액',
  '총평가금액',
  '평가금액',
  '평가액',
  '평가금',
] as const
const MOM_PRINCIPAL_KEYS = ['원금 증감액', '원금증감액'] as const
const MOM_VALUATION_KEYS = ['평가 증감액', '평가증감액'] as const

function coerceNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').replace(/원/g, '').replace(/\s/g, '').trim()
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

/** Google Sheets / Excel 일련번호 (대략 1990~2040년) */
function serialToDate(serial: number): Date | null {
  if (serial < 20000 || serial > 65000) return null
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseDateValue(v: unknown): Date | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate())
  }
  if (typeof v === 'number' && !Number.isNaN(v)) {
    const fromSerial = serialToDate(v)
    if (fromSerial) return fromSerial
    return null
  }
  const s = String(v).trim().split('T')[0]
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  m = s.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    const y = Number(m[1])
    const fullY = y >= 70 ? 1900 + y : 2000 + y
    const dt = new Date(fullY, Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  // 시트 표시 형식: 26.3.15 / 26.03.15
  m = s.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/)
  if (m) {
    const y = Number(m[1])
    const fullY = y >= 70 ? 1900 + y : 2000 + y
    const dt = new Date(fullY, Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  return null
}

/** 행의 키를 정규화된 형태로 한 번만 빌드 (같은 행에서 여러 조회 시 재사용) */
function buildNormalizedKeyMap(row: TotalAssetRow): Map<string, string> {
  const map = new Map<string, string>()
  for (const raw of Object.keys(row)) {
    const nk = normalizeKey(raw)
    if (!map.has(nk)) map.set(nk, raw)
  }
  return map
}

function getByNormalizedKeysWithMap(
  row: TotalAssetRow,
  nkMap: Map<string, string>,
  candidates: readonly string[]
): unknown {
  for (const c of candidates) {
    const raw = nkMap.get(normalizeKey(c))
    if (raw != null) return row[raw]
  }
  return undefined
}

function findCellByHeaderPatternWithMap(
  row: TotalAssetRow,
  nkMap: Map<string, string>,
  predicate: (normalizedHeader: string) => boolean
): unknown {
  for (const [nk, raw] of nkMap) {
    if (predicate(nk)) return row[raw]
  }
  return undefined
}

function getDateFromRow(row: TotalAssetRow, nkMap: Map<string, string>): Date | null {
  for (const k of DATE_KEYS) {
    const v = getByNormalizedKeysWithMap(row, nkMap, [k])
    const d = parseDateValue(v)
    if (d) return d
  }
  const fuzzy = findCellByHeaderPatternWithMap(
    row,
    nkMap,
    (h) =>
      h === '평가일' ||
      h === '일자' ||
      h === '날짜' ||
      h === '기준일' ||
      h.endsWith('평가일') ||
      /^날짜/i.test(h) ||
      /기준일/.test(h) ||
      /^연월|^년월/.test(h)
  )
  const fromFuzzy = parseDateValue(fuzzy)
  if (fromFuzzy) return fromFuzzy

  for (const k of Object.keys(row)) {
    const d = parseDateValue(row[k])
    if (d) return d
  }
  return null
}

function getPrincipalFromRow(row: TotalAssetRow, nkMap: Map<string, string>): number | null {
  for (const k of PRINCIPAL_KEYS) {
    const n = coerceNumber(getByNormalizedKeysWithMap(row, nkMap, [k]))
    if (n != null) return n
  }
  const v = findCellByHeaderPatternWithMap(
    row,
    nkMap,
    (h) =>
      !isDirtyPrincipalHeader(h) &&
      !isDirtyValuationHeader(h) &&
      ((h.includes('원금') && (h.includes('총액') || h.includes('합계'))) ||
        (h.includes('원금') && h.includes('총')) ||
        (h.includes('투자원금') && (h.includes('합') || h.includes('계'))))
  )
  return coerceNumber(v)
}

function isDirtyValuationHeader(h: string): boolean {
  return (
    h.includes('증감') ||
    h.includes('증가') ||
    h.includes('증액') ||
    h.includes('전월') ||
    h.includes('전기') ||
    h.includes('차액') ||
    h.includes('수익률') ||
    h.includes('대비')
  )
}

function isDirtyPrincipalHeader(h: string): boolean {
  return (
    h.includes('증감') ||
    h.includes('증가') ||
    h.includes('증액') ||
    h.includes('전월') ||
    h.includes('차액') ||
    h.includes('대비')
  )
}

function getValuationFromRow(row: TotalAssetRow, nkMap: Map<string, string>): number | null {
  for (const k of VALUATION_KEYS) {
    const raw = getByNormalizedKeysWithMap(row, nkMap, [k])
    const n = coerceNumber(raw)
    if (n != null) return n
  }
  const v = findCellByHeaderPatternWithMap(
    row,
    nkMap,
    (h) =>
      !isDirtyValuationHeader(h) &&
      !h.includes('원금') &&
      ((h.includes('평가금') && (h.includes('총액') || h.includes('합계'))) ||
        (h.includes('평가') && h.includes('총액')) ||
        (h.includes('평가') && (h.includes('금액') || h.endsWith('평가액'))) ||
        h === '평가금액')
  )
  const fromFuzzy = coerceNumber(v)
  if (fromFuzzy != null) return fromFuzzy
  return coerceNumber(
    findCellByHeaderPatternWithMap(
      row,
      nkMap,
      (h) => !isDirtyValuationHeader(h) && (h === '총자산' || h.endsWith('총자산'))
    )
  )
}

function getMomFromRow(row: TotalAssetRow, nkMap: Map<string, string>): { principal: number | null; valuation: number | null } {
  let principal: number | null = null
  for (const k of MOM_PRINCIPAL_KEYS) {
    const n = coerceNumber(getByNormalizedKeysWithMap(row, nkMap, [k]))
    if (n != null) {
      principal = n
      break
    }
  }
  if (principal == null) {
    const v = findCellByHeaderPatternWithMap(
      row,
      nkMap,
      (h) => h.includes('원금') && (h.includes('증감') || h.includes('증가'))
    )
    principal = coerceNumber(v)
  }

  let valuation: number | null = null
  for (const k of MOM_VALUATION_KEYS) {
    const n = coerceNumber(getByNormalizedKeysWithMap(row, nkMap, [k]))
    if (n != null) {
      valuation = n
      break
    }
  }
  if (valuation == null) {
    const v = findCellByHeaderPatternWithMap(
      row,
      nkMap,
      (h) =>
        (h.includes('평가') && (h.includes('증감') || h.includes('증가'))) ||
        (h.includes('평가금') && h.includes('차'))
    )
    valuation = coerceNumber(v)
  }
  return { principal, valuation }
}

function formatChartLabel(d: Date): string {
  const y = String(d.getFullYear()).slice(-2)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}.${m}`
}

export interface ParsedTotalAssetHistoryRow {
  date: Date
  principal: number
  valuation: number
  row: TotalAssetRow
}

/** 날짜·원금·평가금을 읽을 수 있는 행만 모아 과거→최신 정렬 */
export function parseTotalAssetHistoryRows(rows: TotalAssetRow[]): ParsedTotalAssetHistoryRow[] {
  const parsed: ParsedTotalAssetHistoryRow[] = []
  for (const row of rows) {
    const nkMap = buildNormalizedKeyMap(row)
    const date = getDateFromRow(row, nkMap)
    const principal = getPrincipalFromRow(row, nkMap)
    const valuation = getValuationFromRow(row, nkMap)
    if (!date || principal == null || valuation == null) continue
    parsed.push({ date, principal, valuation, row })
  }
  parsed.sort((a, b) => a.date.getTime() - b.date.getTime())
  return parsed
}

/**
 * 총자산 시트 행 배열에서 원금·평가금 시계열과 최신 전월 대비 증감을 만듭니다.
 * 날짜 기준 오름차순(과거→최신)으로 정렬합니다.
 */
export function totalAssetsToPrincipalValuationTrend(
  rows: TotalAssetRow[]
): PrincipalValuationTrend | null {
  if (!rows.length) return null

  const parsed = parseTotalAssetHistoryRows(rows)

  if (!parsed.length) return null

  const points: PrincipalValuationPoint[] = parsed.map((p) => ({
    label: formatChartLabel(p.date),
    원금총액: p.principal,
    평가금총액: p.valuation,
  }))

  const latest = parsed[parsed.length - 1]
  const prev = parsed.length >= 2 ? parsed[parsed.length - 2] : null

  const latestNkMap = buildNormalizedKeyMap(latest.row)
  const sheetMom = getMomFromRow(latest.row, latestNkMap)
  let momPrincipal = sheetMom.principal
  let momValuation = sheetMom.valuation

  if (momPrincipal == null && prev != null) {
    momPrincipal = latest.principal - prev.principal
  }
  if (momValuation == null && prev != null) {
    momValuation = latest.valuation - prev.valuation
  }

  return {
    points,
    momPrincipal,
    momValuation,
    latestLabel: formatChartLabel(latest.date),
  }
}
