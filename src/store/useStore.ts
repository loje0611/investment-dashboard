import { useMemo } from 'react';
import { create } from 'zustand';
import { fetchDashboardData } from '../api/api';
import type {
  TotalAssetRow,
  EtfSheetRow,
  PensionSheetRow,
  ElsRow,
  RebalancingTable,
  SheetDataRow,
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
  totalAssets: TotalAssetRow[];
  etfList: EtfSheetRow[];
  pensionList: PensionSheetRow[];
  rebalancing: RebalancingTable[];
  cashOther: SheetDataRow[];
  elsListSheetData: ElsRow[];
  summaryCards: import('../data/dashboardDummy').SummaryCardItem[];
  isLoading: boolean;
  isLoadingAssets: boolean;
  isLoadingRebalancing: boolean;
  error: string | null;
  hideAmounts: boolean;
}

export interface DashboardActions {
  fetchData: (endpoint?: string) => Promise<void>;
  fetchAssets: (endpoint?: string) => Promise<void>;
  fetchRebalancing: (endpoint?: string) => Promise<void>;
  clearError: () => void;
  setHideAmounts: (hide: boolean) => void;
}

const initialState: DashboardState = {
  totalAssets: [],
  etfList: [],
  pensionList: [],
  rebalancing: [],
  cashOther: [],
  elsListSheetData: [],
  summaryCards: [],
  isLoading: false,
  isLoadingAssets: false,
  isLoadingRebalancing: false,
  error: null,
  hideAmounts: false,
};

function applyDashboardPayload(
  data: import('../types/api').DashboardSheetResponse
): Partial<DashboardState> {
  return {
    totalAssets: data.totalAssets ?? [],
    etfList: data.etfList ?? [],
    pensionList: data.pensionList ?? [],
    rebalancing: data.rebalancing ?? [],
    cashOther: data.cashOther ?? [],
    elsListSheetData: data.elsListSheetData ?? [],
    summaryCards: data.summaryCards ?? [],
  };
}

export const useStore = create<DashboardState & DashboardActions>((set) => ({
  ...initialState,

  fetchData: async (endpoint) => {
    set({ isLoading: true, error: null, isLoadingAssets: true, isLoadingRebalancing: true });
    try {
      const data = await fetchDashboardData(endpoint, 'all');
      set({
        ...applyDashboardPayload(data),
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
        etfList: data.etfList ?? [],
        pensionList: data.pensionList ?? [],
        cashOther: data.cashOther ?? [],
        elsListSheetData: data.elsListSheetData ?? [],
        summaryCards: data.summaryCards ?? [],
        isLoadingAssets: false,
      });
    } catch {
      set({ isLoadingAssets: false });
    }
  },

  fetchRebalancing: async (endpoint) => {
    set({ isLoadingRebalancing: true });
    try {
      const data = await fetchDashboardData(endpoint, 'rebalancing');
      set({
        rebalancing: data.rebalancing ?? [],
        isLoadingRebalancing: false,
      });
    } catch {
      set({ isLoadingRebalancing: false });
    }
  },

  clearError: () => set({ error: null }),

  setHideAmounts: (hide) => set({ hideAmounts: hide }),
}));

/** @deprecated API에서 ELS(투자중) 시트를 내려주지 않음. 빈 배열 기준 변환만 수행합니다. */
export function useElsProducts(mapping?: AssetColumnMapping): ElsProduct[] {
  return useMemo(() => elsRowsToElsProducts([], mapping), [mapping]);
}

const ELS_TRY_MAPPINGS = [
  ELS_INVESTING_SHEET_MAPPING,
  ELS_SINGLE_PRICE_MAPPING,
  DEFAULT_ELS_ASSET_MAPPING,
];

/** @deprecated API에서 ELS(투자중) 시트를 내려주지 않음. */
export function useElsProductsWithMappings(): ElsProduct[] {
  return useMemo(() => elsRowsToElsProductsWithMappings([], ELS_TRY_MAPPINGS), []);
}

export function useElsListSheetProductsWithMappings(): ElsProduct[] {
  const elsListSheetData = useStore((s) => s.elsListSheetData);
  return useMemo(
    () => elsRowsToElsProductsWithMappings(elsListSheetData, ELS_TRY_MAPPINGS),
    [elsListSheetData]
  );
}
