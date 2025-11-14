"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
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

// ===== TYPES =====
export type { Note } from "./useNotes";
export type { NoteStatus, WithdrawalRequest } from "./useSilenceWithdraw";
export type { PoolInfo, Token } from "./useTokenBalances";

// ===== HOOK PRINCIPAL =====
export const useSilence = (parameters: {
  silentPoolAddress: `0x${string}`;
  tokens: Token[];
}) => {
  const { silentPoolAddress, tokens } = parameters;

  const { address, isConnected, chain } = useAccount();

  const [selectedToken, setSelectedToken] = useState<Token>(tokens[0]);
  const [selectedPoolId, setSelectedPoolId] = useState<number>(0);

  // ===== SUB-HOOKS =====
  const notes = useNotes();

  const {
    tokenBalances,
    poolInfos,
    isLoading: isLoadingBalances,
    loadBalances,
    getTokenBalance,
    getPoolInfo,
  } = useTokenBalances(silentPoolAddress, tokens);

  const {
    deposit,
    depositETH,
    isDepositing,
    generatedNote,
    setGeneratedNote,
    canDeposit,
  } = useSilenceDeposit(silentPoolAddress, loadBalances);

  const {
    requestWithdrawal,
    fulfillWithdrawal,
    checkNoteStatus,
    getWithdrawalRequest,
    isWithdrawing,
    withdrawalRequestId,
    canWithdraw,
  } = useSilenceWithdraw(silentPoolAddress, loadBalances);

  const { mintToken, mintingState, getMintButtonText, isMinting, canMint } =
    useFaucet(loadBalances);

  // ===== COMPUTED VALUES =====
  const selectedTokenBalance = getTokenBalance(selectedToken.symbol);
  const selectedPoolInfo = getPoolInfo(selectedToken.symbol, selectedPoolId);

  const isProcessing = isDepositing || isWithdrawing || isMinting;
  const canInteract = isConnected && !isProcessing;

  // ===== CONVENIENCE METHODS =====

  /**
   * Deposit into the selected pool
   */
  const depositToSelectedPool = useCallback(
    async (amount: string): Promise<string | null> => {
      if (
        selectedToken.address === "0x0000000000000000000000000000000000000000"
      ) {
        return depositETH(selectedPoolId, amount);
      } else {
        return deposit(selectedToken, selectedPoolId, amount);
      }
    },
    [selectedToken, selectedPoolId, deposit, depositETH]
  );
  /**
   * Minter le token sélectionné
   */
  const mintSelectedToken = useCallback(async (): Promise<boolean> => {
    return mintToken(selectedToken);
  }, [selectedToken, mintToken]);

  // ===== RETURN =====
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

// ===== EXPORTS =====
export { useFaucet } from "./useFaucet";
export { useNotes } from "./useNotes";
export { useSilenceDeposit } from "./useSilenceDeposit";
export { useSilenceWithdraw } from "./useSilenceWithdraw";
export { useTokenBalances } from "./useTokenBalances";
