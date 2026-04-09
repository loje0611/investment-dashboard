import type { ElsRow } from '../types/api'
import { parseBarrierPercent } from './elsRiskCounts'

const LEVEL_MIN = 0
const LEVEL_MAX = 110

/** 구글 시트·GAS 기본 타임존과 맞춤 (날짜만 의미 있는 셀·JSON ISO 직렬화 오프셋 보정) */
const SHEET_TIME_ZONE = 'Asia/Seoul'

function getCalendarPartsInSheetTz(instant: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHEET_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = fmt.formatToParts(instant)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  return { y, m, d }
}

/** 시트에 보이는 그 날짜(연·월·일)의 시작을 +09:00 한 줄로 고정 (브라우저 로컬 TZ와 무관) */
function dateAtSheetCalendarDay(y: number, m: number, d: number): Date {
  return new Date(
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+09:00`
  )
}

function ymdKeyInSheetTz(date: Date): string {
  const { y, m, d } = getCalendarPartsInSheetTz(date)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return ''
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatYmdInSheetTz(date: Date): string {
  return ymdKeyInSheetTz(date)
}

/** 시트 타임존 기준 오늘과의 일수 (getDDay와 동일 부호 규칙) */
function getDDayInSheetTz(targetDate: Date): number | null {
  const now = new Date()
  const t0 = ymdKeyInSheetTz(now)
  const t1 = ymdKeyInSheetTz(targetDate)
  if (!t0 || !t1) return null
  const [y0, m0, d0] = t0.split('-').map(Number)
  const [y1, m1, d1] = t1.split('-').map(Number)
  const u0 = Date.UTC(y0, m0 - 1, d0)
  const u1 = Date.UTC(y1, m1 - 1, d1)
  return Math.round((u1 - u0) / 86400000)
}

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

/**
 * 시트·API에서 온 평가일 셀 → 시트 타임존(Asia/Seoul) 달력 날짜에 대응하는 Date.
 * GAS JSON이 `2026-03-27T15:00:00.000Z`(한국 3/28 자정)처럼 오면, `T` 앞만 자르면 하루 빨라지므로 전체 ISO를 파싱한 뒤 서울 달력으로 맞춤.
 */
export function parseElsListSheetDateCell(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const { y, m, d } = getCalendarPartsInSheetTz(raw)
    if (!Number.isFinite(y)) return null
    return dateAtSheetCalendarDay(y, m, d)
  }
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    if (Number.isInteger(raw) && raw > 35000 && raw < 65000) {
      const epoch = new Date((raw - 25569) * 86400 * 1000)
      if (!Number.isNaN(epoch.getTime())) {
        const { y, m, d } = getCalendarPartsInSheetTz(epoch)
        if (Number.isFinite(y)) return dateAtSheetCalendarDay(y, m, d)
      }
    }
  }
  const s = String(raw).trim()
  if (!s) return null

  // 전체 ISO 날짜시간 (앞 10자만 쓰면 UTC 날짜와 시트 날짜가 어긋남)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{4}-\d{2}-\d{2} \d/.test(s)) {
    const inst = new Date(s.replace(' ', 'T'))
    if (Number.isNaN(inst.getTime())) return null
    const { y, m, d } = getCalendarPartsInSheetTz(inst)
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
    return dateAtSheetCalendarDay(y, m, d)
  }

  // 날짜만 (시트에 보이는 그날 = 서울 달력)
  const dateOnly = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (dateOnly) {
    const y = Number(dateOnly[1])
    const m = Number(dateOnly[2])
    const d = Number(dateOnly[3])
    const x = dateAtSheetCalendarDay(y, m, d)
    const chk = getCalendarPartsInSheetTz(x)
    return chk.y === y && chk.m === m && chk.d === d ? x : null
  }

  const ko = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (ko) {
    const y = Number(ko[1])
    const m = Number(ko[2])
    const d = Number(ko[3])
    return dateAtSheetCalendarDay(y, m, d)
  }

  const head = s.split('T')[0]
  const iso = head.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    return dateAtSheetCalendarDay(y, m, d)
  }

  const compact = head.replace(/\D/g, '')
  if (compact.length === 8) {
    const y = Number(compact.slice(0, 4))
    const m = Number(compact.slice(4, 6))
    const d = Number(compact.slice(6, 8))
    return dateAtSheetCalendarDay(y, m, d)
  }

  return null
}

function parseSheetDate(raw: unknown): Date | null {
  return parseElsListSheetDateCell(raw)
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
    if (d) dates.push(d)
  }
  dates.sort((a, b) => a.getTime() - b.getTime())

  const todayKey = ymdKeyInSheetTz(new Date())
  let chosen: Date | null = null
  for (const d of dates) {
    const dk = ymdKeyInSheetTz(d)
    if (dk && todayKey && dk >= todayKey) {
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
    return { kind: 'date', chosen: parsed }
  }
  return { kind: 'raw', text: legacy }
}

function evalSortMetaForRow(row: ElsRow): { tier: 0 | 1 | 2; key: number } {
  const o = resolveChosenEvalOutcome(row)
  if (o.kind === 'none' || o.kind === 'raw') {
    return { tier: 2, key: 0 }
  }
  const dday = getDDayInSheetTz(o.chosen)
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
  const ymd = formatYmdInSheetTz(o.chosen)
  const dday = getDDayInSheetTz(o.chosen)
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
  return formatYmdInSheetTz(o.chosen)
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
