"use client";

import { useEffect, useState } from "react";

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
  expiresAt: number; // timestamp when ready to claim
};

const STORAGE_KEY = "silentpool_pending_withdrawals";
const WITHDRAWAL_DELAY_SECONDS = 390; // 6m30

export const useWithdrawalManager = (chainId?: number) => {
  const [pendingWithdrawals, setPendingWithdrawals] = useState<
    PendingWithdrawal[]
  >([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const all = JSON.parse(stored) as PendingWithdrawal[];
        // Filter by chainId if provided
        const filtered = chainId
          ? all.filter((w) => w.chainId === chainId)
          : all;
        setPendingWithdrawals(filtered);
      }
    } catch (error) {
      console.error("Error loading pending withdrawals:", error);
    }
  }, [chainId]);

  // Save a new withdrawal
  const addWithdrawal = (withdrawal: Omit<PendingWithdrawal, "id">) => {
    const newWithdrawal: PendingWithdrawal = {
      ...withdrawal,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const stored = localStorage.getItem(STORAGE_KEY);
    const all = stored ? (JSON.parse(stored) as PendingWithdrawal[]) : [];
    all.push(newWithdrawal);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    setPendingWithdrawals((prev) => [...prev, newWithdrawal]);
    return newWithdrawal.id;
  };

  // Remove a withdrawal (after successful claim)
  const removeWithdrawal = (id: string) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const all = JSON.parse(stored) as PendingWithdrawal[];
    const filtered = all.filter((w) => w.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    setPendingWithdrawals((prev) => prev.filter((w) => w.id !== id));
  };

  // Get ready withdrawals (can be claimed now)
  const getReadyWithdrawals = () => {
    const now = Date.now();
    return pendingWithdrawals.filter((w) => w.expiresAt <= now);
  };

  // Get pending withdrawals (still waiting)
  const getPendingWithdrawals = () => {
    const now = Date.now();
    return pendingWithdrawals.filter((w) => w.expiresAt > now);
  };

  // Check if a note is already pending
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
