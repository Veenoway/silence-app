"use client";

import { useEffect, useRef, useState } from "react";
import { LuDownload } from "react-icons/lu";
import { VscCopy } from "react-icons/vsc";
import { toast } from "sonner";
import { getContract } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { CONTRACT_ABI } from "../contract";
import { useRecentDeposits } from "../hooks/useRecentDeposits";
import { useSilence } from "../hooks/useSilence";
import { PendingWithdrawals } from "./pendingWithdrawals";
import { RecentDeposits } from "./recentDeposit";
import { WithdrawalFlow } from "./withdraw";

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
    address: process.env.NEXT_PUBLIC_DAI_ADDRESS as `0x${string}`, // ✅ Fixé: était USDC_ADDRESS
    decimals: 18, // ✅ DAI a 18 decimals
  },
];

export default function SilentPoolPage() {
  const { address } = useAccount();

  const [depositAmount, setDepositAmount] = useState("10");
  const [noteString, setNoteString] = useState(""); // Pour le withdraw
  const [recipientAddress, setRecipientAddress] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [showNoteModal, setShowNoteModal] = useState(false);

  // ✅ Utilisation du nouveau hook
  const {
    // Connection
    isConnected,

    // Token & Pool
    selectedToken,
    setSelectedToken,
    tokens,
    selectedTokenBalance,
    selectedPoolInfo,

    // Actions
    depositToSelectedPool,
    requestWithdrawal,
    mintSelectedToken,
    checkNoteStatus,
    fulfillWithdrawal,
    getWithdrawalRequest,
    // State
    generatedNote,
    setGeneratedNote,
    isProcessing,
    canInteract,
    getMintButtonText,

    // Utils
    decodeNote,
    validateNote,
  } = useSilence({
    silentPoolAddress: SILENTPOOL_ADDRESS,
    tokens: TOKENS,
  });

  // ✅ Gérer le deposit avec affichage de la note
  const handleDeposit = async () => {
    if (!depositAmount) {
      toast.error("Please enter an amount");
      return;
    }

    const noteStr = await depositToSelectedPool(depositAmount);
    if (noteStr) {
      setShowNoteModal(true);
    }
  };

  // ✅ Gérer le withdraw avec la note (2 étapes maintenant)
  const handleWithdraw = async () => {
    if (!noteString.trim()) {
      toast.error("Please paste your note");
      return;
    }

    // Valider la note
    try {
      const note = decodeNote(noteString);
      if (!validateNote(note)) {
        toast.error("Invalid note - commitment doesn't match");
        return;
      }
    } catch (error) {
      toast.error("Invalid note format");
      return;
    }

    const recipient = recipientAddress || address!;

    // Étape 1: Demander le withdrawal
    const requestId = await requestWithdrawal(noteString, recipient);

    if (requestId !== null) {
      toast.success(
        "✅ Withdrawal requested! You'll need to claim after 1 hour.",
        { duration: 5000 }
      );
    }
  };

  const copyNote = () => {
    navigator.clipboard.writeText(generatedNote);
    toast.success("Note copied to clipboard!");
  };

  const downloadNote = () => {
    const blob = new Blob([generatedNote], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `silence-note-${Date.now()}.txt`;
    a.click();
    toast.success("Note saved!");
  };

  // ✅ Parser la note pour prévisualisation
  const notePreview = (() => {
    if (!noteString.trim()) return null;
    try {
      const note = decodeNote(noteString);
      // Valider que le commitment est correct
      if (!validateNote(note)) return null;
      return note;
    } catch {
      return null;
    }
  })();

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isLoading, setIsLoading] = useState(false);

  const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  const createPool = async () => {
    if (!walletClient || !address) return;
    setIsLoading(true);
    try {
      const poolContract = getContract({
        address: SILENTPOOL_ADDRESS,
        abi: CONTRACT_ABI,
        client: walletClient,
      });

      // Créer un pool de 100 USDC (denomination)
      const createPoolHash = await poolContract.write.createPool([
        USDC_ADDRESS,
        BigInt(10 * 10 ** 6), // 100 USDC avec 6 decimals
      ]);

      await publicClient!.waitForTransactionReceipt({
        hash: createPoolHash,
      });

      toast.success("✅ Pool created successfully!");
    } catch (err) {
      console.error("Create pool error:", err);
      toast.error("❌ Pool creation failed. See console.");
    } finally {
      setIsLoading(false);
    }
  };

  const [isHoldingButton, setIsHoldingButton] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fonction pour nettoyer les timers
  const cleanupTimers = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setHoldProgress(0);
    setIsHoldingButton(false);
  };

  // Handler pour le début du hold
  const handleHoldStart = () => {
    setIsHoldingButton(true);
    setHoldProgress(0);

    // Incrémenter la progress bar
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 3000) * 100, 100);
      setHoldProgress(progress);
    }, 10);

    // Timer pour la confirmation après 3 secondes
    holdTimerRef.current = setTimeout(() => {
      setShowNoteModal(false);
      setGeneratedNote("");
      setDepositAmount("");
      cleanupTimers();
      toast.success("✅ Note saved! Don't forget to keep it safe!");
    }, 3000);
  };

  // Handler pour le relâchement
  const handleHoldEnd = () => {
    cleanupTimers();
  };

  const [noteCurrentStatus, setNoteCurrentStatus] = useState<{
    exists: boolean;
    nullifierUsed: boolean;
    canWithdraw: boolean;
  } | null>(null);

  const checkNote = async () => {
    if (!noteString.trim()) {
      setNoteCurrentStatus(null);
      return;
    }

    const status = await checkNoteStatus(noteString);
    setNoteCurrentStatus(status);
  };

  useEffect(() => {
    checkNote();
  }, [noteString]);

  // ✅ Handler pour changer de token
  const handleTokenChange = (symbol: string) => {
    const token = tokens.find((t) => t.symbol === symbol);
    if (token) {
      setSelectedToken(token);
    }
  };

  const { refetch } = useRecentDeposits({
    silentPoolAddress: SILENTPOOL_ADDRESS,
    maxResults: 10,
  });

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="mb-12 flex flex-col items-center justify-center">
          <h1 className="text-6xl font-extrabold mb-0 mt-5 text-center text-white uppercase font-syne">
            Silence <br />
          </h1>
          {/* <span className="text-xl font-medium text-white/60 font-syne text-center">
            Zero-Knowledge . Anonymous Withdrawals . Private Deposits
          </span> */}
        </div>

        {/* Actions rapides */}
        {/* <div className="flex gap-4 mb-8 justify-center">
          <button
            onClick={mintSelectedToken}
            disabled={isProcessing || !canInteract}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
          >
            {getMintButtonText()} {selectedToken.symbol}
          </button>

          <button
            onClick={createPool}
            disabled={isProcessing || isLoading}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Pool"}
          </button>
        </div> */}
        {/* <UltraDebugButton
          silentPoolAddress={SILENTPOOL_ADDRESS}
          selectedToken={selectedToken}
          depositAmount={depositAmount}
        /> */}

        <div className="flex mx-auto">
          <div className="w-full">
            <div className="flex justify-center gap-10">
              {/* Main Form */}

              <div className="min-w-[400px]">
                <div className="flex items-center justify-end relative w-full bg-black">
                  <button
                    onClick={() => setActiveTab("withdraw")}
                    className={`font-bold px-3 w-1/2 text-lg z-10 border h-[48px] hover:text-white hover:font-bold border-b-0 border-transparent transition-all duration-200 ease-in-out ${
                      activeTab === "withdraw" ? "text-white" : "text-white/80"
                    }`}
                  >
                    Withdraw
                  </button>
                  <button
                    onClick={() => setActiveTab("deposit")}
                    className={`font-bold px-3 w-1/2 text-lg z-10 border h-[48px] hover:text-white hover:font-bold border-b-0 border-transparent transition-all duration-200 ease-in-out ${
                      activeTab === "deposit" ? "text-white" : "text-white/80"
                    }`}
                  >
                    Deposit
                  </button>
                  <div
                    className={`absolute top-0.5 bg-black font-bold px-3 w-1/2 text-lg border border-b-0 h-[48px] transition-all duration-200 ease-in-out`}
                    style={{
                      right: activeTab === "withdraw" ? "50%" : "0%",
                    }}
                  />
                </div>

                <div className="mx-auto border border-white/80 px-6 py-4 mb-5 w-full h-[288px]">
                  <div className="flex justify-between items-start w-full">
                    {activeTab === "deposit" ? <div></div> : <div></div>}
                  </div>

                  {/* Deposit Tab */}
                  {activeTab === "deposit" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="block text-white mb-2 text-lg font-bold">
                          Token
                        </label>
                        <div className="text-white/60 text-sm mb-2">
                          Balance: {selectedTokenBalance} {selectedToken.symbol}
                        </div>
                      </div>
                      <select
                        value={selectedToken.symbol}
                        onChange={(e) => handleTokenChange(e.target.value)}
                        className="w-full p-3 px-3 h-12 bg-transparent border border-white text-lg font-bold focus:outline-none font-mono mb-4"
                      >
                        {tokens.map((token) => (
                          <option key={token.symbol} value={token.symbol}>
                            {token.symbol}
                          </option>
                        ))}
                      </select>

                      <label className="block text-white mb-2 text-lg font-bold">
                        Amount
                      </label>
                      <div className="flex items-center w-full gap-4 mb-4">
                        {[1, 10, 100, 1000].map((amount) => (
                          <button
                            key={amount}
                            className={`bg-black w-1/4 text-xl px-3.5 h-12 font-bold hover:bg-white hover:text-black border border-white hover:border-black ${
                              depositAmount === amount.toString()
                                ? "bg-white text-black border-black"
                                : ""
                            }`}
                            onClick={() => setDepositAmount(amount.toString())}
                            disabled={depositAmount === amount.toString()}
                          >
                            {amount}
                          </button>
                        ))}
                      </div>

                      {/* Balance info */}

                      <button
                        onClick={handleDeposit}
                        disabled={!canInteract || !depositAmount}
                        className="w-full bg-white font-bold text-lg mb-2 border-2 h-12 border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out disabled:opacity-50"
                      >
                        {isProcessing ? "Processing..." : "Deposit"}
                      </button>
                    </>
                  ) : (
                    /* Withdraw Tab */
                    <div className="">
                      <WithdrawalFlow
                        silentPoolAddress={SILENTPOOL_ADDRESS}
                        checkNoteStatus={checkNoteStatus}
                        requestWithdrawal={requestWithdrawal}
                        fulfillWithdrawal={fulfillWithdrawal}
                        getWithdrawalRequest={getWithdrawalRequest}
                        noteString={noteString}
                        recipientAddress={recipientAddress}
                        isProcessing={isProcessing}
                        decodeNote={decodeNote}
                        validateNote={validateNote}
                        selectedToken={selectedToken}
                        onSuccess={() => {}}
                        notePreview={notePreview}
                        noteCurrentStatus={noteCurrentStatus}
                        setNoteString={setNoteString}
                        setRecipientAddress={setRecipientAddress}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Statistics Panel */}
              <div className="flex flex-col gap-7">
                <div className="border border-white/80 p-6 min-w-[440px] h-[338px]">
                  <div className="flex justify-between items-center mb-5 -mt-2">
                    <h2 className="text-2xl font-bold text-white font-syne">
                      Statistics
                    </h2>
                    <div className="flex items-center gap-2">
                      <button className="bg-white flex items-center gap-2 text-black text-sm font-bold font-syne px-2 py-0.5 hover:bg-black hover:text-white border-2 border-transparent hover:border-white">
                        <span className="-mt-1 text-lg">
                          {depositAmount || "0"}
                        </span>{" "}
                        {selectedToken.symbol}
                      </button>
                    </div>
                  </div>

                  <p className="text-white text-base font-bold font-syne">
                    Anonymity Set Size:
                  </p>
                  <p className="text-white/60 text-base font-bold font-syne">
                    <span className="text-white font-bold">
                      {selectedPoolInfo?.anonymitySetSize || "0"}
                    </span>{" "}
                    equal deposits
                  </p>

                  {/* {selectedPoolInfo && (
                  <>
                    <p className="text-white text-base font-bold font-syne mt-5">
                      Pool Info:
                    </p>
                    <div className="text-white/60 text-sm space-y-1">
                      <div>
                        Denomination:{" "}
                        <span className="text-white font-bold">
                          {selectedPoolInfo.denomination} {selectedToken.symbol}
                        </span>
                      </div>
                      <div>
                        Deposits:{" "}
                        <span className="text-white font-bold">
                          {selectedPoolInfo.depositCount}
                        </span>
                      </div>
                      <div>
                        Status:{" "}
                        <span
                          className={`font-bold ${
                            selectedPoolInfo.isActive
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {selectedPoolInfo.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </>
                )} */}

                  <p className="text-white text-base font-bold font-syne mt-[30px]">
                    Latest Deposits:
                  </p>

                  <RecentDeposits silentPoolAddress={SILENTPOOL_ADDRESS} />
                </div>
                <PendingWithdrawals
                  fulfillWithdrawal={fulfillWithdrawal}
                  getWithdrawalRequest={getWithdrawalRequest}
                  isWithdrawing={isProcessing}
                  onSuccess={() => {}}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ✅ MODAL POUR AFFICHER LA NOTE */}
        {showNoteModal && generatedNote && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-8">
            <div className="bg-black border border-white p-8 max-w-2xl w-full">
              <h2 className="text-5xl font-bold mb-4 text-red-500 font-syne">
                SAVE THIS NOTE!
              </h2>

              <p className="text-white text-lg mb-9">
                This is the <span className="font-extrabold">ONLY</span> way to
                withdraw your funds. <br />
                If you lose it, your money is{" "}
                <span className="font-extrabold text-white">GONE FOREVER</span>!
              </p>

              {/* Note Text */}
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <button
                    onClick={copyNote}
                    className="bg-black text-white h-10 w-10 flex items-center justify-center font-bold hover:bg-white hover:text-black border border-white hover:border-black"
                  >
                    <VscCopy size={20} />
                  </button>

                  <button
                    onClick={downloadNote}
                    className="bg-black text-white h-10 w-10 flex items-center justify-center font-bold hover:bg-white hover:text-black border border-white hover:border-black"
                  >
                    <LuDownload size={20} />
                  </button>
                </div>

                <div className="bg-black p-4 mb-4 font-mono text-xs break-all text-white border border-white max-w-md">
                  {generatedNote}
                </div>
              </div>

              {/* Buttons */}
              <button
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onMouseLeave={handleHoldEnd}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldEnd}
                className={`w-full text-xl mt-7 bg-white text-black px-4 py-3 transition-all duration-200 ease-in-out font-bold hover:bg-black hover:text-white border border-transparent hover:border-red-500 relative overflow-hidden select-none flex items-center justify-center gap-3 ${
                  isHoldingButton ? "border-red-500" : "bg-white text-black"
                }`}
              >
                {/* Cercle de progression */}
                {isHoldingButton && (
                  <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeOpacity="0.2"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${holdProgress}, 100`}
                      className="text-red-500"
                    />
                  </svg>
                )}

                <span>
                  {isHoldingButton
                    ? `Confirming... ${Math.ceil(
                        3 - (holdProgress / 100) * 3
                      )}s`
                    : "Hold 3s to confirm I saved my note"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
