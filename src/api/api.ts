import axios from 'axios';
import type { SheetDataRow } from '../types/api';
import type { DashboardSheetResponse } from '../types/api';
import { isGasErrorResponse } from '../types/api';

/** 환경 변수 또는 기본값. .env에 VITE_WEB_APP_URL 설정 권장 */
const getDefaultWebAppUrl = (): string =>
  import.meta.env.VITE_WEB_APP_URL ?? '';

/**
 * Google Apps Script 웹앱에 GET 요청을 보내고, JSON 배열 데이터를
 * 지정한 타입의 배열로 반환하는 비동기 함수입니다.
 *
 * @param endpoint - Web App URL (미입력 시 VITE_WEB_APP_URL 사용)
 * @returns 타입에 맞춘 데이터 배열
 * @throws GAS에서 error 객체를 반환하면 해당 메시지로 에러 throw
 * @throws 네트워크/axios 에러 시 그대로 throw
 */
export async function fetchSheetData<T extends SheetDataRow = SheetDataRow>(
  endpoint?: string
): Promise<T[]> {
  const url = endpoint ?? getDefaultWebAppUrl();
  if (!url) throw new Error('VITE_WEB_APP_URL이 설정되지 않았습니다. .env 파일을 확인하세요.');
  const { data } = await axios.get<unknown>(url, {
    timeout: 15000,
    headers: {
      Accept: 'application/json',
    },
  });

  if (isGasErrorResponse(data)) {
    throw new Error(data.error);
  }

  if (!Array.isArray(data)) {
    throw new Error('응답이 배열이 아닙니다.');
  }

  return data as T[];
}

export type DashboardDataKind = 'summary' | 'assets' | 'rebalancing' | 'all';

/**
 * 대시보드 데이터를 타입별로 가져옵니다.
 * - summary: 총자산만 (홈용, 가장 빠름)
 * - assets: els, etf, pension (자산 상세용)
 * - rebalancing: portfolio, rebalancing (리밸런싱용)
 * - all: 전체 (기존 동작)
 *
 * @param endpoint - Web App URL (미입력 시 VITE_WEB_APP_URL 사용)
 * @param kind - 조회할 데이터 종류 (기본 'all')
 */
export async function fetchDashboardData(
  endpoint?: string,
  kind: DashboardDataKind = 'all'
): Promise<DashboardSheetResponse> {
  const baseUrl = endpoint ?? getDefaultWebAppUrl();
  if (!baseUrl) throw new Error('VITE_WEB_APP_URL이 설정되지 않았습니다. .env 파일을 확인하세요.');
  if (baseUrl.endsWith('/dev')) {
    throw new Error(
      '웹앱 URL이 /dev(테스트 배포)입니다. CORS 오류가 발생합니다. 배포 > 새 배포에서 URL을 복사해 /exec 로 끝나는 주소를 .env에 넣으세요.'
    );
  }

  const url = kind === 'all' ? baseUrl : `${baseUrl}?data=${kind}`;
  const { data } = await axios.get<unknown>(url, {
    timeout: 30000,
    headers: { Accept: 'application/json' },
  });

  if (isGasErrorResponse(data)) {
    throw new Error(data.error);
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('응답이 객체가 아닙니다.');
  }

  return data as DashboardSheetResponse;
}
