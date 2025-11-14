"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, getContract } from "viem";
import { useAccount, usePublicClient } from "wagmi";

export type Token = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export type PoolInfo = {
  isActive: boolean;
  denomination: string;
  depositCount: string;
  anonymitySetSize: string;
};

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const SILENTPOOL_ABI = [
  {
    type: "function",
    name: "getPoolInfo",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
    ],
    outputs: [
      { name: "isActive", type: "bool" },
      { name: "denomination", type: "uint128" },
      { name: "depositCount", type: "uint256" },
      { name: "anonymitySetSize", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

export const useTokenBalances = (
  silentPoolAddress: `0x${string}`,
  tokens: Token[]
) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>(
    {}
  );
  const [poolInfos, setPoolInfos] = useState<
    Record<string, Record<number, PoolInfo>>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  const loadBalances = useCallback(async () => {
    if (!address || !publicClient || !isConnected) return;

    setIsLoading(true);

    try {
      const newBalances: Record<string, string> = {};
      const newPoolInfos: Record<string, Record<number, PoolInfo>> = {};

      await Promise.all(
        tokens.map(async (token) => {
          try {
            const tokenContract = getContract({
              address: token.address,
              abi: ERC20_ABI,
              client: publicClient,
            });
            const balance = await tokenContract.read.balanceOf([address]);
            newBalances[token.symbol] = formatUnits(balance, token.decimals);

            const poolContract = getContract({
              address: silentPoolAddress,
              abi: SILENTPOOL_ABI,
              client: publicClient,
            });

            const [isActive, denomination, depositCount, anonymitySetSize] =
              await poolContract.read.getPoolInfo([token.address, BigInt(0)]);

            if (!newPoolInfos[token.symbol]) {
              newPoolInfos[token.symbol] = {};
            }

            newPoolInfos[token.symbol][0] = {
              isActive,
              denomination: formatUnits(denomination, token.decimals),
              depositCount: depositCount.toString(),
              anonymitySetSize: anonymitySetSize.toString(),
            };
          } catch (error) {
            console.error(`Error loading data for ${token.symbol}:`, error);
            newBalances[token.symbol] = "0";
          }
        })
      );

      setTokenBalances(newBalances);
      setPoolInfos(newPoolInfos);
    } catch (error) {
      console.error("Error loading balances:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient, isConnected, tokens, silentPoolAddress]);

  useEffect(() => {
    if (address && isConnected) {
      loadBalances();
    }
  }, [address, isConnected, loadBalances]);

  const getTokenBalance = useCallback(
    (tokenSymbol: string): string => {
      return tokenBalances[tokenSymbol] || "0";
    },
    [tokenBalances]
  );

  const getPoolInfo = useCallback(
    (tokenSymbol: string, poolId: number = 0): PoolInfo | null => {
      return poolInfos[tokenSymbol]?.[poolId] || null;
    },
    [poolInfos]
  );

  return {
    tokenBalances,
    poolInfos,
    isLoading,
    loadBalances,
    getTokenBalance,
    getPoolInfo,
  };
};
