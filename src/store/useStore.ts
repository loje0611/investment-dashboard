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

export interface DashboardState {
  totalAssets: TotalAssetRow[];
  etfList: EtfSheetRow[];
  pensionList: PensionSheetRow[];
  rebalancing: RebalancingTable[];
  cashOther: SheetDataRow[];
  elsListSheetData: ElsRow[];
  summaryCards: import('../types/dashboard').SummaryCardItem[];
  isLoading: boolean;
  isLoadingAssets: boolean;
  isLoadingRebalancing: boolean;
  error: string | null;
  hideAmounts: boolean;
}

export interface DashboardActions {
  fetchData: (endpoint?: string) => Promise<void>;
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

  clearError: () => set({ error: null }),

  setHideAmounts: (hide) => set({ hideAmounts: hide }),
}));
