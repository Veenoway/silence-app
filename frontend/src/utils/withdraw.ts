"use client";

import type { PendingWithdrawal } from "./useWithdrawalManager";

/**
 * Utility functions for withdrawal flow
 */

/**
 * Parse note string to extract details safely
 */
export function parseNoteDetails(noteString: string): {
  token: string;
  amount: string;
  poolId: number;
  chainId: number;
} | null {
  try {
    if (!noteString.startsWith("silentpool-")) {
      throw new Error("Invalid note format");
    }

    const base64 = noteString.replace("silentpool-", "");
    const jsonString = Buffer.from(base64, "base64").toString("utf-8");
    const note = JSON.parse(jsonString);

    return {
      token: note.token || "Unknown",
      amount: note.amount || "?",
      poolId: note.poolId ?? 0,
      chainId: note.chainId || 0,
    };
  } catch (error) {
    console.error("Error parsing note:", error);
    return null;
  }
}

/**
 * Get human-readable token symbol from address
 */
export function getTokenSymbol(tokenAddress: string): string {
  const knownTokens: Record<string, string> = {
    "0x0000000000000000000000000000000000000000": "ETH",
    "0xE12F41ad58856673247Cbb785EA5c8fD7cce466d": "USDC",
    // Add your known tokens here
    // "0x...": "USDC",
    // "0x...": "DAI",
  };

  return knownTokens[tokenAddress] || tokenAddress.slice(0, 6) + "...";
}

/**
 * Format time remaining in human-readable format
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ready now!";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Validate recipient address format
 */
export function validateRecipient(address: string): {
  valid: boolean;
  error?: string;
} {
  if (!address) {
    return { valid: false, error: "Address is required" };
  }

  if (!address.startsWith("0x")) {
    return { valid: false, error: "Address must start with 0x" };
  }

  if (address.length !== 42) {
    return { valid: false, error: "Address must be 42 characters" };
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: "Address contains invalid characters" };
  }

  return { valid: true };
}

/**
 * Clean up expired withdrawals (fulfilled or very old)
 */
export function cleanupOldWithdrawals(
  withdrawals: PendingWithdrawal[],
  maxAgeHours: number = 48
): PendingWithdrawal[] {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;

  return withdrawals.filter((w) => {
    const age = now - w.requestTimestamp;
    return age < maxAge; // Keep only recent ones
  });
}

/**
 * Group withdrawals by status for display
 */
export function groupWithdrawalsByStatus(withdrawals: PendingWithdrawal[]): {
  ready: PendingWithdrawal[];
  soon: PendingWithdrawal[]; // < 1 minute
  pending: PendingWithdrawal[];
} {
  const now = Date.now();

  return withdrawals.reduce(
    (acc, withdrawal) => {
      const timeLeft = withdrawal.expiresAt - now;

      if (timeLeft <= 0) {
        acc.ready.push(withdrawal);
      } else if (timeLeft < 60000) {
        // < 1 minute
        acc.soon.push(withdrawal);
      } else {
        acc.pending.push(withdrawal);
      }

      return acc;
    },
    { ready: [], soon: [], pending: [] } as {
      ready: PendingWithdrawal[];
      soon: PendingWithdrawal[];
      pending: PendingWithdrawal[];
    }
  );
}

/**
 * Calculate optimal gas settings
 */
export async function estimateOptimalGas(
  publicClient: any,
  transaction: any
): Promise<{
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> {
  try {
    const [gasLimit, block] = await Promise.all([
      publicClient.estimateGas(transaction),
      publicClient.getBlock({ blockTag: "latest" }),
    ]);

    // Add 20% buffer to gas limit
    const bufferedGasLimit = (gasLimit * 120n) / 100n;

    // Calculate fees based on latest block
    const baseFee = block.baseFeePerGas || 0n;
    const maxPriorityFeePerGas = 2n * 10n ** 9n; // 2 gwei tip
    const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

    return {
      gasLimit: bufferedGasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  } catch (error) {
    console.error("Error estimating gas:", error);
    // Return safe defaults
    return {
      gasLimit: 300000n,
      maxFeePerGas: 50n * 10n ** 9n,
      maxPriorityFeePerGas: 2n * 10n ** 9n,
    };
  }
}

/**
 * Retry logic for failed transactions
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, i); // Exponential backoff
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Check if network supports the withdrawal
 */
export function isNetworkSupported(chainId: number): {
  supported: boolean;
  message?: string;
} {
  const supportedChains = [
    1, // Ethereum Mainnet
    5, // Goerli
    11155111, // Sepolia
    137, // Polygon
    // Add your supported chains
  ];

  if (supportedChains.includes(chainId)) {
    return { supported: true };
  }

  return {
    supported: false,
    message: `Chain ID ${chainId} is not supported. Please switch networks.`,
  };
}

/**
 * Format transaction hash for display
 */
export function formatTxHash(hash: string, length: number = 10): string {
  if (!hash || hash.length < length * 2) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

/**
 * Get block explorer URL
 */
export function getExplorerUrl(
  chainId: number,
  txHash?: string,
  address?: string
): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io",
    5: "https://goerli.etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    137: "https://polygonscan.com",
    // Add more chains
  };

  const baseUrl = explorers[chainId] || "https://etherscan.io";

  if (txHash) {
    return `${baseUrl}/tx/${txHash}`;
  } else if (address) {
    return `${baseUrl}/address/${address}`;
  }

  return baseUrl;
}

/**
 * Error handler with user-friendly messages
 */
export function handleWithdrawalError(error: any): {
  title: string;
  message: string;
  canRetry: boolean;
} {
  const errorMessage = error?.message || String(error);

  // User rejected transaction
  if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("user rejected")
  ) {
    return {
      title: "Transaction Cancelled",
      message: "You rejected the transaction in your wallet",
      canRetry: true,
    };
  }

  // Insufficient funds
  if (
    errorMessage.includes("insufficient funds") ||
    errorMessage.includes("not enough")
  ) {
    return {
      title: "Insufficient Funds",
      message: "You don't have enough ETH to pay for gas fees",
      canRetry: false,
    };
  }

  // Network error
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("connection")
  ) {
    return {
      title: "Network Error",
      message: "Connection failed. Please check your internet and try again",
      canRetry: true,
    };
  }

  // Already spent note
  if (
    errorMessage.includes("nullifier") ||
    errorMessage.includes("already spent")
  ) {
    return {
      title: "Note Already Used",
      message:
        "This note has already been spent. Each note can only be used once",
      canRetry: false,
    };
  }

  // Still waiting
  if (errorMessage.includes("wait") || errorMessage.includes("delay")) {
    return {
      title: "Still Waiting",
      message:
        "The withdrawal delay hasn't expired yet. Please wait a bit longer",
      canRetry: false,
    };
  }

  // Generic error
  return {
    title: "Transaction Failed",
    message: errorMessage.slice(0, 100) + "...",
    canRetry: true,
  };
}

/**
 * Local storage wrapper with error handling
 */
export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return defaultValue;
    }
  },

  set: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error);
      return false;
    }
  },

  remove: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage (${key}):`, error);
      return false;
    }
  },
};

/**
 * Copy to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    return false;
  }
}

/**
 * Generate a shareable withdrawal link (for advanced users)
 */
export function generateWithdrawalLink(
  noteString: string,
  recipient?: string
): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();

  params.set("note", noteString);
  if (recipient) {
    params.set("recipient", recipient);
  }

  return `${baseUrl}/withdraw?${params.toString()}`;
}
