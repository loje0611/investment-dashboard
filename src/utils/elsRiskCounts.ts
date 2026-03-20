import type { ElsRow } from '../types/api'

function normH(k: string): string {
  return k.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim()
}

function readInvestingStatus(row: Record<string, unknown>): string {
  const direct = row['현재 상태'] ?? row['현재상태'] ?? row['상태']
  if (direct != null && String(direct).trim() !== '') return String(direct)
  for (const key of Object.keys(row)) {
    const h = normH(key)
    if (h.includes('상태') && (h.includes('현재') || h.includes('진행'))) {
      return String(row[key] ?? '')
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
    const status = readInvestingStatus(row)
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

export function getCurrentLevelFromRow(
  row: Record<string, unknown>,
  fallback: number
): number {
  const worstPerf = row['Worst Perf.'] ?? row['Worst Perf']
  if (worstPerf != null && worstPerf !== '') {
    const s = String(worstPerf).replace(/%/g, '').trim()
    const n = parseFloat(s)
    if (!Number.isNaN(n)) return n
  }
  const currentLevel = row.현재수준 ?? row['현재 수준']
  if (currentLevel != null) {
    const n = typeof currentLevel === 'number' ? currentLevel : parseFloat(String(currentLevel))
    if (!Number.isNaN(n)) return Math.max(0, Math.min(100, n))
  }
  const curr = row.현재가 != null ? Number(row.현재가) : NaN
  const base = row.기준가 != null ? Number(row.기준가) : NaN
  if (!Number.isNaN(curr) && !Number.isNaN(base) && base !== 0) {
    return Math.max(0, Math.min(100, (curr / base) * 100))
  }
  return fallback
}
