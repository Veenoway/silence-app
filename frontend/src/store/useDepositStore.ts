import { create } from "zustand";
import { DepositEvent } from "../hooks/useRecentDeposits";

type DepositStore = {
  deposits: DepositEvent[];
  setDeposits: (deposits: DepositEvent[]) => void;
};

export const useDepositStore = create<DepositStore>((set) => ({
  deposits: [],
  setDeposits: (deposits: DepositEvent[]) => set({ deposits }),
}));
