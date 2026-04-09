import type { ElsRow } from '../types/api'
import { parseBarrierPercent } from './elsRiskCounts'
import { getDDay } from './elsDDay'

const LEVEL_MIN = 0
const LEVEL_MAX = 110

/** GAS 크롤러가 상태를 바꿀 때와 동일한 문구 */
export const ELS_LIST_LIVE_STATUS = '투자 중'

function toNumber(value: string | number | boolean | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, '').trim())
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

function trimStr(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

/**
 * 티커1~3 각각 (현재가/기준가)×100 후, 유효한 값만 모아 MIN.
 * 기준가>0 인 슬롯만 포함.
 */
export function getMinLevelFromTickerPrices(row: ElsRow): number | null {
  const levels: number[] = []
  for (let i = 1; i <= 3; i++) {
    const base = toNumber(row[`기준가${i}`])
    const curr = toNumber(row[`현재가${i}`])
    if (base > 0) levels.push((curr / base) * 100)
  }
  if (levels.length === 0) return null
  return Math.min(...levels)
}

export function clampElsLevel(level: number): number {
  return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, level))
}

/** ELS목록 행 표시명: 증권사 + 상품회차 */
export function getElsListProductDisplayName(row: ElsRow): string {
  const broker = trimStr(row['증권사'])
  const round = trimStr(row['상품회차'])
  const parts = [broker, round].filter(Boolean)
  if (parts.length === 0) return trimStr(row['상품명']) || '-'
  return parts.join(' ')
}

/** 시트·API에서 온 평가일 셀 → 로컬 자정 기준 Date */
export function parseElsListSheetDateCell(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    if (Number.isInteger(raw) && raw > 35000 && raw < 65000) {
      const epoch = new Date((raw - 25569) * 86400 * 1000)
      if (!Number.isNaN(epoch.getTime())) return epoch
    }
  }
  const s = String(raw).trim()
  if (!s) return null
  const beforeT = s.split('T')[0]
  const head = beforeT || s

  const iso = head.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    const mo = Number(iso[2]) - 1
    const day = Number(iso[3])
    const d = new Date(y, mo, day)
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day ? d : null
  }

  const ko = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (ko) {
    const y = Number(ko[1])
    const mo = Number(ko[2]) - 1
    const day = Number(ko[3])
    const d = new Date(y, mo, day)
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day ? d : null
  }

  const compact = head.replace(/\D/g, '')
  if (compact.length === 8) {
    const y = Number(compact.slice(0, 4))
    const mo = Number(compact.slice(4, 6)) - 1
    const day = Number(compact.slice(6, 8))
    const d = new Date(y, mo, day)
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day ? d : null
  }

  return null
}

function parseSheetDate(raw: unknown): Date | null {
  return parseElsListSheetDateCell(raw)
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** getDDay 값을 D-7(7일 남음), D-0(당일), D+3(3일 경과) 형식으로 */
function formatCountdownLabel(dday: number): string {
  if (dday > 0) return `D-${dday}`
  if (dday === 0) return 'D-0'
  return `D+${-dday}`
}

type ChosenEvalOutcome =
  | { kind: 'date'; chosen: Date }
  | { kind: 'raw'; text: string }
  | { kind: 'none' }

/** 1~12차 평가일·레거시 열에서 표시·정렬에 쓸 대상일(또는 비파싱 문자열)을 고릅니다. */
function resolveChosenEvalOutcome(row: ElsRow): ChosenEvalOutcome {
  const dates: Date[] = []
  for (let i = 1; i <= 12; i++) {
    const key = `${i}차 평가일` as keyof ElsRow
    const d = parseSheetDate(row[key])
    if (d) dates.push(startOfDay(d))
  }
  dates.sort((a, b) => a.getTime() - b.getTime())

  const today = startOfDay(new Date())
  let chosen: Date | null = null
  for (const d of dates) {
    if (d.getTime() >= today.getTime()) {
      chosen = d
      break
    }
  }
  if (chosen == null && dates.length > 0) {
    chosen = dates[dates.length - 1]
  }
  if (chosen != null) {
    return { kind: 'date', chosen }
  }

  const legacy =
    trimStr(row['다음 평가일']) ||
    trimStr(row['1차 날짜'])
  if (!legacy) {
    return { kind: 'none' }
  }
  const parsed = parseElsListSheetDateCell(legacy)
  if (parsed) {
    return { kind: 'date', chosen: startOfDay(parsed) }
  }
  return { kind: 'raw', text: legacy }
}

function evalSortMetaForRow(row: ElsRow): { tier: 0 | 1 | 2; key: number } {
  const o = resolveChosenEvalOutcome(row)
  if (o.kind === 'none' || o.kind === 'raw') {
    return { tier: 2, key: 0 }
  }
  const dday = getDDay(o.chosen)
  if (dday === null) {
    return { tier: 2, key: 0 }
  }
  if (dday >= 0) {
    return { tier: 0, key: dday }
  }
  return { tier: 1, key: dday }
}

/**
 * 다음 평가일 기준 정렬: (1) D-day 양수·0 = 남은 일수 오름차순 (2) 과거만 있는 행 (3) 정보 없음·비파싱 문자열
 */
export function compareElsListRowsByNextEval(a: ElsRow, b: ElsRow): number {
  const ma = evalSortMetaForRow(a)
  const mb = evalSortMetaForRow(b)
  if (ma.tier !== mb.tier) {
    return ma.tier - mb.tier
  }
  if (ma.tier === 0) {
    return ma.key - mb.key
  }
  if (ma.tier === 1) {
    return mb.key - ma.key
  }
  return 0
}

/**
 * ELS 관리 목록용: 1~12차 평가일 중 오늘 이후(당일 포함) 가장 가까운 날짜.
 * 모두 과거면 마지막 평가일. `YYYY-MM-DD (D-n)` 형식, 없으면 `-`.
 */
export function formatNextEarlyRedemptionWithCountdown(row: ElsRow): string {
  const o = resolveChosenEvalOutcome(row)
  if (o.kind === 'none') {
    return '-'
  }
  if (o.kind === 'raw') {
    return o.text
  }
  const ymd = formatDateYmd(o.chosen)
  const dday = getDDay(o.chosen)
  if (dday === null) {
    return ymd
  }
  return `${ymd} (${formatCountdownLabel(dday)})`
}

/**
 * 1~12차 평가일 중 오늘 이상인 가장 이른 날짜.
 * 모두 과거이면 마지막 평가일을 반환. 없으면 빈 문자열.
 */
export function getNextElsListEvaluationDateRaw(row: ElsRow): string {
  const o = resolveChosenEvalOutcome(row)
  if (o.kind === 'none') {
    return ''
  }
  if (o.kind === 'raw') {
    return o.text
  }
  return formatDateYmd(o.chosen)
}

export function isElsListInvestingRow(row: ElsRow): boolean {
  return trimStr(row['상태']) === ELS_LIST_LIVE_STATUS
}

/** 조기상환 배리어: 전용 열이 없으면 1차(조기상환 %) 등 시트 관례 폴백 */
export function getElsListRedemptionBarrierPercent(row: ElsRow): number {
  const p = parseBarrierPercent(
    row['상환배리어'] ?? row['다음 배리어'] ?? row['1차']
  )
  return p > 0 ? p : 90
}
