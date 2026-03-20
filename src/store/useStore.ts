import { useMemo } from 'react';
import { create } from 'zustand';
import { fetchDashboardData } from '../api/api';
import type {
  TotalAssetRow,
  PortfolioRow,
  EtfSheetRow,
  PensionSheetRow,
  ElsRow,
  RebalancingTable,
  SheetDataRow,
  ElsCompletedRow,
  ElsSheetTotals,
} from '../types/api';
import type { ElsProduct, AssetColumnMapping } from '../types/els';
import {
  elsRowsToElsProducts,
  elsRowsToElsProductsWithMappings,
  ELS_INVESTING_SHEET_MAPPING,
  ELS_SINGLE_PRICE_MAPPING,
  DEFAULT_ELS_ASSET_MAPPING,
} from '../utils/elsRowToProduct';

export interface DashboardState {
  /** 총자산 데이터 */
  totalAssets: TotalAssetRow[];
  /** 포트폴리오 데이터 (포트(New) 시트) */
  portfolio: PortfolioRow[];
  /** ETF 데이터 (ETF 시트, ETF 현황 탭 전용) */
  etf: EtfSheetRow[];
  /** 연금 데이터 (연금 시트, 연금 현황 탭 전용) */
  pension: PensionSheetRow[];
  /** 리밸런싱용 계좌별 표 (포트 Old/New 시트에서 파싱) */
  rebalancing: RebalancingTable[];
  /** ELS 데이터 */
  els: ElsRow[];
  /** 'ELS' 시트 B4·C4 요약 (없으면 null) */
  elsSheetTotals: ElsSheetTotals | null;
  /** ELS(완료) 시트 */
  elsCompleted: ElsCompletedRow[];
  /** 현금(기타) 시트 */
  cashOther: SheetDataRow[];
  /** 로딩 여부 (전체 또는 summary) */
  isLoading: boolean;
  /** 자산 상세(ELS/ETF/연금) 로딩 여부 */
  isLoadingAssets: boolean;
  /** 리밸런싱 데이터 로딩 여부 */
  isLoadingRebalancing: boolean;
  /** 에러 메시지 (없으면 null) */
  error: string | null;
  /** 홈 등에서 금액을 #으로 마스크 */
  hideAmounts: boolean;
}

export interface DashboardActions {
  /** 진입 시: 웹앱에서 전체 데이터(summary·assets·rebalancing)를 한 번에 조회 */
  fetchData: (endpoint?: string) => Promise<void>;
  /** 자산 상세용(els, etf, pension)만 조회 (탭 전용 또는 보강) */
  fetchAssets: (endpoint?: string) => Promise<void>;
  /** 리밸런싱용(portfolio, rebalancing)만 조회 (탭 전용 또는 보강) */
  fetchRebalancing: (endpoint?: string) => Promise<void>;
  /** 에러 상태 초기화 */
  clearError: () => void;
  setHideAmounts: (hide: boolean) => void;
}

const initialState: DashboardState = {
  totalAssets: [],
  portfolio: [],
  etf: [],
  pension: [],
  rebalancing: [],
  els: [],
  elsSheetTotals: null,
  elsCompleted: [],
  cashOther: [],
  isLoading: false,
  isLoadingAssets: false,
  isLoadingRebalancing: false,
  error: null,
  hideAmounts: false,
};

export const useStore = create<DashboardState & DashboardActions>((set) => ({
  ...initialState,

  fetchData: async (endpoint) => {
    set({ isLoading: true, error: null, isLoadingAssets: true, isLoadingRebalancing: true });
    try {
      const data = await fetchDashboardData(endpoint, 'all');
      set({
        totalAssets: data.totalAssets ?? [],
        portfolio: data.portfolio ?? [],
        rebalancing: data.rebalancing ?? [],
        etf: data.etf ?? [],
        pension: data.pension ?? [],
        els: data.els ?? [],
        elsSheetTotals: data.elsSheetTotals ?? null,
        elsCompleted: data.elsCompleted ?? [],
        cashOther: data.cashOther ?? [],
        isLoading: false,
        isLoadingAssets: false,
        isLoadingRebalancing: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.';
      set({
        isLoading: false,
        isLoadingAssets: false,
        isLoadingRebalancing: false,
        error: message,
      });
    }
  },

  fetchAssets: async (endpoint) => {
    set({ isLoadingAssets: true });
    try {
      const data = await fetchDashboardData(endpoint, 'assets');
      set({
        etf: data.etf ?? [],
        pension: data.pension ?? [],
        els: data.els ?? [],
        elsSheetTotals: data.elsSheetTotals ?? null,
        elsCompleted: data.elsCompleted ?? [],
        cashOther: data.cashOther ?? [],
        isLoadingAssets: false,
      });
    } catch (err) {
      set({ isLoadingAssets: false });
    }
  },

  fetchRebalancing: async (endpoint) => {
    set({ isLoadingRebalancing: true });
    try {
      const data = await fetchDashboardData(endpoint, 'rebalancing');
      set({
        portfolio: data.portfolio ?? [],
        rebalancing: data.rebalancing ?? [],
        isLoadingRebalancing: false,
      });
    } catch (err) {
      set({ isLoadingRebalancing: false });
    }
  },

  clearError: () => set({ error: null }),

  setHideAmounts: (hide) => set({ hideAmounts: hide }),
}));

/**
 * 스토어의 els(ElsRow[])를 ElsProduct[]로 변환해 반환합니다.
 * getWorstPerformer, ElsRiskProgressBar 등 ElsProduct 기반 로직에 사용하세요.
 * 시트 컬럼명이 기본값과 다르면 mapping을 넘겨주세요.
 */
export function useElsProducts(mapping?: AssetColumnMapping): ElsProduct[] {
  const els = useStore((s) => s.els);
  return useMemo(() => elsRowsToElsProducts(els, mapping), [els, mapping]);
}

/** ELS(투자중) 시트 등 컬럼명이 다양할 때 여러 매핑을 순서대로 시도합니다. */
const ELS_TRY_MAPPINGS = [
  ELS_INVESTING_SHEET_MAPPING,
  ELS_SINGLE_PRICE_MAPPING,
  DEFAULT_ELS_ASSET_MAPPING,
];

export function useElsProductsWithMappings(): ElsProduct[] {
  const els = useStore((s) => s.els);
  return useMemo(
    () => elsRowsToElsProductsWithMappings(els, ELS_TRY_MAPPINGS),
    [els]
  );
}
