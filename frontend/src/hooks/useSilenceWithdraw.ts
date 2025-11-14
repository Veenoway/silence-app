"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getContract, isAddress } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useDrawerStore } from "../store/useDrawerStore";
import { useWithdrawalStore } from "../store/useWithdrawStore";
import type { Note } from "./useNotes";
import { decodeNote, validateNote } from "./useNotes";

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

export const useSilenceWithdraw = (
  silentPoolAddress: `0x${string}`,
  onSuccess?: () => void
) => {
  const { isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { triggerPing, resetPing } = useWithdrawalStore();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalRequestId, setWithdrawalRequestId] = useState<number | null>(
    null
  );
  const { closeDrawer, openDrawer } = useDrawerStore();

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

        return {
          exists: Boolean(exists),
          nullifierUsed: Boolean(nullifierUsed),
          canWithdraw: Boolean(exists) && !Boolean(nullifierUsed),
        };
      } catch (error) {
        console.error("Error checking note status:", error);
        toast.error("Failed to check note status");
        return null;
      }
    },
    [publicClient, silentPoolAddress]
  );

  const requestWithdrawal = useCallback(
    async (noteString: string, recipient: string): Promise<number | null> => {
      if (!walletClient || !publicClient || !chain) {
        toast.error("Wallet not connected");
        return null;
      }

      if (!isAddress(recipient)) {
        toast.error("Invalid recipient address");
        return null;
      }

      setIsWithdrawing(true);
      const toastId = toast.loading("Decoding note...");

      try {
        const note: Note = decodeNote(noteString);

        if (!validateNote(note)) {
          throw new Error("Invalid note - commitment doesn't match");
        }

        if (note.chainId !== chain.id) {
          toast.warning(
            `Note is for chain ${note.chainId}, but you're on chain ${chain.id}`,
            { id: toastId }
          );
        }

        toast.loading("Checking note status...", { id: toastId });

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

        toast.loading(`Requesting withdrawal...`, { id: toastId });

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

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

        toast.loading("Waiting for confirmation...", { id: toastId });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          confirmations: 2,
        });

        let requestId = 0;

        if (receipt.logs && receipt.logs.length > 0) {
          for (const log of receipt.logs) {
            try {
              if (log.topics && log.topics.length > 1) {
                const potentialRequestId = BigInt(
                  log.topics[1] as `0x${string}`
                );
                requestId = Number(potentialRequestId);
                break;
              }

              if (log.data && log.data !== "0x") {
                const dataWithout0x = log.data.slice(2);
                if (dataWithout0x.length >= 64) {
                  const potentialRequestId = BigInt(
                    "0x" + dataWithout0x.slice(0, 64)
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

        setWithdrawalRequestId(requestId);

        toast.success("Withdrawal requested!", {
          id: toastId,
          duration: 1000,
        });

        triggerPing();
        setTimeout(() => {
          resetPing();
        }, 1000);
        openDrawer();

        return requestId;
      } catch (error) {
        console.error("Withdrawal request error:", error);
        toast.error(`Request failed. Please try again.`, { id: toastId });
        return null;
      } finally {
        setIsWithdrawing(false);
      }
    },
    [walletClient, publicClient, chain, silentPoolAddress, checkNoteStatus]
  );

  const fulfillWithdrawal = useCallback(
    async (requestId: number): Promise<boolean> => {
      if (!walletClient || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }

      setIsWithdrawing(true);
      const toastId = toast.loading("Claiming withdrawal...");

      try {
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: publicClient,
        });

        const res = await poolContract.read.getWithdrawalRequest([
          BigInt(requestId),
        ]);
        if (!Array.isArray(res) || res.length < 5) {
          throw new Error("Could not read withdrawal request data");
        }
        const [_, __, requestTimestamp, fulfilled, timeUntilWithdrawal] =
          res as [unknown, unknown, bigint, boolean, bigint];

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

        toast.loading("Transferring funds...", { id: toastId });

        const poolWriteContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const hash = await poolWriteContract.write.fulfillWithdrawal([
          BigInt(requestId),
        ]);

        toast.loading("Waiting for confirmation...", { id: toastId });

        await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          confirmations: 2,
        });
        closeDrawer();

        toast.success("Withdrawal complete! Funds received.", {
          id: toastId,
          duration: 5000,
        });

        if (onSuccess) {
          triggerPing();
          setTimeout(() => {
            resetPing();
          }, 1000);
          onSuccess();
        }

        return true;
      } catch (error) {
        console.error("Fulfill withdrawal error:", error);
        toast.error(
          `Fulfill withdrawal failed: ${
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

  const getWithdrawalRequest = useCallback(
    async (requestId: number): Promise<WithdrawalRequest | null> => {
      if (!publicClient) return null;

      try {
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: publicClient,
        });

        const res = await poolContract.read.getWithdrawalRequest([
          BigInt(requestId),
        ]);
        if (!Array.isArray(res) || res.length < 5) {
          throw new Error("Could not read withdrawal request data");
        }
        const [
          commitment,
          recipient,
          requestTimestamp,
          fulfilled,
          timeUntilWithdrawal,
        ] = res as [unknown, unknown, bigint, boolean, bigint];

        return {
          commitment: commitment as `0x${string}`,
          recipient: recipient as `0x${string}`,
          requestTimestamp: requestTimestamp as bigint,
          fulfilled: fulfilled as boolean,
          timeUntilWithdrawal: timeUntilWithdrawal as bigint,
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
