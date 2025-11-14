"use client";

import { useFhevm } from "fhevm-sdk";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  encodeAbiParameters,
  formatUnits,
  getContract,
  keccak256,
  parseAbiParameters,
  parseUnits,
  toHex,
} from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

// ===== TYPES =====
export type Token = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export type Note = {
  nullifier: `0x${string}`;
  secret: `0x${string}`;
  commitment: `0x${string}`;
  token: string;
  amount: string;
  chainId: number;
};

export type PoolStats = {
  anonymitySetSize: string;
};

// ===== NOTE UTILITIES =====
export const generateNote = (
  token: string,
  amount: string,
  chainId: number
): Note => {
  // Générer des valeurs aléatoires de 32 bytes
  const nullifier = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const secret = toHex(crypto.getRandomValues(new Uint8Array(32)));

  // Calculer le commitment = keccak256(abi.encodePacked(nullifier, secret))
  const commitment = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [
      nullifier,
      secret,
    ])
  );

  return {
    nullifier,
    secret,
    commitment,
    token,
    amount,
    chainId,
  };
};

export const encodeNote = (note: Note): string => {
  const noteString = JSON.stringify(note);
  const base64 = Buffer.from(noteString).toString("base64");
  return `silentpool-${base64}`;
};

export const decodeNote = (noteString: string): Note => {
  if (!noteString.startsWith("silentpool-")) {
    throw new Error("Invalid note format");
  }

  const base64 = noteString.replace("silentpool-", "");
  const jsonString = Buffer.from(base64, "base64").toString("utf-8");
  return JSON.parse(jsonString);
};

export const validateNote = (note: Note): boolean => {
  try {
    const computed = keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [
        note.nullifier,
        note.secret,
      ])
    );
    return computed === note.commitment;
  } catch {
    return false;
  }
};

