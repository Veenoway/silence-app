"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getContract, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { Note } from "./useNotes";
import { encodeNote, generateNote } from "./useNotes";
import { useRecentDeposits } from "./useRecentDeposits";
import type { Token } from "./useTokenBalances";

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const SILENTPOOL_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const useSilenceDeposit = (
  silentPoolAddress: `0x${string}`,
  onSuccess?: () => void
) => {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isDepositing, setIsDepositing] = useState(false);
  const [generatedNote, setGeneratedNote] = useState<string>("");
  const { refetch } = useRecentDeposits({
    silentPoolAddress,
  });

  const deposit = useCallback(
    async (
      token: Token,
      poolId: number,
      amount: string
    ): Promise<string | null> => {
      if (!walletClient || !address || !chain || !publicClient) {
        toast.error("❌ Wallet not connected");
        return null;
      }

      setIsDepositing(true);
      const toastId = toast.loading("🔐 Generating secret note...");

      try {
        const note: Note = generateNote(
          token.address,
          poolId,
          amount,
          chain.id
        );
        const noteString = encodeNote(note);

        console.log("📝 Generated note (SAVE THIS!):", noteString);
        console.log("🔑 Note details:", {
          commitment: note.commitment,
          token: token.symbol,
          amount,
          poolId,
        });

        const amountBigInt = parseUnits(amount, token.decimals);

        const tokenContract = getContract({
          address: token.address,
          abi: ERC20_ABI,
          client: publicClient,
        });

        const currentAllowance = await tokenContract.read.allowance([
          address,
          silentPoolAddress,
        ]);

        if (BigInt(currentAllowance as unknown as bigint) < amountBigInt) {
          toast.loading("📝 Approving token...", { id: toastId });

          const tokenWriteContract = getContract({
            address: token.address,
            abi: ERC20_ABI,
            client: walletClient,
          });

          const approveHash = await tokenWriteContract.write.approve([
            silentPoolAddress,
            amountBigInt,
          ]);

          await publicClient.waitForTransactionReceipt({
            hash: approveHash,
            timeout: 60_000,
          });

          console.log("✅ Token approved");
        }

        toast.loading("🔒 Depositing anonymously...", { id: toastId });

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const depositHash = await poolContract.write.deposit([
          token.address,
          BigInt(poolId),
          note.commitment,
        ]);

        toast.loading("⏳ Waiting for confirmation...", { id: toastId });

        await publicClient.waitForTransactionReceipt({
          hash: depositHash,
          timeout: 120_000,
          confirmations: 2,
        });

        toast.success(
          `✅ Deposit complete! ${amount} ${token.symbol} deposited anonymously`,
          { id: toastId, duration: 5000 }
        );

        console.log("✅ Deposit successful!");
        console.log("📋 Transaction hash:", depositHash);

        setGeneratedNote(noteString);

        if (onSuccess) {
          onSuccess();
          refetch();
        }

        return noteString;
      } catch (error) {
        console.error("❌ Deposit error:", error);
        toast.error(
          `❌ Deposit failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { id: toastId }
        );
        return null;
      } finally {
        setIsDepositing(false);
      }
    },
    [walletClient, address, chain, publicClient, silentPoolAddress, onSuccess]
  );

  const depositETH = useCallback(
    async (poolId: number, amount: string): Promise<string | null> => {
      if (!walletClient || !address || !chain || !publicClient) {
        toast.error("❌ Wallet not connected");
        return null;
      }

      setIsDepositing(true);
      const toastId = toast.loading("🔐 Generating secret note...");

      try {
        const note: Note = generateNote(
          "0x0000000000000000000000000000000000000000",
          poolId,
          amount,
          chain.id
        );
        const noteString = encodeNote(note);

        console.log("📝 Generated ETH note:", noteString);

        toast.loading("🔒 Depositing ETH anonymously...", { id: toastId });

        const amountWei = parseUnits(amount, 18);

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const depositHash = await poolContract.write.deposit(
          [
            "0x0000000000000000000000000000000000000000",
            BigInt(poolId),
            note.commitment,
          ],
          {
            value: amountWei,
          }
        );

        toast.loading("⏳ Waiting for confirmation...", { id: toastId });

        await publicClient.waitForTransactionReceipt({
          hash: depositHash,
          timeout: 120_000,
          confirmations: 2,
        });

        toast.success(`✅ ${amount} ETH deposited anonymously!`, {
          id: toastId,
          duration: 5000,
        });

        setGeneratedNote(noteString);

        if (onSuccess) {
          onSuccess();
          refetch();
        }

        return noteString;
      } catch (error) {
        console.error("❌ ETH deposit error:", error);
        toast.error(
          `❌ Deposit failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { id: toastId }
        );
        return null;
      } finally {
        setIsDepositing(false);
      }
    },
    [walletClient, address, chain, publicClient, silentPoolAddress, onSuccess]
  );

  return {
    deposit,
    depositETH,
    isDepositing,
    generatedNote,
    setGeneratedNote,
    canDeposit: isConnected && !isDepositing,
  };
};
