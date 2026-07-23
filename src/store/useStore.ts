import { create } from 'zustand';
import { fetchDashboardData } from '../api/api';
import { fetchLocalCsvDashboardData } from '../api/localCsvApi';
import type {
  TotalAssetRow,
  EtfSheetRow,
  PensionSheetRow,
  ElsRow,
  RebalancingTable,
  SheetDataRow,
} from '../types/api';
import type { RebalancingActionItem } from '../services/aiRebalancingService';

export type DataSourceMode = 'local' | 'gas';

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
  dataSourceMode: DataSourceMode;
}

export interface DashboardActions {
  fetchData: (endpoint?: string) => Promise<void>;
  clearError: () => void;
  setHideAmounts: (hide: boolean) => void;
  setDataSourceMode: (mode: DataSourceMode) => void;
  updateAccountHolding: (
    accountLabel: string,
    stockName: string,
    quantity: number,
    currentPrice: number
  ) => void;
  applyAiRebalancingPlan: (
    accountLabel: string,
    actions: RebalancingActionItem[]
  ) => void;
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
  dataSourceMode: 'local',
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

export const useStore = create<DashboardState & DashboardActions>((set, get) => ({
  ...initialState,

  fetchData: async (endpoint) => {
    set({ isLoading: true, error: null, isLoadingAssets: true, isLoadingRebalancing: true });
    try {
      const mode = get().dataSourceMode;
      const data =
        mode === 'local'
          ? await fetchLocalCsvDashboardData()
          : await fetchDashboardData(endpoint, 'all');

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

  setDataSourceMode: (mode) => {
    set({ dataSourceMode: mode });
    get().fetchData();
  },

  updateAccountHolding: (accountLabel, stockName, quantity, currentPrice) => {
    const state = get();
    const newValuation = quantity * currentPrice;

    const updatedRebalancing = state.rebalancing.map((table) => {
      if (table.accountLabel.trim().toLowerCase() === accountLabel.trim().toLowerCase()) {
        const updatedRows = table.rows.map((row) => {
          const rowStockName = String(row.종목명 || '').trim();
          if (rowStockName === stockName.trim()) {
            return {
              ...row,
              보유수량: quantity,
              현재가: currentPrice,
              평가금액: newValuation,
            };
          }
          return row;
        });

        const exists = updatedRows.some((r) => String(r.종목명 || '').trim() === stockName.trim());
        if (!exists) {
          updatedRows.push({
            계좌명: accountLabel,
            종목명: stockName,
            보유수량: quantity,
            현재가: currentPrice,
            평가금액: newValuation,
            현재비중: 0.1,
            목표비중: 0.1,
          });
        }
        return { ...table, rows: updatedRows };
      }
      return table;
    });

    set({ rebalancing: updatedRebalancing });
  },

  applyAiRebalancingPlan: (accountLabel, aiActions) => {
    const state = get();
    const buyActions = aiActions.filter((a) => a.action === 'BUY' && (a.shares > 0 || a.amount > 0));
    if (buyActions.length === 0) return;

    const updatedRebalancing = state.rebalancing.map((table) => {
      if (table.accountLabel.trim().toLowerCase() === accountLabel.trim().toLowerCase()) {
        const updatedRows = [...table.rows];

        buyActions.forEach((act) => {
          const idx = updatedRows.findIndex((r) => String(r.종목명 || '').trim() === act.stockName.trim());
          if (idx >= 0) {
            const row = updatedRows[idx];
            const oldQty = typeof row.보유수량 === 'number' ? row.보유수량 : parseFloat(String(row.보유수량 || 0)) || 0;
            const oldPrice = typeof row.현재가 === 'number' ? row.현재가 : parseFloat(String(row.현재가 || 0)) || 0;
            const oldValuation = typeof row.평가금액 === 'number' ? row.평가금액 : parseFloat(String(row.평가금액 || 0)) || 0;

            const addShares = act.shares > 0 ? act.shares : 0;
            const newQty = oldQty + addShares;
            const price = oldPrice > 0 ? oldPrice : act.amount / (addShares || 1);
            const newValuation = oldValuation + act.amount;

            updatedRows[idx] = {
              ...row,
              보유수량: newQty,
              현재가: price,
              평가금액: newValuation,
            };
          } else {
            const price = act.amount / (act.shares || 1);
            updatedRows.push({
              계좌명: accountLabel,
              종목명: act.stockName,
              보유수량: act.shares || 1,
              현재가: price,
              평가금액: act.amount,
              현재비중: 0.1,
              목표비중: act.targetWeight / 100,
            });
          }
        });

        return { ...table, rows: updatedRows };
      }
      return table;
    });

    set({ rebalancing: updatedRebalancing });
  },
}));