// ===== CONTRACT ABIs =====
const SILENTPOOL_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "secret", type: "bytes32" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ type: "uint256", name: "requestId" }],
  },
  {
    type: "function",
    name: "addSupportedToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getAnonymitySetSize",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
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
    name: "isCommitmentSpent",
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
  {
    type: "function",
    name: "getCommitmentAge",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawalRequests",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "commitment", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
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

// ===== HOOK =====
export const useSilentPool = (parameters: {
  silentPoolAddress: `0x${string}`;
  tokens: Token[];
}) => {
  const { silentPoolAddress, tokens } = parameters;

  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>(
    {}
  );
  const [poolStats, setPoolStats] = useState<Record<string, PoolStats>>({});
  const [selectedToken, setSelectedToken] = useState<Token>(tokens[0]);
  const [generatedNote, setGeneratedNote] = useState<string>("");
  const [mintingState, setMintingState] = useState<
    "idle" | "minting" | "minted" | "error"
  >("idle");

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

  // ===== LOAD BALANCES =====
  const loadBalances = useCallback(async () => {
    if (!address || !publicClient) return;

    const newBalances: Record<string, string> = {};
    const newStats: Record<string, PoolStats> = {};

    try {
      await Promise.all(
        tokens.map(async (token) => {
          // Wallet balance
          const tokenContract = getContract({
            address: token.address,
            abi: ERC20_ABI,
            client: publicClient,
          });
          const balance = await tokenContract.read.balanceOf([address]);
          newBalances[token.symbol] = formatUnits(balance, token.decimals);

          // Pool stats
          const poolContract = getContract({
            address: silentPoolAddress,
            abi: SILENTPOOL_ABI,
            client: publicClient,
          });
          const anonymitySetSize = await poolContract.read.getAnonymitySetSize([
            token.address,
          ]);
          newStats[token.symbol] = {
            anonymitySetSize: anonymitySetSize.toString(),
          };
        })
      );

      setTokenBalances(newBalances);
      setPoolStats(newStats);
    } catch (error) {
      console.error("Error loading balances:", error);
    }
  }, [address, publicClient, tokens, silentPoolAddress]);

  useEffect(() => {
    if (address) {
      loadBalances();
    }
  }, [address, loadBalances]);

  // ===== MINT TOKEN =====
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
        toast.success(`✅ ${token.symbol} minted!`);
        await loadBalances();
      } catch (error) {
        setMintingState("error");
        toast.error(
          `❌ Mint failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        setTimeout(() => setMintingState("idle"), 3000);
      }
    },
    [walletClient, address, publicClient, loadBalances]
  );

  // ===== DEPOSIT (avec génération de note) =====
  const deposit = useCallback(
    async (token: Token, amount: string) => {
      if (!walletClient || !address || !chain) return;

      setIsProcessing(true);
      toast.loading("Generating secret note...");

      try {
        // 1. ✅ Générer la note AVANT le deposit
        const note = generateNote(token.address, amount, chain.id);
        const noteString = encodeNote(note);

        console.log("📝 Generated note (SAVE THIS!):", noteString);

        // 2. Approve
        toast.loading("Approving token...");
        const amountBigInt = parseUnits(amount, token.decimals);
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
        });

        // 3. ✅ Deposit avec commitment
        toast.loading("Depositing anonymously...");
        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const depositHash = await poolContract.write.deposit([
          token.address,
          amountBigInt,
          note.commitment, // ✅ Commitment anonyme!
        ]);

        await publicClient!.waitForTransactionReceipt({
          hash: depositHash,
          timeout: 120_000,
          confirmations: 2,
        });

        toast.success("✅ Deposit complete! SAVE YOUR NOTE!");

        // 4. ✅ Stocker la note pour l'afficher
        setGeneratedNote(noteString);

        await loadBalances();

        return noteString;
      } catch (error) {
        console.error("Deposit error:", error);
        toast.error(
          `❌ Deposit failed: ${
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
      chain,
      publicClient,
      silentPoolAddress,
      loadBalances,
    ]
  );

  // ===== WITHDRAW (avec note) =====
  const withdraw = useCallback(
    async (noteString: string, recipient: string) => {
      if (!walletClient) return;

      setIsProcessing(true);
      toast.loading("Decoding note...");

      try {
        // 1. ✅ Décoder la note
        const note = decodeNote(noteString);

        // Valider la note
        if (!validateNote(note)) {
          throw new Error("Invalid note - commitment doesn't match");
        }

        // Vérifier que la note est pour la bonne chain
        if (chain && note.chainId !== chain.id) {
          toast.error(
            `⚠️ Note is for chain ${note.chainId}, but you're on chain ${chain.id}`
          );
        }

        // 2. ✅ Withdraw
        toast.loading(
          `Requesting withdrawal to ${recipient.slice(
            0,
            6
          )}...${recipient.slice(-4)}`
        );

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: walletClient,
        });

        const withdrawHash = await poolContract.write.withdraw([
          note.commitment,
          note.nullifier,
          note.secret,
          recipient as `0x${string}`,
        ]);

        toast.loading("Waiting for transaction...");

        await publicClient!.waitForTransactionReceipt({
          hash: withdrawHash,
          timeout: 120_000,
          confirmations: 2,
        });

        toast.success(
          "✅ Withdrawal requested! Gateway is processing (30-60 sec)..."
        );

        // 3. Attendre le Gateway
        await new Promise((resolve) => setTimeout(resolve, 60000));

        toast.loading("Checking if withdrawal completed...");
        await loadBalances();

        toast.success("✅ Withdrawal complete!");
      } catch (error) {
        console.error("Withdrawal error:", error);
        toast.error(
          `❌ Withdrawal failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        toast.dismiss();
        setIsProcessing(false);
      }
    },
    [walletClient, chain, publicClient, silentPoolAddress, loadBalances]
  );

  // ===== CHECK NOTE STATUS =====
  const checkNoteStatus = useCallback(
    async (noteString: string) => {
      if (!publicClient) return null;

      try {
        const note = decodeNote(noteString);

        const poolContract = getContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          client: publicClient,
        });

        const [exists, isSpent, nullifierUsed] = await Promise.all([
          poolContract.read.commitmentExists([note.commitment]),
          poolContract.read.isCommitmentSpent([note.commitment]),
          poolContract.read.isNullifierUsed([note.nullifier]),
        ]);

        return {
          exists,
          isSpent,
          nullifierUsed,
          canWithdraw: exists && !isSpent && !nullifierUsed,
        };
      } catch (error) {
        console.error("Error checking note:", error);
        return null;
      }
    },
    [publicClient, silentPoolAddress]
  );

  const getMintingState = useCallback(() => {
    switch (mintingState) {
      case "minting":
        return "Claiming...";
      case "minted":
        return "Claimed!";
      case "error":
        return "Error";
      default:
        return "Claim";
    }
  }, [mintingState]);

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

  return {
    // Connection
    address,
    isConnected,
    chainId: chain?.id,

    // FHEVM
    fhevmInstance,
    fhevmStatus,
    fhevmError,
    isFhevmReady,

    // Token
    selectedToken,
    setSelectedToken,
    tokens,
    tokenBalances,
    poolStats,

    // Actions
    canInteract,
    deposit,
    withdraw,
    mintToken,
    loadBalances,
    checkNoteStatus,

    // State
    message,
    isProcessing,
    generatedNote,
    setGeneratedNote,
    mintingState,
    getMintingState,
    testPermissions,

    // Utils
    generateNote,
    encodeNote,
    decodeNote,
    validateNote,
  };
};
