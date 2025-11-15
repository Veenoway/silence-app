"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, getContract, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { CONTRACT_ABI } from "../contract";
import { useFaucet } from "./useFaucet";
import {
  decodeNote,
  encodeNote,
  generateNote,
  useNotes,
  validateNote,
} from "./useNotes";
import { useSilenceDeposit } from "./useSilenceDeposit";
import { useSilenceWithdraw } from "./useSilenceWithdraw";
import type { Token } from "./useTokenBalances";
import { useTokenBalances } from "./useTokenBalances";

export type { Note } from "./useNotes";
export type { NoteStatus, WithdrawalRequest } from "./useSilenceWithdraw";
export type { PoolInfo, Token } from "./useTokenBalances";

export interface AvailablePool {
  poolId: number;
  denomination: string;
  denominationWei: bigint;
  depositCount: number;
  anonymitySetSize: number;
  isActive: boolean;
  token: Token;
}

export const useSilence = (parameters: {
  silentPoolAddress: `0x${string}`;
  tokens: Token[];
}) => {
  const { silentPoolAddress, tokens } = parameters;
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [selectedToken, setSelectedToken] = useState<Token>(tokens[0]);
  const [selectedPoolId, setSelectedPoolId] = useState<number>(0);

  const [selectedAmount, setSelectedAmount] = useState<string>("10");
  const [availablePools, setAvailablePools] = useState<AvailablePool[]>([]);
  const [selectedPool, setSelectedPool] = useState<AvailablePool | null>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(false);

  const notes = useNotes();

  const {
    tokenBalances,
    poolInfos,
    isLoading: isLoadingBalances,
    loadBalances,
    getTokenBalance,
    getPoolInfo,
  } = useTokenBalances(tokens);

  const reloadBalances = useCallback(() => {
    loadBalances(true);
  }, [loadBalances]);

  const {
    deposit,
    depositETH,
    isDepositing,
    generatedNote,
    setGeneratedNote,
    canDeposit,
  } = useSilenceDeposit(silentPoolAddress, reloadBalances);

  const {
    requestWithdrawal,
    fulfillWithdrawal,
    checkNoteStatus,
    getWithdrawalRequest,
    isWithdrawing,
    withdrawalRequestId,
    canWithdraw,
  } = useSilenceWithdraw(silentPoolAddress, reloadBalances);

  const { mintToken, mintingState, getMintButtonText, isMinting, canMint } =
    useFaucet(reloadBalances);

  const loadPoolsForToken = useCallback(
    async (token: Token) => {
      if (!publicClient) return;

      setIsLoadingPools(true);
      try {
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: CONTRACT_ABI,
          client: publicClient,
        });

        const poolCount = await poolContract.read.tokenPoolCount([
          token.address,
        ]);

        const pools: AvailablePool[] = [];

        for (let i = 0; i < Number(poolCount); i++) {
          const poolInfo = await poolContract.read.getPoolInfo([
            token.address,
            BigInt(i),
          ]);

          const denominationFormatted = formatUnits(
            poolInfo[1],
            token.decimals
          );

          pools.push({
            poolId: i,
            denomination: denominationFormatted,
            denominationWei: poolInfo[1],
            depositCount: Number(poolInfo[2]),
            anonymitySetSize: Number(poolInfo[3]),
            isActive: poolInfo[0],

            token: token,
          });
        }

        setAvailablePools(pools);

        const matchingPool = pools.find(
          (p) => p.denomination === selectedAmount && p.isActive
        );
        if (matchingPool) {
          setSelectedPool(matchingPool);
          setSelectedPoolId(matchingPool.poolId);
        } else if (pools.length > 0 && pools[0]) {
          setSelectedPool(pools[0]);
          setSelectedPoolId(pools[0].poolId);
        } else {
          setSelectedPool(null);
        }
      } catch (error) {
        console.error("Error loading pools:", error);
        setAvailablePools([]);
        setSelectedPool(null);
      } finally {
        setIsLoadingPools(false);
      }
    },
    [publicClient, silentPoolAddress]
  );

  useEffect(() => {
    if (selectedToken && publicClient) {
      loadPoolsForToken(selectedToken);
    }
  }, [selectedToken, publicClient, loadPoolsForToken]);

  useEffect(() => {
    const matchingPool = availablePools.find(
      (p) =>
        p.denomination === selectedAmount &&
        p.token.symbol === selectedToken.symbol &&
        p.isActive
    );

    if (matchingPool) {
      setSelectedPool(matchingPool);
      setSelectedPoolId(matchingPool.poolId);
    }
  }, [selectedAmount, availablePools, selectedToken]);

  const isPoolAvailable = useCallback(
    (amount: string): boolean => {
      return availablePools.some(
        (p) =>
          p.denomination === amount &&
          p.token.symbol === selectedToken.symbol &&
          p.isActive
      );
    },
    [availablePools, selectedToken]
  );

  const getPoolByAmount = useCallback(
    (amount: string): AvailablePool | undefined => {
      return availablePools.find(
        (p) =>
          p.denomination === amount &&
          p.token.symbol === selectedToken.symbol &&
          p.isActive
      );
    },
    [availablePools, selectedToken]
  );

  const selectedTokenBalance = getTokenBalance(selectedToken.symbol);

  const selectedPoolInfo = selectedPool
    ? {
        poolId: selectedPool.poolId,
        denomination: selectedPool.denomination,
        depositCount: selectedPool.depositCount,
        anonymitySetSize: selectedPool.anonymitySetSize,
        isActive: selectedPool.isActive,
      }
    : null;

  const isProcessing =
    isDepositing || isWithdrawing || isMinting || isLoadingPools;
  const canInteract = isConnected && !isProcessing && selectedPool !== null;

  const depositToSelectedPool = useCallback(
    async (amount: string): Promise<string | null> => {
      if (!selectedPool) {
        console.error("No pool selected");
        return null;
      }

      if (amount !== selectedPool.denomination) {
        console.error(
          `Amount mismatch: ${amount} vs pool denomination ${selectedPool.denomination}`
        );
        return null;
      }

      if (
        selectedToken.address === "0x0000000000000000000000000000000000000000"
      ) {
        return depositETH(selectedPool.poolId, amount);
      } else {
        return deposit(selectedToken, selectedPool.poolId, amount);
      }
    },
    [selectedToken, selectedPool, deposit, depositETH]
  );

  const mintSelectedToken = useCallback(async (): Promise<boolean> => {
    return mintToken(selectedToken);
  }, [selectedToken, mintToken]);

  const createPool = useCallback(
    async (amount: string): Promise<boolean> => {
      if (!walletClient || !address) {
        console.error("Wallet not connected");
        return false;
      }

      try {
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: CONTRACT_ABI,
          client: walletClient,
        });

        const denomination = parseUnits(amount, selectedToken.decimals);

        const hash = await poolContract.write.createPool([
          selectedToken.address,
          denomination,
        ]);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        await loadPoolsForToken(selectedToken);

        return true;
      } catch (error) {
        console.error("Error creating pool:", error);
        return false;
      }
    },
    [
      walletClient,
      address,
      silentPoolAddress,
      selectedToken,
      publicClient,
      loadPoolsForToken,
    ]
  );

  const createAllStandardPools = useCallback(async (): Promise<void> => {
    const standardAmounts = ["1", "10", "100", "1000"];

    for (const amount of standardAmounts) {
      if (!isPoolAvailable(amount)) {
        await createPool(amount);
      }
    }
  }, [isPoolAvailable, createPool]);

  return {
    // Connection
    address,
    isConnected,
    chainId: chain?.id,

    // Token selection
    selectedToken,
    setSelectedToken,
    selectedPoolId,
    setSelectedPoolId,
    tokens,

    selectedAmount,
    setSelectedAmount,
    availablePools,
    selectedPool,
    isLoadingPools,
    loadPoolsForToken,
    isPoolAvailable,
    getPoolByAmount,
    createPool,
    createAllStandardPools,

    // Balances & Pool info
    tokenBalances,
    poolInfos,
    selectedTokenBalance,
    selectedPoolInfo,
    isLoadingBalances,
    loadBalances,
    getTokenBalance,
    getPoolInfo,

    // Deposits
    deposit,
    depositETH,
    depositToSelectedPool,
    isDepositing,
    generatedNote,
    setGeneratedNote,
    canDeposit,

    // Withdrawals
    requestWithdrawal,
    fulfillWithdrawal,
    checkNoteStatus,
    getWithdrawalRequest,
    isWithdrawing,
    withdrawalRequestId,
    canWithdraw,

    // Minting
    mintToken,
    mintSelectedToken,
    mintingState,
    getMintButtonText,
    isMinting,
    canMint,

    // Notes utilities
    generateNote,
    encodeNote,
    decodeNote,
    validateNote,
    notes,

    // Global state
    isProcessing,
    canInteract,
  };
};

export { useFaucet } from "./useFaucet";
export { useNotes } from "./useNotes";
export { useSilenceDeposit } from "./useSilenceDeposit";
export { useSilenceWithdraw } from "./useSilenceWithdraw";
export { useTokenBalances } from "./useTokenBalances";
