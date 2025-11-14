"use client";

import { useEffect, useState } from "react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import type { PendingWithdrawal } from "../hooks/useWithdrawalManager";
import { useWithdrawalManager } from "../hooks/useWithdrawalManager";
import { getTokenSymbol } from "../utils/withdraw";

type PendingWithdrawalsProps = {
  // Hook functions from useSilenceWithdraw
  fulfillWithdrawal: (requestId: number) => Promise<boolean>;
  getWithdrawalRequest: (requestId: number) => Promise<{
    requestTimestamp: bigint;
    fulfilled: boolean;
    timeUntilWithdrawal: bigint;
  } | null>;
  isWithdrawing: boolean;
  onSuccess?: () => void;
};

const WITHDRAWAL_DELAY = 390; // 6m30s

export function PendingWithdrawals({
  fulfillWithdrawal,
  getWithdrawalRequest,
  isWithdrawing,
  onSuccess,
}: PendingWithdrawalsProps) {
  const { chain } = useAccount();

  const {
    pendingWithdrawals,
    removeWithdrawal,
    getReadyWithdrawals,
    getPendingWithdrawals,
  } = useWithdrawalManager(chain?.id);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Force re-render for timer updates
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Notify when withdrawals become ready
  useEffect(() => {
    const ready = getReadyWithdrawals();
    if (ready.length > 0) {
      toast.success(`🎉 ${ready.length} withdrawal(s) ready to claim!`, {
        duration: 10000,
      });
    }
  }, []);

  // Handle claim
  const handleClaim = async (withdrawal: PendingWithdrawal) => {
    const success = await fulfillWithdrawal(withdrawal.requestId);

    if (success) {
      removeWithdrawal(withdrawal.id);
      toast.success("🎉 Withdrawal claimed successfully!");
      if (onSuccess) onSuccess();
    }
  };

  // Format time remaining
  const getTimeRemaining = (expiresAt: number): string => {
    const now = Date.now();
    const diff = Math.max(0, expiresAt - now);
    const seconds = Math.floor(diff / 1000);

    if (seconds === 0) return "Ready!";

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const readyWithdrawals = getReadyWithdrawals();
  const pendingWithdrawalsFiltered = getPendingWithdrawals();

  return (
    <div className="w-full space-y-6 border border-white/80 p-6 max-w-[440px] h-fit">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 -mt-2">
        <h2 className="text-2xl font-bold text-white font-syne">
          Your Withdrawals
        </h2>
        {pendingWithdrawals.length > 0 && (
          <span className="px-3 py-1 bg-white text-black text-base font-medium">
            {pendingWithdrawals.length} pending
          </span>
        )}
      </div>

      {/* Ready to Claim */}
      {readyWithdrawals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Ready to Claim ({readyWithdrawals.length})
          </h3>
          {readyWithdrawals.map((withdrawal) => (
            <WithdrawalCard
              key={withdrawal.id}
              withdrawal={withdrawal}
              status="ready"
              onClaim={() => handleClaim(withdrawal)}
              isProcessing={isWithdrawing}
              isExpanded={expandedId === withdrawal.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === withdrawal.id ? null : withdrawal.id
                )
              }
              timeRemaining={getTimeRemaining(withdrawal.expiresAt)}
            />
          ))}
        </div>
      )}

      {/* Still Pending */}
      {pendingWithdrawalsFiltered.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Waiting ({pendingWithdrawalsFiltered.length})
          </h3>
          {pendingWithdrawalsFiltered.map((withdrawal) => (
            <WithdrawalCard
              key={withdrawal.id}
              withdrawal={withdrawal}
              status="pending"
              isProcessing={false}
              isExpanded={expandedId === withdrawal.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === withdrawal.id ? null : withdrawal.id
                )
              }
              timeRemaining={getTimeRemaining(withdrawal.expiresAt)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {pendingWithdrawals.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-bold text-white mb-2">
            No Pending Withdrawals
          </h3>
          <p className="text-white/60 text-sm mb-6">
            Withdrawals you start will appear here
          </p>
        </div>
      )}
    </div>
  );
}

// Withdrawal Card Component
type WithdrawalCardProps = {
  withdrawal: PendingWithdrawal;
  status: "ready" | "pending";
  onClaim?: () => void;
  isProcessing: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  timeRemaining: string;
};

function WithdrawalCard({
  withdrawal,
  status,
  onClaim,
  isProcessing,
  isExpanded,
  onToggle,
  timeRemaining,
}: WithdrawalCardProps) {
  const progress =
    ((WITHDRAWAL_DELAY * 1000 - (withdrawal.expiresAt - Date.now())) /
      (WITHDRAWAL_DELAY * 1000)) *
    100;

  return (
    <div
      className={`border overflow-hidden transition-all ${
        status === "ready" ? "border-green-500 " : "border-white/60"
      }`}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="p-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-bold text-sm text-white">
                {withdrawal.amount} {getTokenSymbol(withdrawal.tokenSymbol)}
              </div>
              <div className="text-sm text-white/60">
                Request #{withdrawal.requestId} • Pool {withdrawal.poolId}
              </div>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <div
              className={`font-mono text-lg font-bold ${
                status === "ready" ? "text-green-400" : "text-white"
              }`}
            >
              {timeRemaining === "Ready!" ? "" : timeRemaining}
            </div>
            {timeRemaining === "Ready!" ? (
              <div className="text-xl text-green-500">
                {isExpanded ? <LuChevronUp /> : <LuChevronDown />}
              </div>
            ) : null}
          </div>
        </div>

        {/* Progress Bar */}
        {status === "pending" && (
          <div className="mt-2 mb-1 w-full bg-white/10 h-1 rounded-full overflow-hidden">
            <div
              className="bg-white h-1 transition-all duration-1000 ease-linear"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-white/20 p-4 space-y-3 bg-black/20">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Recipient:</span>
              <span className="font-mono text-white/90">
                {withdrawal.recipient.slice(0, 10)}...
                {withdrawal.recipient.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Chain ID:</span>
              <span className="text-white/90">{withdrawal.chainId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Requested:</span>
              <span className="text-white/90">
                {new Date(withdrawal.requestTimestamp).toLocaleString()}
              </span>
            </div>
          </div>

          {status === "ready" && onClaim && (
            <button
              onClick={onClaim}
              disabled={isProcessing}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-2 text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Claiming..." : "Claim Now"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
