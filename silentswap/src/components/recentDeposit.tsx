"use client";

import { useState } from "react";
import { LuLock } from "react-icons/lu";
import { useRecentDeposits } from "../hooks/useRecentDeposits";

type RecentDepositsProps = {
  silentPoolAddress: `0x${string}`;
  poolId?: number;
  maxResults?: number;
  showAutoRefresh?: boolean;
};

export function RecentDeposits({
  silentPoolAddress,
  poolId,
  maxResults = 10,
  showAutoRefresh = true,
}: RecentDepositsProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { deposits, isLoading, error, refetch } = useRecentDeposits({
    silentPoolAddress,
    poolId,
    maxResults,
    autoRefresh,
    refreshInterval: 30, // 30 seconds
  });

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getExplorerUrl = (txHash: string) => {
    // Adjust based on your chain
    return `https://etherscan.io/tx/${txHash}`;
  };

  return (
    <div className="w-full mt-2">
      {/* Loading State */}
      {isLoading && deposits.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center h-[140px]">
          <p className="text-white/60">Loading deposits...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && deposits.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center text-center h-[140px]">
          <h4 className="text-xl font-bold text-white mb-2">No Deposits Yet</h4>
          <p className="text-white/60">
            Deposits will appear here as they happen
          </p>
        </div>
      )}

      {/* Deposits List */}
      {deposits.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {deposits
            .filter((deposit, index) => index < 6)
            .map((deposit, index) => (
              <DepositCard
                key={`${deposit.txHash}-${index}`}
                deposit={deposit}
                index={index}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// Individual Deposit Card
function DepositCard({
  deposit,
  index,
}: {
  deposit: DepositEvent;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://etherscan.io/tx/${txHash}`;
  };

  return (
    <div
      className={`overflow-hidden p-2 border border-white/60 hover:bg-white/10 transition-colors`}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-1 cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <LuLock size={16} />
            <div className="font-bold text-white ml-2">
              #{deposit.leadIndex.toString()}
            </div>
          </div>
          <div className="text-white text-sm ml-6">
            {formatTimestamp(deposit.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
