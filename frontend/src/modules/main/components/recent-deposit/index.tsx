"use client";

import { useRecentDeposits } from "../../../../hooks/useRecentDeposits";
import { Card } from "./card";

type RecentDepositsProps = {
  silentPoolAddress: `0x${string}`;
  poolId?: number;
  maxResults?: number;
  showAutoRefresh?: boolean;
};

export const RecentDeposits = ({
  silentPoolAddress,
  poolId,
  maxResults = 10,
}: RecentDepositsProps) => {
  const { deposits } = useRecentDeposits({
    silentPoolAddress,
    poolId,
    maxResults,
  });

  return (
    <div className="w-full mt-2">
      <div className="grid grid-cols-2 gap-2">
        {deposits?.length > 0
          ? deposits
              .filter((_, index) => index < 8)
              .map((deposit, index) => (
                <Card key={`${deposit.txHash}-${index}`} deposit={deposit} />
              ))
          : Array.from({ length: 8 }).map((_, index) => (
              <Card key={`loading-${index}`} deposit={null} isLoading={true} />
            ))}
      </div>
    </div>
  );
};
