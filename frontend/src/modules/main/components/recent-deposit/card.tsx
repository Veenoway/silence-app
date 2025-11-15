import { useState } from "react";
import { LuLock } from "react-icons/lu";
import { Skeleton } from "~~/src/components/UI/skeleton";
import { DepositEvent } from "~~/src/hooks/useRecentDeposits";

type CardProps = {
  deposit: DepositEvent | null;
  isLoading?: boolean;
};

export const Card = ({ deposit, isLoading }: CardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
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
            {isLoading ? (
              <Skeleton className="w-7 h-3 rounded ml-2" />
            ) : (
              <div className="font-bold text-white ml-2 leading-[14px]">
                #{deposit?.leafIndex?.toString()}
              </div>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="w-16 h-3.5 rounded ml-2" />
          ) : (
            <div className="text-white text-sm ml-6 leading-[14px]">
              {formatTimestamp(deposit?.timestamp ?? 0)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
