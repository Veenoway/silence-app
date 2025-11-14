"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useWithdrawalManager } from "../hooks/useWithdrawalManager";
import { useWithdrawalStore } from "../store/useWithdrawStore";
import { cn } from "../utils/cn";

export const WithdrawTrigger = ({ onClick }: { onClick?: () => void }) => {
  const { chain } = useAccount();
  const { ping } = useWithdrawalStore();
  const { getReadyWithdrawals, getPendingWithdrawals } = useWithdrawalManager(
    chain?.id
  );

  const [readyCount, setReadyCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isBuzzing, setIsBuzzing] = useState(false);

  useEffect(() => {
    const updateCounts = () => {
      setReadyCount(getReadyWithdrawals().length);
      setPendingCount(getPendingWithdrawals().length);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 1000);

    return () => clearInterval(interval);
  }, [getReadyWithdrawals, getPendingWithdrawals]);

  useEffect(() => {
    if (ping) {
      setIsBuzzing(true);

      const buzzInterval = setInterval(() => {
        setIsBuzzing(false);
        setTimeout(() => setIsBuzzing(true), 50);
      }, 600);

      return () => clearInterval(buzzInterval);
    } else {
      setIsBuzzing(false);
    }
  }, [ping]);

  if (readyCount === 0 && pendingCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 px-4 h-12 py-2 bg-black hover:bg-white hover:text-black transition-colors border border-white hover:border-transparent group ${
        isBuzzing ? "animate-buzz" : ""
      }`}
      title={`${readyCount} ready, ${pendingCount} pending`}
    >
      <div className="flex flex-col items-start font-medium text-lg font-syne">
        My withdrawals
      </div>

      {readyCount > 0 && (
        <div
          className={cn(
            "absolute -top-3 -right-3",
            isBuzzing ? "animate-buzz" : ""
          )}
        >
          <span className="relative flex">
            <span className="absolute inline-flex h-full w-full rounded-full bg-black text-lg font-bold text-white"></span>
            <span className="relative rounded-full  transition-all duration-200 group-hover:text-white  text-white text-base font-bold  h-7 w-7 flex items-center justify-center">
              {" "}
              <span className=" font-bold leading-none -mt-1">
                {readyCount + pendingCount}
              </span>
            </span>
          </span>
        </div>
      )}
    </button>
  );
};
