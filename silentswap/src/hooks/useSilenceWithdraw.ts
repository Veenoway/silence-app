"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getContract, isAddress } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { Note } from "./useNotes";
import { decodeNote, validateNote } from "./useNotes";

// ===== TYPES =====
export type WithdrawalRequest = {
  commitment: `0x${string}`;
  recipient: `0x${string}`;
  requestTimestamp: bigint;
  fulfilled: boolean;
  timeUntilWithdrawal: bigint;
};

export type NoteStatus = {
  exists: boolean;
  nullifierUsed: boolean;
  canWithdraw: boolean;
};

// ===== ABIs =====
const SILENTPOOL_ABI = [
  {
    type: "function",
    name: "requestWithdrawal",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
      { name: "commitment", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "secret", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [{ type: "uint256", name: "requestId" }],
  },
  {
    type: "function",
    name: "fulfillWithdrawal",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getWithdrawalRequest",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "commitment", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "requestTimestamp", type: "uint256" },
      { name: "fulfilled", type: "bool" },
      { name: "timeUntilWithdrawal", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "commitmentExists",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isNullifierUsed",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

// ===== HOOK =====
export const useSilenceWithdraw = (
  silentPoolAddress: `0x${string}`,
  onSuccess?: () => void
) => {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalRequestId, setWithdrawalRequestId] = useState<number | null>(
    null
  );

  /**
   * Vérifier le statut d'une note
   */
  const checkNoteStatus = useCallback(
    async (noteString: string): Promise<NoteStatus | null> => {
      if (!publicClient) {
        return null;
      }

      try {
        const note = decodeNote(noteString);

        if (!validateNote(note)) {
          toast.error("❌ Invalid note - commitment doesn't match");
          return null;
        }

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: publicClient,
        });

        const [exists, nullifierUsed] = await Promise.all([
          poolContract.read.commitmentExists([note.commitment]),
          poolContract.read.isNullifierUsed([note.nullifier]),
        ]);

        const canWithdraw = exists && !nullifierUsed;

        return {
          exists,
          nullifierUsed,
          canWithdraw,
        };
      } catch (error) {
        console.error("Error checking note status:", error);
        toast.error("❌ Failed to check note status");
        return null;
      }
    },
    [publicClient, silentPoolAddress]
  );

  /**
   * Demander un withdrawal (étape 1/2)
   */
  const requestWithdrawal = useCallback(
    async (noteString: string, recipient: string): Promise<number | null> => {
      if (!walletClient || !publicClient || !chain) {
        toast.error("❌ Wallet not connected");
        return null;
      }

      // Valider l'adresse du recipient
      if (!isAddress(recipient)) {
        toast.error("❌ Invalid recipient address");
        return null;
      }

      setIsWithdrawing(true);
      const toastId = toast.loading("🔓 Decoding note...");

      try {
        // 1. Décoder et valider la note
        const note: Note = decodeNote(noteString);

        if (!validateNote(note)) {
          throw new Error("Invalid note - commitment doesn't match");
        }

        // Vérifier que la note est pour la bonne chain
        if (note.chainId !== chain.id) {
          toast.warning(
            `⚠️ Note is for chain ${note.chainId}, but you're on chain ${chain.id}`,
            { id: toastId }
          );
        }

        // 2. Vérifier le statut de la note
        toast.loading("🔍 Checking note status...", { id: toastId });

        const status = await checkNoteStatus(noteString);

        if (!status) {
          throw new Error("Failed to check note status");
        }

        if (!status.exists) {
          throw new Error("Note doesn't exist - invalid deposit");
        }

        if (status.nullifierUsed) {
          throw new Error("Note already spent - double-spend detected");
        }

        // 3. Demander le withdrawal
        toast.loading(
          `💸 Requesting withdrawal to ${recipient.slice(
            0,
            6
          )}...${recipient.slice(-4)}`,
          { id: toastId }
        );

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        // Note: Merkle proof simplifié (vide) pour la démo
        const merkleProof: `0x${string}`[] = [];

        const hash = await poolContract.write.requestWithdrawal([
          note.token as `0x${string}`,
          BigInt(note.poolId),
          note.commitment,
          note.nullifier,
          note.secret,
          recipient as `0x${string}`,
          merkleProof,
        ]);

        toast.loading("⏳ Waiting for confirmation...", { id: toastId });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          confirmations: 2,
        });

        let requestId = 0;

        console.log("receipt.logsssss", receipt);

        if (receipt.logs && receipt.logs.length > 0) {
          for (const log of receipt.logs) {
            try {
              // Le requestId est dans le premier topic (après le event signature)
              // ou dans les data encodés

              // Méthode 1: Si c'est dans les topics
              console.log("log.topics", log.topics);
              if (log.topics && log.topics.length > 1) {
                // Le requestId est probablement dans topics[1]
                const potentialRequestId = BigInt(log.topics[1]);
                console.log(
                  "📊 Found requestId in topics:",
                  potentialRequestId
                );
                requestId = Number(potentialRequestId);
                break;
              }

              // Méthode 2: Si c'est dans les data
              if (log.data && log.data !== "0x") {
                // Décoder les data (le requestId est probablement les premiers 32 bytes)
                const dataWithout0x = log.data.slice(2);
                if (dataWithout0x.length >= 64) {
                  const potentialRequestId = BigInt(
                    "0x" + dataWithout0x.slice(0, 64)
                  );
                  console.log(
                    "📊 Found requestId in data:",
                    potentialRequestId
                  );
                  requestId = Number(potentialRequestId);
                  break;
                }
              }
            } catch (error) {
              console.log("Could not parse log:", error);
              continue;
            }
          }
        }

        console.log("requestId", requestId);

        setWithdrawalRequestId(requestId);

        toast.success("✅ Withdrawal requested! Wait 1 hour before claiming.", {
          id: toastId,
          duration: 5000,
        });

        console.log("✅ Withdrawal requested:", {
          requestId,
          hash,
        });

        return requestId;
      } catch (error) {
        console.error("❌ Withdrawal request error:", error);
        toast.error(
          `❌ Request failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { id: toastId }
        );
        return null;
      } finally {
        setIsWithdrawing(false);
      }
    },
    [walletClient, publicClient, chain, silentPoolAddress, checkNoteStatus]
  );

  /**
   * Finaliser un withdrawal (étape 2/2)
   */
  const fulfillWithdrawal = useCallback(
    async (requestId: number): Promise<boolean> => {
      if (!walletClient || !publicClient) {
        toast.error("❌ Wallet not connected");
        return false;
      }

      setIsWithdrawing(true);
      const toastId = toast.loading("💰 Claiming withdrawal...");

      try {
        // Vérifier l'état de la request
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: publicClient,
        });

        const [
          commitment,
          recipient,
          requestTimestamp,
          fulfilled,
          timeUntilWithdrawal,
        ] = await poolContract.read.getWithdrawalRequest([BigInt(requestId)]);

        if (fulfilled) {
          throw new Error("Withdrawal already fulfilled");
        }

        console.log("timeUntilWithdrawal", timeUntilWithdrawal);
        console.log(
          "timeUntilWithdrawal > BigInt(0)",
          timeUntilWithdrawal > BigInt(0)
        );
        console.log("requestTimestamp(0)", requestTimestamp);

        if (timeUntilWithdrawal > BigInt(0)) {
          const hoursLeft = Number(timeUntilWithdrawal) / 3600;
          throw new Error(
            `Must wait ${hoursLeft.toFixed(1)} more hours before claiming`
          );
        }

        // Finaliser le withdrawal
        toast.loading("💸 Transferring funds...", { id: toastId });

        const poolWriteContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const hash = await poolWriteContract.write.fulfillWithdrawal([
          BigInt(requestId),
        ]);

        toast.loading("⏳ Waiting for confirmation...", { id: toastId });

        await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          confirmations: 2,
        });

        toast.success("✅ Withdrawal complete! Funds received.", {
          id: toastId,
          duration: 5000,
        });

        console.log("✅ Withdrawal fulfilled:", {
          requestId,
          hash,
        });

        if (onSuccess) {
          onSuccess();
        }

        return true;
      } catch (error) {
        console.error("❌ Fulfill withdrawal error:", error);
        toast.error(
          `❌ Claim failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { id: toastId }
        );
        return false;
      } finally {
        setIsWithdrawing(false);
      }
    },
    [walletClient, publicClient, silentPoolAddress, onSuccess]
  );

  /**
   * Obtenir les infos d'une withdrawal request
   */
  const getWithdrawalRequest = useCallback(
    async (requestId: number): Promise<WithdrawalRequest | null> => {
      if (!publicClient) return null;

      try {
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: publicClient,
        });

        const [
          commitment,
          recipient,
          requestTimestamp,
          fulfilled,
          timeUntilWithdrawal,
        ] = await poolContract.read.getWithdrawalRequest([BigInt(requestId)]);

        return {
          commitment,
          recipient,
          requestTimestamp,
          fulfilled,
          timeUntilWithdrawal,
        };
      } catch (error) {
        console.error("Error getting withdrawal request:", error);
        return null;
      }
    },
    [publicClient, silentPoolAddress]
  );

  return {
    requestWithdrawal,
    fulfillWithdrawal,
    checkNoteStatus,
    getWithdrawalRequest,
    isWithdrawing,
    withdrawalRequestId,
    canWithdraw: isConnected && !isWithdrawing,
  };
};
