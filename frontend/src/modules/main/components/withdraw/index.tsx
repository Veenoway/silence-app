"use client";

import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { Note } from "../../../../hooks/useSilence";
import { useWithdrawalManager } from "../../../../hooks/useWithdrawalManager";

type WithdrawalFormProps = {
  silentPoolAddress: `0x${string}`;
  requestWithdrawal: (
    noteString: string,
    recipient: string
  ) => Promise<number | null>;
  checkNoteStatus: (noteString: string) => Promise<{
    exists: boolean;
    nullifierUsed: boolean;
    canWithdraw: boolean;
  } | null>;
  isWithdrawing: boolean;

  noteString: string;
  recipientAddress: string;
  notePreview: Note | null;
  noteCurrentStatus: {
    exists: boolean;
    nullifierUsed: boolean;
    canWithdraw: boolean;
  } | null;
  setNoteString: (noteString: string) => void;
  setRecipientAddress: (recipientAddress: string) => void;

  onSuccess?: () => void;
};

const WITHDRAWAL_DELAY = 390; // 6m30s

export function Withdraw({
  requestWithdrawal,
  checkNoteStatus,
  isWithdrawing,
  noteString,
  recipientAddress,
  notePreview,
  noteCurrentStatus,
  setNoteString,
  setRecipientAddress,
  onSuccess,
}: WithdrawalFormProps) {
  const { address, isConnected, chain } = useAccount();

  const { addWithdrawal, isNotePending } = useWithdrawalManager(chain?.id);

  const handleWithdraw = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!noteString.trim()) {
      toast.error("Please enter your note");
      return;
    }

    if (isNotePending(noteString)) {
      toast.error("This note already has a pending withdrawal");
      return;
    }

    const recipient = recipientAddress || address!;

    if (!recipient) {
      toast.error("Please specify a recipient address");
      return;
    }

    const status = await checkNoteStatus(noteString);
    if (!status) {
      toast.error("Failed to validate note");
      return;
    }

    if (!status.exists) {
      toast.error("Invalid note - no matching deposit found");
      return;
    }

    if (status.nullifierUsed) {
      toast.error("This note has already been spent");
      return;
    }

    const requestId = await requestWithdrawal(noteString, recipient);

    if (requestId !== null) {
      const noteData = JSON.parse(
        Buffer.from(noteString.replace("silentpool-", ""), "base64").toString(
          "utf-8"
        )
      );

      addWithdrawal({
        requestId,
        noteString,
        recipient,
        requestTimestamp: Date.now(),
        chainId: chain!.id,
        tokenSymbol: noteData.token || "ETH",
        amount: noteData.amount || "?",
        poolId: noteData.poolId || 0,
        expiresAt: Date.now() + WITHDRAWAL_DELAY * 1000,
      });

      setNoteString("");
      setRecipientAddress("");

      if (onSuccess) onSuccess();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto ">
      <div className="mb-4">
        <label
          className={`block mb-2 text-lg font-bold ${
            notePreview && !noteCurrentStatus?.nullifierUsed
              ? "text-green-500"
              : noteString
              ? "text-red-500"
              : "text-white"
          }`}
        >
          {noteCurrentStatus?.nullifierUsed
            ? "Note already used"
            : notePreview
            ? "Valid Note Detected"
            : noteString
            ? "Invalid Note"
            : "Note"}
        </label>
        <input
          type="text"
          value={noteString}
          onChange={(e) => setNoteString(e.target.value)}
          placeholder="silentpool-eyJudWxsaWZpZXIiOiIweDEyMy4uLiJ9..."
          className={`w-full p-3 h-12 px-3.5 bg-transparent text-base border  focus:outline-none font-mono ${
            notePreview && !noteCurrentStatus?.nullifierUsed
              ? "border-green-500"
              : noteString
              ? "border-red-500"
              : "border-white"
          }`}
          disabled={isWithdrawing}
        />
      </div>

      <AnimatePresence mode="wait">
        {notePreview && (
          <motion.div
            key="note-preview"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                height: {
                  duration: 0.3,
                  ease: "easeOut",
                },
                opacity: {
                  duration: 0.2,
                  delay: 0.1,
                },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: {
                  duration: 0.3,
                  ease: "easeIn",
                },
                opacity: {
                  duration: 0.2,
                },
              },
            }}
            className="overflow-hidden pt-0 -mt-2 mb-4 ml-0.5"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.08,
                    delayChildren: 0.1,
                  },
                },
              }}
              className="text-sm text-white/80 space-y-0.5 font-medium"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 },
                }}
              >
                Amount:{" "}
                <span className="font-bold text-white">
                  {notePreview.amount} USDC
                </span>
              </motion.div>
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 },
                }}
              >
                Pool ID:{" "}
                <span className="font-bold text-white">
                  {notePreview.poolId}
                </span>
              </motion.div>
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 },
                }}
              >
                Chain ID:{" "}
                <span className="font-bold text-white">
                  {notePreview.chainId}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-4">
        <label className="block text-white mb-2 text-lg font-bold">
          Recipient address
        </label>
        <input
          type="text"
          placeholder={`0x... (leave empty for ${address?.slice(
            0,
            6
          )}...${address?.slice(-4)})`}
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          className="w-full p-3 px-3.5 bg-transparent border border-white text-base focus:outline-none h-12"
          disabled={isWithdrawing}
        />
      </div>

      <button
        onClick={handleWithdraw}
        disabled={isWithdrawing || !noteString.trim() || !isConnected}
        className="w-full bg-white text-black font-bold text-lg h-12 rounded hover:bg-black hover:text-white hover:border-white border border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
      >
        {isWithdrawing ? "Processing..." : "Withdraw"}
      </button>
    </div>
  );
}
