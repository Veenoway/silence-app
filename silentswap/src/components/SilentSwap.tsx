"use client";

import { useState } from "react";
import { getContract } from "viem";
import {
  useAccount,
  useDisconnect,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { CONTRACT_ABI } from "../contract";
import { useSilentPool } from "../hooks/useSilentPool";
import { WalletConnection } from "./ConnectModal";

const SILENTPOOL_ADDRESS = process.env
  .NEXT_PUBLIC_SILENTPOOL_ADDRESS as `0x${string}`;

const TOKENS = [
  {
    symbol: "USDC",
    address: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
    decimals: 6,
  },
  {
    symbol: "USDT",
    address: process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`,
    decimals: 6,
  },
  {
    symbol: "DAI",
    address: process.env.NEXT_PUBLIC_DAI_ADDRESS as `0x${string}`,
    decimals: 18,
  },
];

export default function SilentPoolPage() {
  const { chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  const {
    address,
    isConnected,
    isFhevmReady,
    fhevmStatus,
    selectedToken,
    setSelectedToken,
    tokens,
    tokenBalances,
    poolStats,
    decryptedBalance,
    canDecrypt,
    decryptBalance,
    isDecrypting,
    refreshPermissions,
    canInteract,
    deposit,
    mintToken,
    encryptedBalanceHandle,
    hasBalance,
    testPermissions,
    withdraw, // ✅ Fonction withdraw
    canEncrypt,
    message,
    isProcessing,
    mintingState,
    getMintingState,
  } = useSilentPool({
    silentPoolAddress: SILENTPOOL_ADDRESS,
    tokens: TOKENS,
  });

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

  const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  const addSupportedToken = async () => {
    if (!walletClient || !address) return;
    setIsLoading(true);
    try {
      const poolContract = getContract({
        address: SILENTPOOL_ADDRESS,
        abi: CONTRACT_ABI,
        client: walletClient,
      });
      const addSupportedTokenHash = await poolContract.write.addSupportedToken([
        USDC_ADDRESS,
      ]);
      await publicClient.waitForTransactionReceipt({
        hash: addSupportedTokenHash,
      });
      alert("✅ Add supported token successful!");
    } catch (err) {
      console.error("Add supported token error:", err);
      alert("❌ Add supported token failed. See console.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <WalletConnection />
      </div>
    );
  }
  console.log("encryptedBalanceHandle", decryptedBalance);

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex flex-col items-center justify-center">
          <h1 className="text-7xl font-extrabold mb-4 mt-5 text-center text-white uppercase font-syne ">
            Silence <br />
          </h1>{" "}
          <span className="text-xl font-medium text-white/60 font-syne text-center">
            Zero-Knowledge . Anonymous Withdrawals . Private Deposits
          </span>
          {/* <p className="text-center text-slate-400">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
          <p className="text-center">
            FHEVM: {isFhevmReady ? "✅ Ready" : `⌛ ${fhevmStatus}`}
          </p>
          {message && (
            <p className="text-center text-yellow-400 mt-2">{message}</p>
          )} */}
        </div>

        {/* Actions rapides */}
        {/* <div className="flex gap-4 mb-8 justify-center">
          <button
            onClick={() => mintToken(selectedToken)}
            disabled={isProcessing || !isFhevmReady}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
          >
            🎁 Mint {selectedToken.symbol}
          </button>
          <button
            onClick={disconnect}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold"
          >
            Disconnect
          </button>
          <button
            onClick={addSupportedToken}
            disabled={isProcessing}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
          >
            Add Supported Token
          </button>
          <button
            onClick={testPermissions}
            className="w-full bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg text-sm"
          >
            🧪 Test Permissions
          </button>
        </div> */}
        <div className="flex gap-5 max-w-5xl mx-auto">
          <div className="w-full">
            <div className="mx-auto mb-5 grid grid-cols-5 gap-5">
              <div className="col-span-3">
                <div className="grid grid-cols-2 gap-5 h-full">
                  <div className="border border-white/80 p-6 flex flex-col items-center h-full justify-between">
                    <h2 className="text-base font-bold text-white/60 font-syne">
                      USDC Faucet
                    </h2>
                    <h2 className="text-5xl mb-2 font-bold text-white font-syne">
                      1000
                    </h2>
                    <button
                      onClick={() => mintToken(TOKENS[0])}
                      disabled={mintingState !== "idle"}
                      className="bg-black font-bold px-3 w-[90%] mx-auto mt-2 text-lg border h-[52px] border-white text-white hover:border-black hover:text-black hover:bg-white transition-all duration-200 ease-in-out disabled:opacity-50"
                    >
                      <span className="text-lg">{getMintingState()}</span>
                    </button>
                  </div>
                  <div className="border border-white/80 p-6 flex flex-col items-center h-full justify-between">
                    <div>
                      <h2 className="text-base mb-2 font-bold text-white/60 font-syne">
                        Private Balances
                      </h2>
                      {decryptedBalance ? (
                        <p className="text-5xl font-bold text-white font-syne">
                          {formatNumber(Number(decryptedBalance))}
                        </p>
                      ) : (
                        <p className="text-5xl font-bold text-white font-syne">
                          ******
                        </p>
                      )}
                    </div>
                    <div className="flex items-center w-full mt-auto">
                      <button
                        onClick={decryptBalance}
                        disabled={
                          !canDecrypt ||
                          isDecrypting ||
                          !hasBalance ||
                          Number(decryptedBalance) > 0
                        }
                        className="bg-black w-full font-bold px-3 mx-auto text-lg border h-[52px] border-white text-white hover:border-black hover:text-black hover:bg-white transition-all duration-200 ease-in-out disabled:opacity-50"
                      >
                        <span className="text-lg">
                          {isDecrypting ? "Decrypting..." : "Reveal"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-white/80 p-6 col-span-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl text-left w-full font-bold text-white font-syne">
                    Pool stats
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex flex-col border border-white/80 p-4">
                    <p className="text-sm font-bold text-white/60 font-syne text-center">
                      Pool Size
                    </p>
                    <p className="text-white text-2xl font-bold text-center">
                      ${poolStats[selectedToken.symbol]?.deposited}
                    </p>
                  </div>
                  <div className="flex flex-col border border-white/80 p-4">
                    <p className="text-sm font-bold text-white/60 font-syne text-center">
                      Users
                    </p>
                    <p className="text-white text-2xl font-bold text-center">
                      {poolStats[selectedToken.symbol]?.depositors}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Deposit & Withdraw Forms */}
            <div className="mx-auto border border-white/80 p-6 mb-10">
              <div className="flex justify-between items-start">
                {" "}
                {activeTab === "deposit" ? (
                  <div>
                    <h2 className="text-3xl mb-2 font-bold text-white font-syne ">
                      Deposit to Pool
                    </h2>
                    <p className="text-white/80 mb-5 text-base">
                      Deposit your tokens into the privacy pool. You'll receive
                      a secret note that allows you to withdraw to any address
                      later.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-3xl mb-2 font-bold text-white font-syne">
                      Withdraw from Pool
                    </h2>
                    <p className="text-white/80 mb-5 text-base">
                      Deposit your tokens into the privacy pool. You'll receive
                      a secret note that allows you to withdraw to any address
                      later.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-end relative mb-1 ml-auto w-full ">
                  <button
                    onClick={() => setActiveTab("withdraw")}
                    className={`font-bold px-3 text-lg border h-[52px] border-transparent  transition-all duration-200 ease-in-out ${
                      activeTab === "withdraw"
                        ? "bg-white text-black"
                        : "bg-black text-white/80 border-white"
                    }`}
                  >
                    Withdraw
                  </button>
                  <button
                    onClick={() => setActiveTab("deposit")}
                    className={`font-bold px-3 text-lg border h-[52px] border-transparent transition-all duration-200 ease-in-out ${
                      activeTab === "deposit"
                        ? "bg-white text-black"
                        : "bg-black text-white/80 border-white border"
                    }`}
                  >
                    Deposit
                  </button>
                </div>
              </div>
              <div
                className={`flex items-center justify-start relative ml-auto w-full gap-4 mb-3 mt-5 ${
                  activeTab === "withdraw" ? "hidden" : ""
                }`}
              >
                <h2 className="text-xl font-medium text-white/60 font-syne">
                  Holdings:
                </h2>

                <div className="text-xl font-bold text-white font-syne flex items-center gap-2">
                  {tokenBalances[selectedToken.symbol] || "0"}{" "}
                  {selectedToken.symbol}
                </div>
              </div>
              {activeTab === "withdraw" ? (
                <div className="space-y-4">
                  <div className="">
                    <label className="block text-white/80 mb-2 text-sm">
                      Amount to withdraw
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full p-3 px-6 bg-transparent border border-white text-2xl focus:outline-none h-16"
                      disabled={isProcessing || !canInteract || !canEncrypt}
                    />
                  </div>

                  <div className="mt-5">
                    <label className="block text-white/80 mb-2 text-sm">
                      Recipient address (can be yourself or anyone else for
                      privacy!)
                    </label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="w-full p-3 px-6 bg-transparent border border-white text-2xl focus:outline-none h-16 "
                      disabled={isProcessing || !canInteract || !canEncrypt}
                    />
                  </div>

                  <button
                    onClick={() => {
                      const recipient = recipientAddress || address!;
                      withdraw(selectedToken, withdrawAmount, recipient);
                    }}
                    disabled={
                      !canInteract ||
                      !canEncrypt ||
                      !withdrawAmount ||
                      !hasBalance
                    }
                    className="w-full bg-white font-bold text-2xl border-2 h-[60px] border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out disabled:opacity-50"
                  >
                    {isProcessing ? "Processing..." : "Withdraw"}
                  </button>

                  {!hasBalance && (
                    <div className="text-yellow-400 text-sm text-center">
                      ⚠️ No encrypted balance. Make a deposit first!
                    </div>
                  )}

                  {!canEncrypt && isFhevmReady && (
                    <div className="text-yellow-400 text-sm text-center">
                      ⚠️ Encryption not ready. Please wait...
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center border border-white h-16 mb-5">
                    <input
                      type="number"
                      placeholder="0"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full p-3 px-6 bg-transparent text-2xl h-full focus:outline-none"
                      disabled={isProcessing || !canInteract}
                      style={{
                        WebkitAppearance: "none",
                        MozAppearance: "textfield",
                        appearance: "none",
                      }}
                    />
                    <button
                      onClick={() =>
                        setDepositAmount(
                          tokenBalances[selectedToken.symbol] || "0"
                        )
                      }
                      className="bg-white font-bold px-3 mr-1 text-lg border-2 h-[52px] border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out"
                    >
                      MAX
                    </button>
                    <div className="w-full h-full bg-white text-black text-2xl font-syne font-bold p-3 max-w-40 flex items-center justify-center">
                      <img
                        src="https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png"
                        className="w-7 h-7 mr-2"
                      />{" "}
                      USDC
                    </div>
                  </div>
                  <button
                    onClick={() => deposit(selectedToken, depositAmount)}
                    disabled={!canInteract || !depositAmount}
                    className="w-full bg-white font-bold text-2xl border-2 h-[60px] border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out disabled:opacity-50"
                  >
                    {isProcessing ? "Processing..." : "Deposit"}
                  </button>
                </>
              )}
            </div>{" "}
          </div>{" "}
        </div>
        {/* <div className="grid grid-cols-2 gap-4">
          {/* DEPOSIT SECTION
                    <button
                      onClick={decryptBalance}
                      disabled={!canDecrypt || isDecrypting || !hasBalance}
                      className="bg-white font-bold px-3 mr-1  mt-2 text-lg border-2 h-[52px] border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out mb-4 disabled:opacity-50"
                    >
                      <span className="text-lg">
                        {isDecrypting ? "Decrypting..." : "Reveal Balance"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="w-auto">
              <h2 className="text-3xl mb-4 font-bold text-white font-syne">
                Deposit
              </h2>

              <div className="flex items-center border border-white h-16 mb-5">
                <input
                  type="number"
                  placeholder="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full p-3 bg-transparent text-2xl h-full focus:outline-none"
                  disabled={isProcessing || !canInteract}
                  style={{
                    WebkitAppearance: "none",
                    MozAppearance: "textfield",
                    appearance: "none",
                  }}
                />
                <button
                  onClick={() =>
                    setDepositAmount(tokenBalances[selectedToken.symbol] || "0")
                  }
                  className="bg-white font-bold px-3 mr-1 text-lg border-2 h-[52px] border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out"
                >
                  MAX
                </button>
                <select
                  value={selectedToken.symbol}
                  onChange={(e) =>
                    setSelectedToken(
                      tokens.find((t) => t.symbol === e.target.value)!
                    )
                  }
                  className="w-full h-full bg-white text-black text-xl font-syne font-bold p-3 max-w-40"
                  disabled={isProcessing}
                >
                  {tokens.map((token) => (
                    <option key={token.symbol} className="text-black">
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => deposit(selectedToken, depositAmount)}
                disabled={!canInteract || !depositAmount}
                className="w-full bg-white font-bold text-2xl border-2 h-[60px] border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Deposit"}
              </button>
            </div>
          </div>

          {/* WITHDRAW SECTION
          <div className="p-6 px-7 border border-white/80 mb-8 w-full">
            <h2 className="text-3xl mb-4 font-bold text-white font-syne">
              Withdraw
            </h2>

            {/* Pool Stats d'abord 
            <div className="mb-6">
              {tokens.map((token) => {
                const stats = poolStats[token.symbol];
                if (!stats) return null;
                return (
                  <div
                    key={token.symbol}
                    className="mb-4 p-4 border border-white/80"
                  >
                    <h3 className="font-extrabold text-xl text-white text-center font-syne mb-2">
                      {token.symbol}
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-white/60">Deposited</div>
                        <div className="text-white text-2xl">
                          {stats.deposited}
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-white/60">Withdrawn</div>
                        <div className="text-white text-2xl">
                          {stats.withdrawn}
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-white/60">Depositors</div>
                        <div className="text-white text-2xl">
                          {stats.depositors}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ✅ Formulaire de withdraw 
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 mb-2 text-sm">
                  Amount to withdraw
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full p-3 bg-transparent border border-white text-xl focus:outline-none"
                  disabled={isProcessing || !canInteract || !canEncrypt}
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2 text-sm">
                  Recipient address (can be yourself or anyone else for
                  privacy!)
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="w-full p-3 bg-transparent border border-white text-sm focus:outline-none"
                  disabled={isProcessing || !canInteract || !canEncrypt}
                />
              </div>

              <button
                onClick={() => {
                  // ✅ Utilise ton adresse par défaut si pas de recipient spécifié
                  const recipient = recipientAddress || address!;
                  withdraw(selectedToken, withdrawAmount, recipient);
                }}
                disabled={
                  !canInteract || !canEncrypt || !withdrawAmount || !hasBalance
                }
                className="w-full bg-white font-bold text-2xl border-2 h-[60px] border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Withdraw"}
              </button>

              {!hasBalance && (
                <div className="text-yellow-400 text-sm text-center">
                  ⚠️ No encrypted balance. Make a deposit first!
                </div>
              )}

              {!canEncrypt && isFhevmReady && (
                <div className="text-yellow-400 text-sm text-center">
                  ⚠️ Encryption not ready. Please wait...
                </div>
              )}
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
