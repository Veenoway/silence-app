"use client";

import { useEffect } from "react";
import { useWithdrawalStore } from "../store/useWithdrawStore";

export type PendingWithdrawal = {
  id: string;
  requestId: number;
  noteString: string;
  recipient: string;
  requestTimestamp: number;
  chainId: number;
  tokenSymbol: string;
  amount: string;
  poolId: number;
  expiresAt: number;
};

const STORAGE_KEY = "silentpool_pending_withdrawals";

export const useWithdrawalManager = (chainId?: number) => {
  const {
    pendingWithdrawals,
    setPendingWithdrawals,
    addPendingWithdrawal,
    removePendingWithdrawal,
  } = useWithdrawalStore();

  useEffect(() => {
    const loadWithdrawals = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const all = JSON.parse(stored) as PendingWithdrawal[];
          const filtered = chainId
            ? all.filter((w) => w.chainId === chainId)
            : all;

          setPendingWithdrawals(filtered);
        }
      } catch (error) {
        console.error("Error loading pending withdrawals:", error);
      }
    };

    loadWithdrawals();
  }, [chainId, setPendingWithdrawals]);

  const addWithdrawal = (withdrawal: Omit<PendingWithdrawal, "id">) => {
    const newWithdrawal: PendingWithdrawal = {
      ...withdrawal,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const stored = localStorage.getItem(STORAGE_KEY);
    const all = stored ? (JSON.parse(stored) as PendingWithdrawal[]) : [];

    const exists = all.some(
      (w) =>
        w.requestId === newWithdrawal.requestId || w.id === newWithdrawal.id
    );

    if (exists) {
      return newWithdrawal.id;
    }

    all.push(newWithdrawal);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    addPendingWithdrawal(newWithdrawal);

    return newWithdrawal.id;
  };

  const removeWithdrawal = (id: string) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    const all = JSON.parse(stored) as PendingWithdrawal[];

    const filtered = all.filter((w) => {
      const matches = w.id === id || w.requestId.toString() === id;
      if (matches) {
        console.log("🎯 Found match to remove:", w);
      }
      return !matches;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    removePendingWithdrawal(id);
  };

  const getReadyWithdrawals = () => {
    const now = Date.now();
    return pendingWithdrawals.filter((w) => w.expiresAt <= now);
  };

  const getPendingWithdrawals = () => {
    const now = Date.now();
    return pendingWithdrawals.filter((w) => w.expiresAt > now);
  };

  const isNotePending = (noteString: string): boolean => {
    return pendingWithdrawals.some((w) => w.noteString === noteString);
  };

  return {
    pendingWithdrawals,
    addWithdrawal,
    removeWithdrawal,
    getReadyWithdrawals,
    getPendingWithdrawals,
    isNotePending,
  };
};
