"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuRefreshCcw } from "react-icons/lu";
import { toast } from "sonner";
import { useSilence } from "../../hooks/useSilence";
import { NoteDialog } from "./components/dialog/noteDialog";
import { RecentDeposits } from "./components/recent-deposit";
import { Withdraw } from "./components/withdraw";
import { WithdrawDrawer } from "./components/withdraw/drawer";

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

export default function Silence() {
  const [noteString, setNoteString] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isHoldingButton, setIsHoldingButton] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const {
    selectedToken,
    selectedTokenBalance,
    selectedPoolInfo,
    selectedPool,

    depositToSelectedPool,
    requestWithdrawal,
    checkNoteStatus,
    fulfillWithdrawal,
    getWithdrawalRequest,

    generatedNote,
    setGeneratedNote,
    isProcessing,
    canInteract,

    decodeNote,
    validateNote,
    selectedAmount,
    loadBalances,
    setSelectedAmount,
  } = useSilence({
    silentPoolAddress: SILENTPOOL_ADDRESS,
    tokens: TOKENS,
  });

  const handleDeposit = async () => {
    if (!selectedAmount) {
      toast.error("Please enter an amount");
      return;
    }

    const noteStr = await depositToSelectedPool(selectedAmount);
    if (noteStr) {
      setShowNoteModal(true);
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

  const notePreview = (() => {
    if (!noteString.trim()) return null;
    try {
      const note = decodeNote(noteString);
      if (!validateNote(note)) return null;
      return note;
    } catch {
      return null;
    }
  })();

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

  const handleHoldStart = () => {
    setIsHoldingButton(true);
    setHoldProgress(0);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 3000) * 100, 100);
      setHoldProgress(progress);
    }, 10);

    holdTimerRef.current = setTimeout(() => {
      setShowNoteModal(false);
      setGeneratedNote("");
      cleanupTimers();
    }, 3000);
  };

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

  return (
    <div className=" bg-black p-8">
      <div className="max-w-6xl mx-auto relative pt-20">
        <div className="flex mx-auto">
          <div className="w-full">
            <div className="flex justify-center gap-7">
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

                  <motion.div
                    className="absolute top-0.5 bg-black font-bold px-3 w-1/2 text-lg border border-b-0 h-[48px]"
                    animate={{
                      right: activeTab === "withdraw" ? "50%" : "0%",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                </div>

                <div className="mx-auto border border-white/80 px-6 py-4 mb-5 w-full min-h-[288px] overflow-hidden">
                  <AnimatePresence mode="wait">
                    {activeTab === "deposit" ? (
                      <motion.div
                        key="deposit"
                        initial={{ x: 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <div className="flex items-center justify-between">
                          <label className="block text-white mb-2 text-lg font-bold">
                            Token
                          </label>
                          <div className="text-white/80 leading-none text-sm mb-2 flex items-center">
                            <button
                              className="ml-2"
                              onClick={() => {
                                loadBalances(true);
                                toast.success("Balances updated!");
                              }}
                            >
                              <LuRefreshCcw size={12} />
                            </button>
                            <span className="-mt-1 ml-2 mr-1 text-white font-bold">
                              {selectedTokenBalance}
                            </span>
                            {selectedToken.symbol}
                          </div>
                        </div>
                        <div className="w-full flex items-center cursor-not-allowed justify-between p-3 px-3 h-12 bg-transparent border border-white text-lg font-bold focus:outline-none font-mono mb-4">
                          <p>{selectedToken.symbol}</p>
                          <LuChevronDown size={20} />
                        </div>
                        <label className="block text-white mb-2 text-lg font-bold">
                          Amount
                        </label>
                        <div className="flex items-center w-full gap-4 mb-4 relative">
                          {[1, 10, 100, 1000].map((amount, index) => (
                            <motion.button
                              key={amount}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`bg-black w-1/4 text-lg z-10 px-3.5 h-12 font-bold hover:bg-white hover:text-black border border-white hover:border-black ${
                                selectedAmount === amount?.toString()
                                  ? "bg-white text-black border-black"
                                  : ""
                              }`}
                              onClick={() =>
                                setSelectedAmount(amount?.toString())
                              }
                              disabled={selectedAmount === amount?.toString()}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {amount}
                            </motion.button>
                          ))}
                          <div className="w-full h-[1px] bg-white absolute left-0 top-1/2 -translate-y-1/2" />
                        </div>

                        <button
                          onClick={handleDeposit}
                          disabled={!canInteract || !selectedAmount}
                          className="w-full bg-white font-bold text-lg mb-2 border-2 h-12 border-transparent text-black hover:border-white hover:text-white hover:bg-black transition-all duration-200 ease-in-out disabled:opacity-50"
                        >
                          {isProcessing ? "Processing..." : "Deposit"}
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="withdraw"
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <Withdraw
                          silentPoolAddress={SILENTPOOL_ADDRESS}
                          checkNoteStatus={checkNoteStatus}
                          requestWithdrawal={requestWithdrawal}
                          noteString={noteString}
                          recipientAddress={recipientAddress}
                          onSuccess={() => {}}
                          notePreview={notePreview}
                          noteCurrentStatus={noteCurrentStatus}
                          setNoteString={setNoteString}
                          setRecipientAddress={setRecipientAddress}
                          isWithdrawing={isProcessing}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex flex-col gap-7">
                <div className="border border-white/80 p-6 min-w-[440px] h-[338px]">
                  <div className="flex justify-between items-center mb-4 -mt-2">
                    <h2 className="text-2xl font-bold text-white font-syne">
                      Statistics
                    </h2>
                    <div className="flex items-center gap-2">
                      <button className="bg-white flex items-center gap-2 text-black text-sm font-bold font-syne px-2 py-0.5 hover:bg-black hover:text-white border-2 border-transparent hover:border-white">
                        <span className="-mt-1 text-lg">
                          {selectedAmount || "0"}
                        </span>{" "}
                        {selectedToken.symbol}
                      </button>
                    </div>
                  </div>

                  <p className="text-white text-base font-bold font-syne">
                    Anonymity Set Size:
                  </p>
                  <p className="text-white/60 text-base font-normal font-syne">
                    <span className="text-white font-bold">
                      {selectedPoolInfo?.anonymitySetSize || "0"}
                    </span>{" "}
                    equal deposits
                  </p>

                  <p className="text-white text-base font-bold font-syne mt-[10px]">
                    Latest Deposits:
                  </p>

                  <RecentDeposits
                    silentPoolAddress={SILENTPOOL_ADDRESS}
                    poolId={selectedPool?.poolId}
                    maxResults={10}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <NoteDialog
          showNoteModal={showNoteModal}
          generatedNote={generatedNote}
          copyNote={copyNote}
          downloadNote={downloadNote}
          handleHoldStart={handleHoldStart}
          handleHoldEnd={handleHoldEnd}
          isHoldingButton={isHoldingButton}
          holdProgress={holdProgress}
        />
        <WithdrawDrawer
          fulfillWithdrawal={fulfillWithdrawal}
          //   getWithdrawalRequest={getWithdrawalRequest}
          isWithdrawing={isProcessing}
          //   selectedPool={selectedPool?.poolId}
          onSuccess={() => {}}
        />
      </div>
    </div>
  );
}
// silentpool-eyJudWxsaWZpZXIiOiIweGE5OTk1YzVhNDU3NTI0YjAwM2YyM2EyMTQ2OWQxMmUzYjA1ZjcwODkyZGFjZDE5MWU3M2ZhOTBlOGRjNGFkZDUiLCJzZWNyZXQiOiIweDljNjI5NTg0Y2FhNTgzYTBiZGNkMjljNTllYTc5NTgzYTUzNDkyZTZlNWQ5NGJhOTgyNzA2OTNkYTQyNjEwN2MiLCJjb21taXRtZW50IjoiMHg1MjUxZjBlY2IzZDMwNWE0M2UxMzJiODgzYWFmNGViNzQ0YWFlMDkzYjFjN2YyZThkNmU2Njk3NzY0ZmU5NjUwIiwidG9rZW4iOiIweEUxMkY0MWFkNTg4NTY2NzMyNDdDYmI3ODVFQTVjOGZEN2NjZTQ2NmQiLCJwb29sSWQiOjMsImFtb3VudCI6IjEwMCIsImNoYWluSWQiOjExMTU1MTExfQ==
