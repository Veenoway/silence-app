"use client";

import {
  toHex,
  useFHEDecrypt,
  useFHEEncryption,
  useFhevm,
  useInMemoryStorage,
} from "fhevm-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatUnits, getContract, parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
} from "wagmi";
import { useWagmiEthers } from "../lib/wagmi/useWagmiEthers";

export type Token = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export type PoolStats = {
  deposited: string;
  withdrawn: string;
  depositors: string;
};

const SILENTPOOL_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getEncryptedBalance",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "bytes32", name: "" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPoolStats",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { type: "uint256", name: "deposited" },
      { type: "uint256", name: "withdrawn" },
      { type: "uint256", name: "depositors" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addSupportedToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "requestWithdrawal",
    inputs: [
      { name: "token", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ type: "uint256", name: "requestId" }],
  },
  {
    type: "function",
    name: "withdrawalRequests",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "recipient", type: "address" },
      { name: "fulfilled", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
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
    name: "faucet",
    inputs: [],
    outputs: [],
  },
] as const;

const isEmptyHandle = (handle: string | undefined) => {
  if (!handle) return true;
  return (
    handle ===
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
};

export const useSilentPool = (parameters: {
  silentPoolAddress: `0x${string}`;
  tokens: Token[];
}) => {
  const { silentPoolAddress, tokens } = parameters;

  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { ethersSigner } = useWagmiEthers();
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>(
    {}
  );
  const [mintingState, setMintingState] = useState<
    "idle" | "minting" | "minted" | "error"
  >("idle");
  const [poolStats, setPoolStats] = useState<Record<string, PoolStats>>({});
  const [selectedToken, setSelectedToken] = useState<Token>(tokens[0]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Set<number>>(
    new Set()
  );

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider: publicClient,
    chainId: chain?.id,
    enabled: isConnected && !!publicClient,
  });

  const isFhevmReady = fhevmStatus === "ready" && !!fhevmInstance;
  const canInteract = isConnected && isFhevmReady && !isProcessing;

  const { canEncrypt, encryptWith } = useFHEEncryption({
    instance: fhevmInstance,
    ethersSigner: ethersSigner as any,
    contractAddress: silentPoolAddress,
  });

  const { data: encryptedBalanceHandle, refetch: refetchBalance } =
    useReadContract({
      address: silentPoolAddress,
      abi: SILENTPOOL_ABI,
      functionName: "getEncryptedBalance",
      args:
        address && selectedToken ? [address, selectedToken.address] : undefined,
      query: {
        enabled: !!address && !!selectedToken && isFhevmReady,
      },
    });

  console.log("Encrypted balance handle:", {
    handle: encryptedBalanceHandle,
    isEmpty: isEmptyHandle(encryptedBalanceHandle as string),
    token: selectedToken?.symbol,
  });

  const decryptRequests = useMemo(() => {
    const handleStr = encryptedBalanceHandle as string;

    console.log("Building decrypt requests:", {
      handle: handleStr,
      isEmpty: isEmptyHandle(handleStr),
      hasToken: !!selectedToken,
    });

    if (isEmptyHandle(handleStr) || !selectedToken) {
      console.log("Skipping decrypt: empty handle or no token");
      return undefined;
    }

    const requests = [
      {
        handle: handleStr,
        contractAddress: silentPoolAddress,
      },
    ];

    console.log("Decrypt requests created:", requests);
    return requests;
  }, [encryptedBalanceHandle, selectedToken, silentPoolAddress]);

  const {
    canDecrypt,
    decrypt: decryptBalance,
    isDecrypting,
    results: decryptedResults,
    message: decryptMessage,
    error: decryptError,
  } = useFHEDecrypt({
    instance: fhevmInstance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId: chain?.id,
    requests: decryptRequests,
  });

  useEffect(() => {
    console.log("Decrypt hook state:", {
      canDecrypt,
      isDecrypting,
      hasResults: !!decryptedResults,
      decryptMessage,
      decryptError,
      hasRequests: !!decryptRequests,
      requestsLength: decryptRequests?.length,
    });
    if (decryptError) {
      console.error("Decrypt error:", decryptError);
      setMessage(
        `Decrypt failed: ${
          decryptError instanceof Error
            ? decryptError.message
            : String(decryptError)
        }`
      );
    }
    if (decryptMessage) {
      setMessage(decryptMessage);
    }
  }, [
    canDecrypt,
    isDecrypting,
    decryptedResults,
    decryptMessage,
    decryptRequests,
  ]);

  const decryptedBalance = useMemo(() => {
    if (!encryptedBalanceHandle || !decryptedResults) return undefined;
    const handleStr = encryptedBalanceHandle as string;
    const result = decryptedResults[handleStr];

    console.log("Decrypted balance:", {
      handle: handleStr,
      result,
      allResults: decryptedResults,
    });

    return result;
  }, [encryptedBalanceHandle, decryptedResults]);

  const hasBalance = useMemo(() => {
    return !isEmptyHandle(encryptedBalanceHandle as string);
  }, [encryptedBalanceHandle]);

  const loadBalances = useCallback(async () => {
    if (!address || !publicClient) return;

    setMessage("Loading balances...");
    const newBalances: Record<string, string> = {};
    const newStats: Record<string, PoolStats> = {};

    try {
      await Promise.all(
        tokens.map(async (token) => {
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
          const [deposited, withdrawn, depositors] =
            await poolContract.read.getPoolStats([token.address]);
          newStats[token.symbol] = {
            deposited: formatUnits(deposited, token.decimals),
            withdrawn: formatUnits(withdrawn, token.decimals),
            depositors: depositors.toString(),
          };
        })
      );

      setTokenBalances(newBalances);
      setPoolStats(newStats);
      setMessage("");
    } catch (error) {
      setMessage(
        `Error loading balances: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [address, publicClient, tokens, silentPoolAddress]);

  useEffect(() => {
    if (address) {
      loadBalances();
    }
  }, [address, loadBalances]);

  const mintToken = useCallback(
    async (token: Token) => {
      if (!walletClient || !address) return;
      setMintingState("minting");
      toast.loading(`Minting ${token.symbol}...`);

      try {
        const tokenContract = getContract({
          address: token.address,
          abi: ERC20_ABI,
          client: walletClient,
        });
        const mintHash = await tokenContract.write.faucet();
        await publicClient!.waitForTransactionReceipt({ hash: mintHash });

        setMintingState("minted");
        toast.success(`${token.symbol} minted successfully!`);
        await loadBalances();
      } catch (error) {
        setMintingState("error");
        toast.error(
          `❌ Mint failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        setTimeout(() => {
          setMintingState("idle");
        }, 3000);
      }
    },
    [walletClient, address, publicClient, loadBalances]
  );

  const deposit = useCallback(
    async (token: Token, amount: string) => {
      if (!walletClient || !address || !amount) return;

      setIsProcessing(true);
      toast.loading(`Starting deposit of ${amount} ${token.symbol}...`);

      try {
        const amountBigInt = parseUnits(amount, token.decimals);

        toast.loading("Approving token...");
        const tokenContract = getContract({
          address: token.address,
          abi: ERC20_ABI,
          client: walletClient,
        });
        const approveHash = await tokenContract.write.approve([
          silentPoolAddress,
          amountBigInt,
        ]);
        await publicClient!.waitForTransactionReceipt({
          hash: approveHash,
          timeout: 60_000,
          confirmations: 1,
        });

        toast.loading("Depositing...");
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const depositHash = await poolContract.write.deposit([
          token.address,
          amountBigInt,
        ]);
        const receipt = await publicClient!.waitForTransactionReceipt({
          hash: depositHash,
          timeout: 120_000,
          confirmations: 2,
        });

        toast.success("Deposit successful! Waiting for balance update...");

        await new Promise((resolve) => setTimeout(resolve, 3000));

        await loadBalances();
        await refetchBalance();

        toast.success("Deposit complete!");
      } catch (error) {
        console.error("Deposit error:", error);
        toast.error(
          `Deposit failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        toast.dismiss();
        setIsProcessing(false);
      }
    },
    [
      walletClient,
      address,
      publicClient,
      silentPoolAddress,
      loadBalances,
      refetchBalance,
    ]
  );

  const withdraw = useCallback(
    async (token: Token, amount: string, recipient: string) => {
      if (
        !walletClient ||
        !address ||
        !amount ||
        !fhevmInstance ||
        !canEncrypt
      ) {
        toast.error("Not ready to withdraw");
        return;
      }

      setIsProcessing(true);
      toast.loading(`Starting withdrawal of ${amount} ${token.symbol}...`);
      try {
        const amountBigInt = parseUnits(amount, token.decimals);
        const encryptedInput = await encryptWith((builder) => {
          builder.add128(amountBigInt);
        });

        if (!encryptedInput) {
          throw new Error("Failed to create encrypted input");
        }

        let handleHex: `0x${string}`;
        let inputProofHex: `0x${string}`;

        if (encryptedInput.handles[0] instanceof Uint8Array)
          handleHex = toHex(encryptedInput.handles[0]);
        else if (typeof encryptedInput.handles[0] === "string")
          handleHex = encryptedInput.handles[0] as `0x${string}`;
        else
          handleHex = toHex(
            new Uint8Array(Object.values(encryptedInput.handles[0] as any))
          );

        if (encryptedInput.inputProof instanceof Uint8Array)
          inputProofHex = toHex(encryptedInput.inputProof);
        else if (typeof encryptedInput.inputProof === "string")
          inputProofHex = encryptedInput.inputProof as `0x${string}`;
        else
          inputProofHex = toHex(
            new Uint8Array(Object.values(encryptedInput.inputProof as any))
          );

        console.log("Converted to hex:", {
          handleHex,
          inputProofHex,
          handleLength: handleHex.length,
          proofLength: inputProofHex.length,
        });

        toast.loading(
          `Requesting withdrawal to ${recipient.slice(
            0,
            6
          )}...${recipient.slice(-4)}...`
        );

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const withdrawHash = await poolContract.write.requestWithdrawal([
          token.address,
          handleHex,
          inputProofHex,
          recipient,
        ]);

        toast.loading("Waiting for transaction confirmation...");

        await publicClient!.waitForTransactionReceipt({
          hash: withdrawHash,
          timeout: 120_000,
          confirmations: 2,
        });

        toast.success(
          "Withdrawal requested! Gateway is processing (30-60 seconds)..."
        );

        await new Promise((resolve) => setTimeout(resolve, 60000));

        toast.loading("Checking if withdrawal is completed...");
        await loadBalances();
        await refetchBalance();

        toast.success("Withdrawal complete!");
      } catch (error) {
        console.error("Withdrawal error:", error);
        toast.error(
          `Withdrawal failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        toast.dismiss();
        setIsProcessing(false);
      }
    },
    [
      walletClient,
      address,
      fhevmInstance,
      canEncrypt,
      encryptWith,
      publicClient,
      silentPoolAddress,
      loadBalances,
      refetchBalance,
    ]
  );

  const testPermissions = useCallback(async () => {
    if (!publicClient || !address || !selectedToken) return;

    setMessage("Testing permissions...");

    try {
      const result = await publicClient.readContract({
        address: silentPoolAddress,
        abi: [
          ...SILENTPOOL_ABI,
          {
            type: "function",
            name: "testPermissions",
            inputs: [{ name: "token", type: "address" }],
            outputs: [{ type: "bool" }],
            stateMutability: "view",
          },
        ],
        functionName: "testPermissions",
        args: [selectedToken.address],
      });

      if (result === true) {
        setMessage("Permissions exist! Problem is elsewhere.");
      } else {
        setMessage("Permissions DO NOT exist! This is a Zama bug.");
      }

      return result;
    } catch (error) {
      console.error("Test error:", error);
      setMessage(
        `Test failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }, [publicClient, address, selectedToken, silentPoolAddress]);

  const refreshPermissions = useCallback(async () => {
    if (!address || !isFhevmReady) return;

    setMessage("Refreshing FHE permissions...");

    try {
      await refetchBalance();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setMessage("Permissions refreshed! Try decrypting now.");
    } catch (error) {
      setMessage(
        `Error refreshing: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [address, isFhevmReady, refetchBalance]);

  const getMintingState = useCallback(() => {
    switch (mintingState) {
      case "minting":
        return "Claiming...";
      case "minted":
        return "Claimed!";
      case "idle":
        return "Claim";
      case "error":
        return "Error";
      default:
        return "Claim";
    }
  }, [mintingState]);

  return {
    address,
    isConnected,
    chainId: chain?.id,
    fhevmInstance,
    fhevmStatus,
    fhevmError,
    isFhevmReady,
    selectedToken,
    setSelectedToken,
    tokens,
    tokenBalances,
    poolStats,
    loadBalances,
    encryptedBalanceHandle,
    decryptedBalance,
    canDecrypt,
    decryptBalance,
    isDecrypting,
    hasBalance, // ✅ Nouveau!
    canInteract,
    deposit,
    mintToken,
    message,
    isProcessing,
    refreshPermissions,
    testPermissions,
    withdraw,
    canEncrypt,
    mintingState,
    getMintingState,
  };
};
