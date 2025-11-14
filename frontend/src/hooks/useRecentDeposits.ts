"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { useDepositStore } from "../store/useDepositStore";

export type DepositEvent = {
  token: string;
  tokenSymbol: string;
  poolId: number;
  commitment: string;
  amount: string;
  timestamp: number;
  blockNumber: bigint;
  txHash: string;
  leafIndex: bigint;
};

type CachedDeposits = {
  deposits: DepositEvent[];
  lastBlock: bigint;
  timestamp: number;
};

type UseRecentDepositsProps = {
  silentPoolAddress: `0x${string}`;
  poolId?: number;
  maxResults?: number;
  enableCache?: boolean;
};

const CACHE_KEY_PREFIX = "silentpool_deposits_";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
}: UseRecentDepositsProps) => {
  const publicClient = usePublicClient();
  const { deposits, setDeposits } = useDepositStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const cacheKey = `${CACHE_KEY_PREFIX}${silentPoolAddress}_${poolId ?? "all"}`;

  useEffect(() => {
    if (!enableCache || poolId === undefined) return;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data: CachedDeposits = JSON.parse(cached);

        if (Date.now() - data.timestamp < CACHE_DURATION) {
          setDeposits(data.deposits.slice(0, maxResults));
          setLastFetchTime(data.timestamp);
          return;
        }
      }
    } catch (error) {
      console.error("Error loading cache:", error);
    }
  }, [cacheKey, maxResults, enableCache, poolId]);

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

      if (poolId === undefined) {
        setDeposits([]);
        return;
      }

      if (!forceRefresh && Date.now() - lastFetchTime < 10000) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const currentBlock = await publicClient.getBlockNumber();

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

        let fromBlock: bigint;
        if (cachedData && !forceRefresh) {
          fromBlock = BigInt(cachedData.lastBlock) + BigInt(1);
        } else {
          fromBlock = BigInt(currentBlock) - BigInt(10000);
        }

        const logs = await publicClient.getLogs({
          address: silentPoolAddress,
          event: SILENTPOOL_ABI[0],
          fromBlock,
          toBlock: currentBlock,
        });

        const filteredLogs = logs.filter(
          (log) => Number(log.args.poolId) === poolId
        );

        const newDeposits: DepositEvent[] = await Promise.all(
          filteredLogs.map(async (log) => {
            const {
              token,
              poolId: logPoolId,
              commitment,
              leafIndex,
            } = log.args;

            let blockTimestamp = 0;
            if (log.blockNumber) {
              try {
                const block = await publicClient.getBlock({
                  blockNumber: log.blockNumber,
                });
                blockTimestamp = Number(block.timestamp);
              } catch (e) {
                console.error("Error fetching block:", e);
                blockTimestamp = Math.floor(Date.now() / 1000);
              }
            }

            return {
              token: token as string,
              tokenSymbol: getTokenSymbol(token as string),
              poolId: Number(logPoolId),
              commitment: commitment as string,
              leafIndex: leafIndex as bigint,
              timestamp: blockTimestamp,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash as string,
            } as DepositEvent;
          })
        );

        let allDeposits = newDeposits;
        if (cachedData && !forceRefresh) {
          const existingHashes = new Set(
            cachedData.deposits.map((d) => d.txHash)
          );
          const uniqueNewDeposits = newDeposits.filter(
            (d) => !existingHashes.has(d.txHash)
          );
          allDeposits = [...uniqueNewDeposits, ...cachedData.deposits];
        }

        const sortedDeposits = allDeposits
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, maxResults);

        setDeposits(sortedDeposits);
        setLastFetchTime(Date.now());

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

  useEffect(() => {
    if (poolId !== undefined) {
      setDeposits([]);
      setLastFetchTime(0);
      fetchDeposits(true);
    }
  }, [poolId]);

  useEffect(() => {
    if (poolId !== undefined && deposits.length === 0) {
      fetchDeposits();
    }
  }, [fetchDeposits, poolId, deposits.length]);

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
