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

const OVERRIDES_STORAGE_KEY = 'investment_dashboard_user_overrides_v2';

export interface UserOverrides {
  principals: Record<string, number>;
  holdings: Record<string, Record<string, { quantity: number; currentPrice: number }>>;
}

function loadUserOverrides(): UserOverrides {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load user overrides:', e);
  }
  return { principals: {}, holdings: {} };
}

function saveUserOverrides(overrides: UserOverrides) {
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save user overrides:', e);
  }
}

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
  userOverrides: UserOverrides;
}

export interface DashboardActions {
  fetchData: (endpoint?: string) => Promise<void>;
  clearError: () => void;
  setHideAmounts: (hide: boolean) => void;
  setDataSourceMode: (mode: DataSourceMode) => void;
  updateAccountPrincipal: (productName: string, newPrincipal: number) => void;
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
  userOverrides: loadUserOverrides(),
};

function applyDashboardPayload(
  data: import('../types/api').DashboardSheetResponse,
  overrides: UserOverrides
): Partial<DashboardState> {
  let etfList = data.etfList ?? [];
  let pensionList = data.pensionList ?? [];
  let rebalancing = data.rebalancing ?? [];

  // 1. 원금 오버라이드 적용
  if (Object.keys(overrides.principals).length > 0) {
    etfList = etfList.map((row) => {
      const name = String(row.상품명 || row.종목명 || row.이름 || '').trim();
      if (overrides.principals[name] !== undefined) {
        const principal = overrides.principals[name];
        const val = typeof row.평가금액 === 'number' ? row.평가금액 : parseFloat(String(row.평가금액 || row.평가금 || 0)) || 0;
        const returnRate = principal > 0 ? Math.round(((val - principal) / principal) * 100) : 0;
        return {
          ...row,
          투자원금: principal,
          원금: principal,
          수익률: returnRate,
        };
      }
      return row;
    });

    pensionList = pensionList.map((row) => {
      const name = String(row.상품명 || row.종목명 || row.이름 || '').trim();
      if (overrides.principals[name] !== undefined) {
        const principal = overrides.principals[name];
        const val = typeof row.평가금액 === 'number' ? row.평가금액 : parseFloat(String(row.평가금액 || row.평가금 || 0)) || 0;
        const returnRate = principal > 0 ? Math.round(((val - principal) / principal) * 100) : 0;
        return {
          ...row,
          투자원금: principal,
          원금: principal,
          수익률: returnRate,
        };
      }
      return row;
    });
  }

  // 2. 보유 수량/단가 오버라이드 적용
  if (Object.keys(overrides.holdings).length > 0) {
    rebalancing = rebalancing.map((table) => {
      const accKey = Object.keys(overrides.holdings).find(
        (k) => k.trim().toLowerCase() === table.accountLabel.trim().toLowerCase()
      );
      if (accKey) {
        const accHoldings = overrides.holdings[accKey];
        const updatedRows = table.rows.map((r) => {
          const sName = String(r.종목명 || '').trim();
          if (accHoldings[sName]) {
            const { quantity, currentPrice } = accHoldings[sName];
            return {
              ...r,
              보유수량: quantity,
              현재가: currentPrice,
              평가금액: quantity * currentPrice,
            };
          }
          return r;
        });
        return { ...table, rows: updatedRows };
      }
      return table;
    });
  }

  return {
    totalAssets: data.totalAssets ?? [],
    etfList,
    pensionList,
    rebalancing,
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

      const overrides = get().userOverrides;

      set({
        ...applyDashboardPayload(data, overrides),
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

  updateAccountPrincipal: (productName, newPrincipal) => {
    const state = get();
    const cleanName = productName.trim();
    const updatedOverrides = {
      ...state.userOverrides,
      principals: {
        ...state.userOverrides.principals,
        [cleanName]: newPrincipal,
      },
    };

    saveUserOverrides(updatedOverrides);

    const updatedEtf = state.etfList.map((row) => {
      const name = String(row.상품명 || row.종목명 || row.이름 || '').trim();
      if (name === cleanName || name.includes(cleanName) || cleanName.includes(name)) {
        const val = typeof row.평가금액 === 'number' ? row.평가금액 : parseFloat(String(row.평가금액 || 0)) || 0;
        const returnRate = newPrincipal > 0 ? Math.round(((val - newPrincipal) / newPrincipal) * 100) : 0;
        return {
          ...row,
          투자원금: newPrincipal,
          원금: newPrincipal,
          수익률: returnRate,
        };
      }
      return row;
    });

    const updatedPension = state.pensionList.map((row) => {
      const name = String(row.상품명 || row.종목명 || row.이름 || '').trim();
      if (name === cleanName || name.includes(cleanName) || cleanName.includes(name)) {
        const val = typeof row.평가금액 === 'number' ? row.평가금액 : parseFloat(String(row.평가금액 || 0)) || 0;
        const returnRate = newPrincipal > 0 ? Math.round(((val - newPrincipal) / newPrincipal) * 100) : 0;
        return {
          ...row,
          투자원금: newPrincipal,
          원금: newPrincipal,
          수익률: returnRate,
        };
      }
      return row;
    });

    set({
      userOverrides: updatedOverrides,
      etfList: updatedEtf,
      pensionList: updatedPension,
    });
  },

  updateAccountHolding: (accountLabel, stockName, quantity, currentPrice) => {
    const state = get();
    const newValuation = quantity * currentPrice;
    const cleanAcc = accountLabel.trim();
    const cleanStock = stockName.trim();

    const accHoldings = state.userOverrides.holdings[cleanAcc] || {};
    const updatedOverrides = {
      ...state.userOverrides,
      holdings: {
        ...state.userOverrides.holdings,
        [cleanAcc]: {
          ...accHoldings,
          [cleanStock]: { quantity, currentPrice },
        },
      },
    };

    saveUserOverrides(updatedOverrides);

    const updatedRebalancing = state.rebalancing.map((table) => {
      if (table.accountLabel.trim().toLowerCase() === cleanAcc.toLowerCase()) {
        const updatedRows = table.rows.map((row) => {
          const rowStockName = String(row.종목명 || '').trim();
          if (rowStockName === cleanStock) {
            return {
              ...row,
              보유수량: quantity,
              현재가: currentPrice,
              평가금액: newValuation,
            };
          }
          return row;
        });

        const exists = updatedRows.some((r) => String(r.종목명 || '').trim() === cleanStock);
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

    set({
      userOverrides: updatedOverrides,
      rebalancing: updatedRebalancing,
    });
  },

  applyAiRebalancingPlan: (accountLabel, aiActions) => {
    const state = get();
    const buyActions = aiActions.filter((a) => a.action === 'BUY' && (a.shares > 0 || a.amount > 0));
    if (buyActions.length === 0) return;

    const cleanAcc = accountLabel.trim();
    const accHoldings = { ...(state.userOverrides.holdings[cleanAcc] || {}) };

    const updatedRebalancing = state.rebalancing.map((table) => {
      if (table.accountLabel.trim().toLowerCase() === cleanAcc.toLowerCase()) {
        const updatedRows = [...table.rows];

        buyActions.forEach((act) => {
          const cleanStock = act.stockName.trim();
          const idx = updatedRows.findIndex((r) => String(r.종목명 || '').trim() === cleanStock);
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

            accHoldings[cleanStock] = { quantity: newQty, currentPrice: price };
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

            accHoldings[cleanStock] = { quantity: act.shares || 1, currentPrice: price };
          }
        });

        return { ...table, rows: updatedRows };
      }
      return table;
    });

    const updatedOverrides = {
      ...state.userOverrides,
      holdings: {
        ...state.userOverrides.holdings,
        [cleanAcc]: accHoldings,
      },
    };

    saveUserOverrides(updatedOverrides);

    set({
      userOverrides: updatedOverrides,
      rebalancing: updatedRebalancing,
    });
  },
}));
