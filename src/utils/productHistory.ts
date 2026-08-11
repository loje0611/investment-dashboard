import etfHistoryCsvText from '../data/etf_history.csv?raw';
import pensionHistoryCsvText from '../data/pension_history.csv?raw';

export type ProductHistoryKind = 'ETF' | 'PENSION';

interface ProductHistoryPoint {
  date: Date;
  ratePercent: number;
}

/** RFC 4180 스타일 CSV 파서 (localCsvApi와 동일) */
function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && i + 1 < line.length && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    result.push(row);
  }

  return result;
}

function parseDateValue(raw: string): Date | null {
  const s = raw.trim().split('T')[0];
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** 수익률은 퍼센트 단위로 저장되어 있으므로 그대로 반올림만 수행 */
function toRatePercent(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, '').replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function buildHistoryMap(csvText: string): Map<string, ProductHistoryPoint[]> {
  const rows = parseCsv(csvText);
  const map = new Map<string, ProductHistoryPoint[]>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;
    const name = r[0].trim();
    const date = parseDateValue(r[1]);
    if (!name || !date) continue;
    const ratePercent = toRatePercent(r[2]);
    const list = map.get(name) ?? [];
    list.push({ date, ratePercent });
    map.set(name, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return map;
}

let etfHistoryMap: Map<string, ProductHistoryPoint[]> | null = null;
let pensionHistoryMap: Map<string, ProductHistoryPoint[]> | null = null;

function getHistoryMap(type: ProductHistoryKind): Map<string, ProductHistoryPoint[]> {
  if (type === 'ETF') {
    if (!etfHistoryMap) etfHistoryMap = buildHistoryMap(etfHistoryCsvText);
    return etfHistoryMap;
  }
  if (!pensionHistoryMap) pensionHistoryMap = buildHistoryMap(pensionHistoryCsvText);
  return pensionHistoryMap;
}

function pointsForProduct(productName: string, type: ProductHistoryKind): ProductHistoryPoint[] {
  const map = getHistoryMap(type);
  return map.get(productName.trim()) ?? [];
}

/** 상품별 전체 수익률 이력 [날짜(yyyy-MM-dd), 수익률(%)] */
export function getProductHistorySeries(
  productName: string,
  type: ProductHistoryKind
): [string, number][] {
  return pointsForProduct(productName, type).map((p) => [
    p.date.toISOString().split('T')[0],
    p.ratePercent,
  ]);
}

/** 스파크라인용 최근 N개월(또는 N개 평가일) 수익률(%) 배열 */
export function getProductSparklineData(
  productName: string,
  type: ProductHistoryKind,
  limit = 6
): number[] {
  const points = pointsForProduct(productName, type);
  if (points.length === 0) return [];
  const slice = points.slice(-limit);
  return slice.map((p) => p.ratePercent);
}
