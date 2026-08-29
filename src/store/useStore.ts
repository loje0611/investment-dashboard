import { create } from 'zustand';
import { fetchLocalCsvDashboardData } from '../api/localCsvApi';
import type {
  TotalAssetRow,
  EtfSheetRow,
  PensionSheetRow,
  CashSheetRow,
  RebalancingTable,
} from '../types/api';

export interface DashboardState {
  totalAssets: TotalAssetRow[];
  etfList: EtfSheetRow[];
  pensionList: PensionSheetRow[];
  cashList: CashSheetRow[];
  rebalancing: RebalancingTable[];
  isLoading: boolean;
  isLoadingAssets: boolean;
  isLoadingRebalancing: boolean;
  error: string | null;
}

export interface DashboardActions {
  fetchData: (endpoint?: string) => Promise<void>;
  clearError: () => void;
}

const initialState: DashboardState = {
  totalAssets: [],
  etfList: [],
  pensionList: [],
  cashList: [],
  rebalancing: [],
  isLoading: false,
  isLoadingAssets: false,
  isLoadingRebalancing: false,
  error: null,
};

export const useStore = create<DashboardState & DashboardActions>((set) => ({
  ...initialState,

  fetchData: async () => {
    set({ isLoading: true, error: null, isLoadingAssets: true, isLoadingRebalancing: true });
    try {
      const data = await fetchLocalCsvDashboardData();

      set({
        ...data,
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

  clearError: () => set({ error: null }),
}));
