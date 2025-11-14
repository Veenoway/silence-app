"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { LuChevronDown, LuX } from "react-icons/lu";
import { useAccount } from "wagmi";
import type { PendingWithdrawal } from "../../../../hooks/useWithdrawalManager";
import { useWithdrawalManager } from "../../../../hooks/useWithdrawalManager";
import { useDrawerStore } from "../../../../store/useDrawerStore";
import { getTokenSymbol } from "../../../../utils/withdraw";

const WITHDRAWAL_DELAY = 390;

type PendingWithdrawalsProps = {
  fulfillWithdrawal: (requestId: number) => Promise<boolean>;
  isWithdrawing: boolean;
  onSuccess: () => void;
};

export const WithdrawDrawer = ({
  fulfillWithdrawal,
  isWithdrawing,
  onSuccess,
}: PendingWithdrawalsProps) => {
  const { chain } = useAccount();
  const { isDrawerOpen, closeDrawer } = useDrawerStore();
  const {
    pendingWithdrawals,
    removeWithdrawal,
    getReadyWithdrawals,
    getPendingWithdrawals,
  } = useWithdrawalManager(chain?.id);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (withdrawal: PendingWithdrawal) => {
    const success = await fulfillWithdrawal(withdrawal.requestId);
    if (success) {
      removeWithdrawal(withdrawal.id);
      if (onSuccess) onSuccess();
    }
  };

  const getTimeRemaining = (expiresAt: number): string => {
    const now = Date.now();
    const diff = Math.max(0, expiresAt - now);
    const seconds = Math.floor(diff / 1000);
    if (seconds === 0) return "Ready!";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const readyWithdrawals = getReadyWithdrawals();
  const pendingWithdrawalsFiltered = getPendingWithdrawals();

  return (
    <>
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-black/50 h-screen w-screen fixed top-0 left-0 z-40"
            onClick={closeDrawer}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{
              x: "100%",
              opacity: 0,
              skewX: -5,
            }}
            animate={{
              x: 0,
              opacity: 1,
              skewX: 0,
              transition: {
                type: "spring",
                damping: 25,
                stiffness: 300,
              },
            }}
            exit={{
              x: "100%",
              opacity: 0,
              skewX: 5,
              transition: {
                duration: 0.3,
                ease: [0.43, 0.13, 0.23, 0.96],
              },
            }}
            className="fixed top-0 right-0 shadow-xl shadow-black bg-black w-full space-y-6 border-l border-white/10 p-6 max-w-[400px] h-screen z-50"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: 1,
                x: 0,
                transition: { delay: 0.1 },
              }}
              className="flex items-center justify-between mb-4"
            >
              <motion.h2
                animate={{
                  x: [0, -2, 2, -1, 0],
                }}
                transition={{
                  duration: 0.4,
                  times: [0, 0.2, 0.4, 0.6, 1],
                  delay: 0.2,
                }}
                className="text-2xl font-bold text-white font-syne"
              >
                Your Withdrawals
              </motion.h2>
              <button
                onClick={closeDrawer}
                className="px-1 py-1 flex items-center gap-2 bg-black text-white hover:bg-white hover:text-black transition-colors border border-white hover:border-white/70 text-base font-medium"
              >
                <LuX size={20} />
              </button>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.05,
                  },
                },
              }}
            >
              {readyWithdrawals.length > 0 && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: 20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="space-y-3"
                >
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    Ready to Claim ({readyWithdrawals.length})
                  </h3>
                  {readyWithdrawals.map((withdrawal, index) => (
                    <motion.div
                      key={withdrawal.id}
                      variants={{
                        hidden: { opacity: 0, x: 20 },
                        visible: {
                          opacity: 1,
                          x: 0,
                          transition: { delay: index * 0.05 },
                        },
                      }}
                    >
                      <WithdrawalCard
                        withdrawal={withdrawal}
                        status="ready"
                        onClaim={() => handleClaim(withdrawal)}
                        isProcessing={isWithdrawing}
                        isExpanded={expandedId === withdrawal.id}
                        onToggle={() =>
                          setExpandedId(
                            expandedId === withdrawal.id ? null : withdrawal.id
                          )
                        }
                        timeRemaining={getTimeRemaining(withdrawal.expiresAt)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {pendingWithdrawalsFiltered.length > 0 && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: 20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="space-y-3"
                >
                  <h3 className="text-lg font-medium text-white flex items-center gap-2 mt-5">
                    Waiting ({pendingWithdrawalsFiltered.length})
                  </h3>
                  {pendingWithdrawalsFiltered.map((withdrawal, index) => (
                    <motion.div
                      key={withdrawal.id}
                      variants={{
                        hidden: { opacity: 0, x: 20 },
                        visible: {
                          opacity: 1,
                          x: 0,
                          transition: { delay: index * 0.05 },
                        },
                      }}
                    >
                      <WithdrawalCard
                        withdrawal={withdrawal}
                        status="pending"
                        isProcessing={false}
                        isExpanded={expandedId === withdrawal.id}
                        onToggle={() =>
                          setExpandedId(
                            expandedId === withdrawal.id ? null : withdrawal.id
                          )
                        }
                        timeRemaining={getTimeRemaining(withdrawal.expiresAt)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {pendingWithdrawals.length === 0 && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, scale: 0.8 },
                    visible: { opacity: 1, scale: 1 },
                  }}
                  className="text-center py-16"
                >
                  <h3 className="text-lg font-bold text-white mb-2">
                    No Pending Withdrawals
                  </h3>
                  <p className="text-white/60 text-sm mb-6">
                    Withdrawals you start will appear here
                  </p>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

type WithdrawalCardProps = {
  withdrawal: PendingWithdrawal;
  status: "ready" | "pending";
  onClaim?: () => void;
  isProcessing: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  timeRemaining: string;
};

function WithdrawalCard({
  withdrawal,
  status,
  onClaim,
  isProcessing,
  isExpanded,
  onToggle,
  timeRemaining,
}: WithdrawalCardProps) {
  const progress =
    ((WITHDRAWAL_DELAY * 1000 - (withdrawal.expiresAt - Date.now())) /
      (WITHDRAWAL_DELAY * 1000)) *
    100;

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.3, ease: "easeOut" } }}
      className={`border overflow-hidden transition-all ${
        status === "ready" ? "border-white/80" : "border-white/60"
      }`}
    >
      <motion.div
        onClick={onToggle}
        className="p-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-bold text-sm text-white">
                {withdrawal.amount} {getTokenSymbol(withdrawal.tokenSymbol)}
              </div>
              <div className="text-sm text-white/60">
                Request #{withdrawal.requestId} • Pool {withdrawal.poolId}
              </div>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <div
              className={`font-mono text-lg font-bold ${
                status === "ready" ? "text-green-400" : "text-white"
              }`}
            >
              {timeRemaining === "Ready!" ? "" : timeRemaining}
            </div>
            {timeRemaining === "Ready!" ? (
              <motion.div
                animate={{
                  rotate: isExpanded ? 180 : 0,
                  scale: isExpanded ? [1, 1.2, 1] : 1,
                }}
                transition={{
                  rotate: { duration: 0.3, ease: "easeOut" },
                  scale: { duration: 0.2 },
                }}
                className="text-xl text-white"
              >
                <LuChevronDown />
              </motion.div>
            ) : null}
          </div>
        </div>

        {status === "pending" && (
          <div className="mt-2 mb-1 w-full bg-white/10 h-1 overflow-hidden">
            <motion.div
              className="bg-white h-1"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            key="expanded-content"
            initial={{
              height: 0,
              opacity: 0,
              scaleY: 0,
            }}
            animate={{
              height: "auto",
              opacity: 1,
              scaleY: 1,
              transition: {
                height: {
                  duration: 0.3,
                  ease: [0.43, 0.13, 0.23, 0.96],
                },
                opacity: {
                  duration: 0.2,
                  delay: 0.1,
                },
                scaleY: {
                  duration: 0.3,
                  ease: [0.43, 0.13, 0.23, 0.96],
                },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              scaleY: 0,
              transition: {
                height: {
                  duration: 0.2,
                  ease: "easeIn",
                },
                opacity: {
                  duration: 0.15,
                },
                scaleY: {
                  duration: 0.2,
                  ease: "easeIn",
                },
              },
            }}
            style={{ originY: 0 }}
            className="border-t border-white/20 overflow-hidden"
          >
            <motion.div className="p-4 space-y-3 bg-black/20">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 0.1,
                    },
                  },
                }}
                className="space-y-2 text-sm"
              >
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="flex justify-between"
                >
                  <span className="text-white/60">Recipient:</span>
                  <span className="font-mono text-white/90">
                    {withdrawal.recipient.slice(0, 10)}...
                    {withdrawal.recipient.slice(-8)}
                  </span>
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="flex justify-between"
                >
                  <span className="text-white/60">Chain ID:</span>
                  <span className="text-white/90">{withdrawal.chainId}</span>
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="flex justify-between"
                >
                  <span className="text-white/60">Requested:</span>
                  <span className="text-white/90">
                    {new Date(withdrawal.requestTimestamp).toLocaleString()}
                  </span>
                </motion.div>
              </motion.div>

              {status === "ready" && onClaim && (
                <motion.button
                  initial={{ opacity: 0, scale: 1, y: 0 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: 0,
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  onClick={onClaim}
                  disabled={isProcessing}
                  className="w-full bg-white hover:bg-black text-black hover:text-white border border-white hover:border-white font-bold py-2 text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? "Claiming..." : "Claim Now"}
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
