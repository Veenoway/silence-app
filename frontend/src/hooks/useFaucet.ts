"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getContract } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { type Token } from "./useTokenBalances";

const ERC20_FAUCET_ABI = [
  {
    type: "function",
    name: "faucet",
    inputs: [],
    outputs: [],
  },
] as const;

export const useFaucet = (onSuccess?: () => void) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [mintingState, setMintingState] = useState<
    "idle" | "minting" | "minted" | "error"
  >("idle");

  const mintToken = useCallback(
    async (token: Token): Promise<boolean> => {
      if (!walletClient || !address || !publicClient) {
        toast.error("Wallet not connected");
        return false;
      }

      setMintingState("minting");
      const toastId = toast.loading(`Claiming ${token.symbol}...`);

      try {
        const tokenContract = getContract({
          address: token.address,
          abi: ERC20_FAUCET_ABI,
          client: walletClient,
        });

        const mintHash = await tokenContract.write.faucet();

        toast.loading("Waiting for confirmation...", { id: toastId });

        await publicClient.waitForTransactionReceipt({
          hash: mintHash,
          timeout: 60_000,
        });

        setMintingState("minted");
        toast.success(`${token.symbol} claimed!`, {
          id: toastId,
          duration: 3000,
        });

        if (onSuccess) {
          onSuccess();
          console.log("onSuccess");
        }

        setTimeout(() => {
          setMintingState("idle");
        }, 3000);

        return true;
      } catch (error) {
        console.error("Mint error:", error);
        setMintingState("error");
        toast.error(
          `Claim failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { id: toastId }
        );

        setTimeout(() => {
          setMintingState("idle");
        }, 3000);

        return false;
      }
    },
    [walletClient, address, publicClient, onSuccess]
  );

  const getMintButtonText = useCallback((): string => {
    switch (mintingState) {
      case "minting":
        return "Claiming...";
      case "minted":
        return "Claimed!";
      case "error":
        return "Error";
      default:
        return "Claim Test Tokens";
    }
  }, [mintingState]);

  return {
    mintToken,
    mintingState,
    getMintButtonText,
    isMinting: mintingState === "minting",
    canMint: isConnected && mintingState === "idle",
  };
};
