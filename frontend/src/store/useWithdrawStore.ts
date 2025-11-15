import { create } from "zustand";
import { PendingWithdrawal } from "../hooks/useWithdrawalManager";

interface WithdrawalState {
  pendingWithdrawals: PendingWithdrawal[];
  setPendingWithdrawals: (
    pendingWithdrawals:
      | PendingWithdrawal[]
      | ((current: PendingWithdrawal[]) => PendingWithdrawal[])
  ) => void;
  addPendingWithdrawal: (withdrawal: PendingWithdrawal) => void;
  removePendingWithdrawal: (id: string) => void;
  ping: boolean;
  triggerPing: () => void;
  resetPing: () => void;
}

export const useWithdrawalStore = create<WithdrawalState>((set, get) => ({
  pendingWithdrawals: [],

  setPendingWithdrawals: (pendingWithdrawals) =>
    set((state) => ({
      pendingWithdrawals:
        typeof pendingWithdrawals === "function"
          ? pendingWithdrawals(state.pendingWithdrawals)
          : pendingWithdrawals,
    })),

  addPendingWithdrawal: (withdrawal) =>
    set((state) => {
      const exists = state.pendingWithdrawals.some(
        (w) => w.id === withdrawal.id || w.requestId === withdrawal.requestId
      );

      if (exists) {
        console.log("⚠️ Withdrawal already in store, skipping");
        return state;
      }

      console.log("➕ Adding to store:", withdrawal.requestId);
      return {
        pendingWithdrawals: [...state.pendingWithdrawals, withdrawal],
      };
    }),

  removePendingWithdrawal: (id) =>
    set((state) => {
      const before = state.pendingWithdrawals.length;

      const filtered = state.pendingWithdrawals.filter((w) => {
        const idMatch = w.id === id;
        const requestIdMatch = w.requestId.toString() === id;
        const shouldRemove = idMatch || requestIdMatch;

        if (shouldRemove) {
        }

        return !shouldRemove;
      });

      const after = filtered.length;
      console.log(`Store: ${before} → ${after} withdrawals`);

      return {
        pendingWithdrawals: filtered,
      };
    }),

  ping: false,
  triggerPing: () => set({ ping: true }),
  resetPing: () => set({ ping: false }),
}));
