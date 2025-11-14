"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useWithdrawalManager } from "../hooks/useWithdrawalManager";

/**
 * Badge component to show pending withdrawals count in navbar
 *
 * Usage:
 * <WithdrawalBadge onClick={() => router.push("/withdraw")} />
 */
export function WithdrawalBadge({ onClick }: { onClick?: () => void }) {
  const { chain } = useAccount();
  const { getReadyWithdrawals, getPendingWithdrawals } = useWithdrawalManager(
    chain?.id
  );

  const [readyCount, setReadyCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Update counts every second
  useEffect(() => {
    const updateCounts = () => {
      setReadyCount(getReadyWithdrawals().length);
      setPendingCount(getPendingWithdrawals().length);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 1000);

    return () => clearInterval(interval);
  }, [getReadyWithdrawals, getPendingWithdrawals]);

  if (readyCount === 0 && pendingCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red/10 hover:bg-white/20 transition-colors border border-white/20 group"
      title={`${readyCount} ready, ${pendingCount} pending`}
    >
      {/* Icon */}
      <div className="text-xl">{readyCount > 0 ? "💰" : "⏳"}</div>

      {/* Text */}
      <div className="flex flex-col items-start text-xs">
        {readyCount > 0 && (
          <span className="text-green-400 font-bold">{readyCount} Ready</span>
        )}
        {pendingCount > 0 && (
          <span className="text-yellow-400">{pendingCount} Pending</span>
        )}
      </div>

      {/* Animated dot for ready withdrawals */}
      {readyCount > 0 && (
        <div className="absolute -top-1 -right-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block">
        <div className="bg-black border border-white/20 rounded px-3 py-2 text-white text-xs whitespace-nowrap">
          {readyCount > 0 && (
            <div className="text-green-400">
              ✅ {readyCount} withdrawal{readyCount > 1 ? "s" : ""} ready to
              claim
            </div>
          )}
          {pendingCount > 0 && (
            <div className="text-yellow-400 mt-1">
              ⏳ {pendingCount} withdrawal{pendingCount > 1 ? "s" : ""} waiting
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Minimal badge version for space-constrained areas
 */
export function WithdrawalBadgeMinimal({ onClick }: { onClick?: () => void }) {
  const { chain } = useAccount();
  const { getReadyWithdrawals, pendingWithdrawals } = useWithdrawalManager(
    chain?.id
  );

  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      setReadyCount(getReadyWithdrawals().length);
    };

    updateCount();
    const interval = setInterval(updateCount, 1000);

    return () => clearInterval(interval);
  }, [getReadyWithdrawals]);

  const totalCount = pendingWithdrawals.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
      title={`${totalCount} pending withdrawal${totalCount > 1 ? "s" : ""}`}
    >
      <span className="text-lg">{readyCount > 0 ? "💰" : "⏳"}</span>

      {/* Count badge */}
      {totalCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {totalCount}
        </span>
      )}

      {/* Animated pulse for ready */}
      {readyCount > 0 && (
        <span className="absolute -top-1 -right-1">
          <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-green-400 opacity-75"></span>
        </span>
      )}
    </button>
  );
}
