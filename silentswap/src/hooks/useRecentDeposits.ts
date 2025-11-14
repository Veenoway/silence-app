"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

type DepositEvent = {
  token: string;
  tokenSymbol: string;
  poolId: number;
  commitment: string;
  amount: string;
  timestamp: number;
  blockNumber: bigint;
  txHash: string;
};

/**
 * OPTIMIZED VERSION with localStorage caching
 *
 * Benefits:
 * - Reduces RPC calls
 * - Instant load from cache
 * - Only fetches new deposits
 * - Persists across page refreshes
 */

const CACHE_KEY_PREFIX = "silentpool_deposits_";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

type CachedDeposits = {
  deposits: DepositEvent[];
  lastBlock: bigint;
  timestamp: number;
};

const SILENTPOOL_ABI = [
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "poolId", type: "uint256", indexed: true },
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "leafIndex", type: "uint256", indexed: false },
    ],
  },
] as const;

export const useRecentDeposits = ({
  silentPoolAddress,
  poolId,
  maxResults = 10,
  enableCache = true,
}: {
  silentPoolAddress: `0x${string}`;
  poolId?: number;
  maxResults?: number;
  enableCache?: boolean;
}) => {
  const publicClient = usePublicClient();

  const [deposits, setDeposits] = useState<DepositEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const cacheKey = `${CACHE_KEY_PREFIX}${silentPoolAddress}_${poolId || "all"}`;

  // Load from cache on mount
  useEffect(() => {
    if (!enableCache) return;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data: CachedDeposits = JSON.parse(cached);

        // Check if cache is still valid
        if (Date.now() - data.timestamp < CACHE_DURATION) {
          setDeposits(data.deposits.slice(0, maxResults));
          setLastFetchTime(data.timestamp);
        }
      }
    } catch (error) {
      console.error("Error loading cache:", error);
    }
  }, [cacheKey, maxResults, enableCache]);

  const getTokenSymbol = (address: string): string => {
    const knownTokens: Record<string, string> = {
      "0x0000000000000000000000000000000000000000": "ETH",
      "0xE12F41ad58856673247Cbb785EA5c8fD7cce466d": "USDC",
    };
    return knownTokens[address.toLowerCase()] || address.slice(0, 6) + "...";
  };

  const fetchDeposits = useCallback(
    async (forceRefresh = false) => {
      if (!publicClient) return;
      console.log("I REFRESH");
      // Don't fetch too often (rate limiting)
      if (!forceRefresh && Date.now() - lastFetchTime < 10000) {
        console.log("⏭️ Skipping fetch (too soon)");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const currentBlock = await publicClient.getBlockNumber();

        // Try to get cached data
        let cachedData: CachedDeposits | null = null;
        if (enableCache) {
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              cachedData = JSON.parse(cached);
            }
          } catch (e) {
            console.error("Cache read error:", e);
          }
        }

        console.log("currentBlock", currentBlock);
        // Determine starting block
        let fromBlock: bigint;
        if (cachedData && !forceRefresh) {
          // Only fetch from last cached block
          fromBlock = BigInt(cachedData.lastBlock) + BigInt(1);
        } else {
          // Full fetch
          fromBlock = BigInt(currentBlock) - BigInt(7200); // ~24h
        }

        // Fetch new logs
        const logs = await publicClient.getLogs({
          address: silentPoolAddress,
          event: SILENTPOOL_ABI[0],
          fromBlock,
          toBlock: currentBlock,
        });

        console.log("logs", logs);

        // Parse new deposits
        const newDeposits: DepositEvent[] = await Promise.all(
          logs
            .filter((log) =>
              poolId !== undefined ? Number(log.args.poolId) === poolId : true
            )
            .map(async (log) => {
              const { token, poolId, commitment, leafIndex } = log.args;

              let blockTimestamp = log.blockTimestamp;
              if (log.blockNumber) {
                const block = await publicClient.getBlock({
                  blockNumber: log.blockNumber,
                });
                blockTimestamp = Number(block.timestamp);
              }

              return {
                token: token as string,
                tokenSymbol: getTokenSymbol(token as string),
                poolId: Number(poolId),
                commitment: commitment as string,
                leadIndex: leafIndex as bigint,
                timestamp: blockTimestamp,
                blockNumber: log.blockNumber,
                txHash: log.transactionHash as string,
              };
            })
        );

        // Merge with cached deposits (if any)
        let allDeposits = newDeposits;
        if (cachedData && !forceRefresh) {
          // Merge and deduplicate
          const existingHashes = new Set(
            cachedData.deposits.map((d) => d.txHash)
          );
          const uniqueNewDeposits = newDeposits.filter(
            (d) => !existingHashes.has(d.txHash)
          );
          allDeposits = [...uniqueNewDeposits, ...cachedData.deposits];
        }

        // Sort and limit
        const sortedDeposits = allDeposits
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, maxResults);

        console.log("sortedDeposits", sortedDeposits);
        setDeposits(sortedDeposits);
        setLastFetchTime(Date.now());

        // Update cache
        if (enableCache) {
          try {
            const cacheData: CachedDeposits = {
              deposits: sortedDeposits,
              lastBlock: currentBlock,
              timestamp: Date.now(),
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          } catch (e) {
            console.error("Cache write error:", e);
          }
        }

        console.log(
          `✅ Fetched ${newDeposits.length} new deposits (total: ${sortedDeposits.length})`
        );
      } catch (err) {
        console.error("Error fetching deposits:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch deposits"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      publicClient,
      silentPoolAddress,
      poolId,
      maxResults,
      enableCache,
      cacheKey,
      lastFetchTime,
    ]
  );

  // Initial fetch
  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
    setDeposits([]);
    setLastFetchTime(0);
    fetchDeposits(true);
  }, [cacheKey, fetchDeposits]);

  return {
    deposits,
    isLoading,
    error,
    refetch: () => fetchDeposits(true),
    clearCache,
    isCached: lastFetchTime > 0,
    cacheAge: lastFetchTime ? Date.now() - lastFetchTime : 0,
  };
};

/**
 * Hook with automatic polling
 */
export const useRecentDepositsPolling = ({
  silentPoolAddress,
  poolId,
  maxResults = 10,
  pollInterval = 30000, // 30 seconds
}: {
  silentPoolAddress: `0x${string}`;
  poolId?: number;
  maxResults?: number;
  pollInterval?: number;
}) => {
  const {
    deposits,
    isLoading,
    error,
    refetch,
    clearCache,
    isCached,
    cacheAge,
  } = useRecentDeposits({
    silentPoolAddress,
    poolId,
    maxResults,
    enableCache: true,
  });

  // Auto-poll
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [refetch, pollInterval]);

  return {
    deposits,
    isLoading,
    error,
    refetch,
    clearCache,
    isCached,
    cacheAge,
  };
};
