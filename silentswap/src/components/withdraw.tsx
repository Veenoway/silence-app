"use client";

import { toast } from "sonner";
import { useAccount } from "wagmi";
import { Note } from "../hooks/useSilence";
import { useWithdrawalManager } from "../hooks/useWithdrawalManager";

type WithdrawalFormProps = {
  silentPoolAddress: `0x${string}`;

  // Hook functions from useSilenceWithdraw
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

  // Form state (controlled from parent)
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

export function WithdrawalFlow({
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

  // Handle new withdrawal
  const handleWithdraw = async () => {
    if (!isConnected || !address) {
      toast.error("❌ Please connect your wallet");
      return;
    }

    if (!noteString.trim()) {
      toast.error("❌ Please enter your note");
      return;
    }

    // Check if already pending
    if (isNotePending(noteString)) {
      toast.error("⚠️ This note already has a pending withdrawal");
      return;
    }

    const recipient = recipientAddress || address!;

    if (!recipient) {
      toast.error("❌ Please specify a recipient address");
      return;
    }

    // Validate note first
    const status = await checkNoteStatus(noteString);
    if (!status) {
      toast.error("❌ Failed to validate note");
      return;
    }

    if (!status.exists) {
      toast.error("❌ Invalid note - no matching deposit found");
      return;
    }

    if (status.nullifierUsed) {
      toast.error("❌ This note has already been spent");
      return;
    }

    // Request withdrawal
    const requestId = await requestWithdrawal(noteString, recipient);

    if (requestId !== null) {
      // Parse note to get details
      const noteData = JSON.parse(
        Buffer.from(noteString.replace("silentpool-", ""), "base64").toString(
          "utf-8"
        )
      );

      // Save to pending
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

      // Clear form
      setNoteString("");
      setRecipientAddress("");

      toast.success("✅ Withdrawal scheduled! Come back in ~6.5 minutes", {
        duration: 8000,
      });

      if (onSuccess) onSuccess();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto ">
      {/* Note Input */}
      <div className="mb-4">
        <label
          className={`block text-white mb-2 text-lg font-bold ${
            notePreview && !noteCurrentStatus?.nullifierUsed
              ? "text-green-400"
              : noteString
              ? "text-red-400"
              : ""
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
          className={`w-full p-3 h-12 px-3.5 bg-transparent text-xl border border-white focus:outline-none font-mono ${
            notePreview && !noteCurrentStatus?.nullifierUsed
              ? "border-green-500"
              : noteString && !noteCurrentStatus?.nullifierUsed
              ? "border-green-500"
              : noteString
              ? "border-red-500"
              : ""
          }`}
          disabled={isWithdrawing}
        />
      </div>

      {/* Note Preview */}
      {notePreview && (
        <div className="pt-4 -mt-2">
          <div className="text-base text-white/80 space-y-1 font-medium">
            <div>
              Amount:{" "}
              <span className="font-bold text-white">{notePreview.amount}</span>
            </div>
            <div>
              Pool ID:{" "}
              <span className="font-bold text-white">{notePreview.poolId}</span>
            </div>
            <div>
              Chain ID:{" "}
              <span className="font-bold text-white">
                {notePreview.chainId}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recipient Input */}
      <div className="mb-4">
        <label className="block text-white mb-2 text-lg font-bold">
          Recipient address
        </label>
        <input
          type="text"
          placeholder={`0x... (leave empty for ${address?.slice(0, 6)}...)`}
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          className="w-full p-3 px-3.5 bg-transparent border border-white text-xl focus:outline-none h-12"
          disabled={isWithdrawing}
        />
      </div>

      {/* Submit Button */}
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
