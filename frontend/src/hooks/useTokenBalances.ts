"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, getContract } from "viem";
import { useAccount, usePublicClient } from "wagmi";

export type Token = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export type TokenBalance = {
  symbol: string;
  balance: string;
  balanceWei: bigint;
};

export type PoolInfo = {
  token: string;
  poolId: number;
  denomination: string;
  depositCount: number;
  anonymitySetSize: number;
  isActive: boolean;
};

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const useTokenBalances = (tokens: Token[]) => {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [poolInfos, setPoolInfos] = useState<PoolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadingRef = useRef(false);
  const lastAddressRef = useRef<string>("");

  const loadBalances = useCallback(
    async (force = false) => {
      if (!publicClient || !address || loadingRef.current) {
        return;
      }

      if (!force && lastAddressRef.current === address) {
        return;
      }

      console.log("Loading balances");
      loadingRef.current = true;
      lastAddressRef.current = address;
      setIsLoading(true);

      try {
        const balances: TokenBalance[] = [];

        for (const token of tokens) {
          try {
            if (
              token.address === "0x0000000000000000000000000000000000000000"
            ) {
              const balance = await publicClient.getBalance({ address });
              balances.push({
                symbol: token.symbol,
                balance: formatUnits(balance, 18),
                balanceWei: balance,
              });
            } else {
              const tokenContract = getContract({
                address: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                client: publicClient,
              });

              const balance = (await tokenContract.read.balanceOf([
                address,
              ])) as bigint;

              console.log("balance", balance);

              balances.push({
                symbol: token.symbol,
                balance: formatUnits(balance, token.decimals),
                balanceWei: balance,
              });
            }
          } catch (error) {
            balances.push({
              symbol: token.symbol,
              balance: "0",
              balanceWei: BigInt(0),
            });
          }
        }

        setTokenBalances(balances);
      } catch (error) {
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
      }
    },
    [publicClient, address, tokens]
  );

  useEffect(() => {
    if (address && publicClient) {
      loadBalances(false);
    } else {
      setTokenBalances([]);
      lastAddressRef.current = "";
    }
  }, [address, publicClient, loadBalances]);

  const getTokenBalance = useCallback(
    (symbol: string): string => {
      const balance = tokenBalances.find((b) => b.symbol === symbol);
      return balance?.balance || "0";
    },
    [tokenBalances]
  );

  const getPoolInfo = useCallback(
    (token: string, poolId: number): PoolInfo | null => {
      return (
        poolInfos.find((p) => p.token === token && p.poolId === poolId) || null
      );
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
