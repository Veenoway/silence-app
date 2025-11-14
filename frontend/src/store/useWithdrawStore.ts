import { create } from "zustand";
import { PendingWithdrawal } from "../hooks/useWithdrawalManager";

interface WithdrawalState {
  pendingWithdrawals: PendingWithdrawal[];
  setPendingWithdrawals: (pendingWithdrawals: PendingWithdrawal[]) => void;
  ping: boolean;
  triggerPing: () => void;
  resetPing: () => void;
}

export const useWithdrawalStore = create<WithdrawalState>((set) => ({
  pendingWithdrawals: [],
  setPendingWithdrawals: (pendingWithdrawals: PendingWithdrawal[]) =>
    set({ pendingWithdrawals }),
  ping: false,
  triggerPing: () => set({ ping: true }),
  resetPing: () => set({ ping: false }),
}));
