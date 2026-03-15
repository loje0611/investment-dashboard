import type { ElsRow } from '../types/api';
import { sortElsByDDayAsc } from '../utils/elsDDay';

export interface ElsDDayListProps {
  /** ELS 시트 데이터 배열 (다음 평가일 필드 포함) */
  items: ElsRow[];
  /** 리스트 제목 (선택) */
  title?: string;
  /** 상품명에 사용할 필드명. 기본 '상품명' */
  productNameKey?: string;
  /** 다음 평가일 필드명. 기본 '다음 평가일' */
  nextEvalDateKey?: string;
}

function formatDDay(dday: number | null): string {
  if (dday === null) return '-';
  if (dday > 0) return `D-${dday}`;
  if (dday < 0) return `D+${Math.abs(dday)}`;
  return 'D-Day';
}

function getProductName(row: ElsRow, key: string): string {
  const v = row[key];
  if (v == null) return '-';
  return String(v).trim() || '-';
}

export function ElsDDayList({
  items,
  title,
  productNameKey = '상품명',
  nextEvalDateKey = '다음 평가일',
}: ElsDDayListProps) {
  const sorted = sortElsByDDayAsc(items, nextEvalDateKey);

  return (
    <div className="w-full">
      {title && (
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      )}
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {sorted.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-500">
            ELS 데이터가 없습니다.
          </li>
        ) : (
          sorted.map(({ row, dday }, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">
                {getProductName(row, productNameKey)}
              </span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500">
                  다음 평가일: {String(row[nextEvalDateKey] ?? '-')}
                </span>
                <span
                  className={
                    dday !== null && dday <= 0
                      ? 'font-semibold text-gray-700'
                      : 'tabular-nums font-medium text-blue-600'
                  }
                >
                  {formatDDay(dday)}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
