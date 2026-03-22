import type { ElsRow } from '../types/api'

function normH(k: string): string {
  return k.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim()
}

/** ELS(투자중) 시트의 진행 상태 문구 (자산 상세 카드 표시용) */
export function getElsInvestingStatusText(row: Record<string, unknown>): string {
  const direct = row['현재 상태'] ?? row['현재상태'] ?? row['상태']
  if (direct != null && String(direct).trim() !== '') return String(direct).trim()
  for (const key of Object.keys(row)) {
    const h = normH(key)
    if (h.includes('상태') && (h.includes('현재') || h.includes('진행'))) {
      const v = row[key]
      if (v != null && String(v).trim() !== '') return String(v).trim()
    }
  }
  return ''
}

function parseDDayToNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).trim()
  const m = s.match(/D\s*[-]?\s*(\d+)/i)
  if (m) return parseInt(m[1], 10)
  const n = parseFloat(s.replace(/[^\d.-]/g, ''))
  if (!Number.isNaN(n)) return n
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    if (!Number.isNaN(d.getTime())) {
      return Math.ceil((d.getTime() - Date.now()) / 86400000)
    }
  }
  return null
}

function readDDayCell(row: Record<string, unknown>): number | null {
  const keys = ['D-Day', 'D Day', 'DDay', '디데이', 'd-day']
  for (const k of keys) {
    if (row[k] != null) {
      const x = parseDDayToNumber(row[k])
      if (x != null) return x
    }
  }
  for (const raw of Object.keys(row)) {
    const h = normH(raw)
    if (/^d[- ]?day$/i.test(h) || h.includes('디데이')) {
      return parseDDayToNumber(row[raw])
    }
  }
  return null
}

/**
 * 스프레드시트와 동일: COUNTIFS(현재 상태,"*낙인*", D-Day,"<30") 등
 */
export function countElsRiskFromInvestingSheet(elsRows: ElsRow[]): { danger: number; success: number } {
  let danger = 0
  let success = 0
  for (const row of elsRows) {
    const status = getElsInvestingStatusText(row)
    const d = readDDayCell(row)
    if (d == null || !(d < 30)) continue
    if (/낙인/.test(status)) danger++
    if (/상환\s*유력|상환유력/.test(status)) success++
  }
  return { danger, success }
}

export function parseBarrierPercent(
  value: string | number | boolean | null | undefined
): number {
  if (value == null) return 0
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value > 0 && value < 1.5 ? value * 100 : value
  }
  const s = String(value).replace(/%/g, '').trim()
  const n = parseFloat(s)
  if (Number.isNaN(n)) return 0
  return n > 0 && n < 1.5 ? n * 100 : n
}

/** 퍼센트·소수(0.92=92%) 형태의 '현재 수준' 등 */
function parsePercentLikeLevel(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) {
    let n = v
    if (n > 0 && n <= 1.5) n *= 100
    return n
  }
  const s = String(v).replace(/%/g, '').replace(/,/g, '').trim()
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  if (n > 0 && n <= 1.5) return n * 100
  return n
}

/**
 * Worst Perf. 열이 '기준 100 대비 등락률(%)'만 있는 경우(예: -8.2 → 91.8)와
 * 이미 수준(92.5)으로 적힌 경우를 구분합니다.
 */
function interpretWorstPerfAsLevel(n: number): number {
  if (n < 0) return 100 + n
  if (n >= 0 && n <= 40) return 100 + n
  return n
}

/** 시트 헤더가 `Worst Perf.` / 따옴표 포함 등으로 달라도 셀 값을 찾습니다. */
function findWorstPerfCell(row: Record<string, unknown>): unknown {
  const tryKeys = [
    'Worst Perf.',
    'Worst Perf',
    'WorstPerf.',
    'WorstPerf',
    'Worst Performance',
    'Worst performance',
  ]
  for (const k of tryKeys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return v
  }
  for (const raw of Object.keys(row)) {
    const h = normH(raw).replace(/^['"]+|['"]+$/g, '').trim().toLowerCase()
    if (h === 'worst perf.' || h === 'worst perf' || h.startsWith('worst perf')) {
      const v = row[raw]
      if (v != null && String(v).trim() !== '') return v
    }
  }
  return undefined
}

/**
 * Worst Perf. 셀 값 → 프로그레스 바 수준(%).
 * 소수(0.92)는 92%로, 음수·소양의 양수는 기준 100 대비 편차로 해석합니다.
 */
function levelFromWorstPerfCell(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) {
    let n = v
    if (n > 0 && n <= 1.5) n *= 100
    return interpretWorstPerfAsLevel(n)
  }
  const s = String(v).replace(/%/g, '').replace(/,/g, '').trim()
  const parsed = parseFloat(s)
  if (Number.isNaN(parsed)) return null
  let n = parsed
  if (n > 0 && n <= 1.5) n *= 100
  return interpretWorstPerfAsLevel(n)
}

const LEVEL_MIN = 0
const LEVEL_MAX = 110

/**
 * ELS 현황 막대용 현재 수준. **스프레드시트 `Worst Perf.`를 최우선**으로 쓰고,
 * 비어 있을 때만 다른 열·fallback을 사용합니다.
 */
export function getCurrentLevelFromRow(
  row: Record<string, unknown>,
  fallback: number
): number {
  const worstRaw = findWorstPerfCell(row)
  const fromWorst = levelFromWorstPerfCell(worstRaw)
  if (fromWorst != null && Number.isFinite(fromWorst)) {
    return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, fromWorst))
  }

  const fromSheetLevel = parsePercentLikeLevel(row.현재수준 ?? row['현재 수준'])
  if (fromSheetLevel != null) {
    return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, fromSheetLevel))
  }

  const curr = row.현재가 != null ? Number(row.현재가) : NaN
  const base = row.기준가 != null ? Number(row.기준가) : NaN
  if (!Number.isNaN(curr) && !Number.isNaN(base) && base !== 0) {
    return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, (curr / base) * 100))
  }

  return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, fallback))
}
