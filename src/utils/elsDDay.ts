const NEXT_EVAL_DATE_KEY = '다음 평가일';

/**
 * 'YYYY.MM.DD' 형식 문자열을 Date로 파싱합니다.
 * @returns 파싱 성공 시 Date, 실패 시 null
 */
export function parseNextEvalDateString(dateStr: string | null | undefined): Date | null {
  if (dateStr == null || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * 오늘 날짜(자정 기준)와 목표일 사이의 일수(D-Day)를 계산합니다.
 * D-Day > 0: 미래일(남은 일수), D-Day < 0: 과거일, 0: 오늘
 */
export function getDDay(targetDate: Date | null): number | null {
  if (!targetDate) return null;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetStart = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  );
  const diffMs = targetStart.getTime() - todayStart.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * ELS 행에서 '다음 평가일' 필드를 읽어 D-Day를 계산합니다.
 */
export function getDDayFromElsRow(row: { [key: string]: string | number | boolean | null | undefined }): number | null {
  const raw = row[NEXT_EVAL_DATE_KEY];
  const str = typeof raw === 'string' ? raw : raw != null ? String(raw) : null;
  const date = parseNextEvalDateString(str);
  return getDDay(date);
}

/**
 * ELS 행 배열을 '다음 평가일' 기준 D-Day 오름차순으로 정렬합니다.
 * D-Day가 가장 적게 남은(곧 다가오는) 항목이 앞에 옵니다.
 */
export function sortElsByDDayAsc<T extends Record<string, unknown>>(
  rows: T[],
  dateKey: string = NEXT_EVAL_DATE_KEY
): Array<{ row: T; dday: number | null }> {
  const withDDay = rows.map((row) => {
    const raw = row[dateKey];
    const str = typeof raw === 'string' ? raw : raw != null ? String(raw) : null;
    const date = parseNextEvalDateString(str);
    const dday = getDDay(date);
    return { row, dday };
  });
  withDDay.sort((a, b) => {
    const da = a.dday ?? Infinity;
    const db = b.dday ?? Infinity;
    return da - db;
  });
  return withDDay;
}

export { NEXT_EVAL_DATE_KEY };
