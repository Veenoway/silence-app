import { AnimatePresence, motion } from "framer-motion";
import { LuDownload } from "react-icons/lu";
import { VscCopy } from "react-icons/vsc";

type NoteDialogProps = {
  showNoteModal: boolean;
  generatedNote: string;
  copyNote: () => void;
  downloadNote: () => void;
  handleHoldStart: () => void;
  handleHoldEnd: () => void;
  isHoldingButton: boolean;
  holdProgress: number;
};

export const NoteDialog = ({
  showNoteModal,
  generatedNote,
  copyNote,
  downloadNote,
  handleHoldStart,
  handleHoldEnd,
  isHoldingButton,
  holdProgress,
}: NoteDialogProps) => {
  return (
    <AnimatePresence>
      {showNoteModal && generatedNote && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110] p-8"
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.5,
              rotate: -5,
              x: -20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: 0,
              x: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.5,
              rotate: -5,
              x: -20,
            }}
            transition={{
              duration: 0.4,
              ease: [0.43, 0.13, 0.23, 0.96],
            }}
            className="bg-black border border-white/80 p-8 max-w-xl w-full"
          >
            <h2 className="text-4xl font-bold mb-3 text-center text-white font-syne">
              SAVE THIS NOTE!
            </h2>

            <p className="text-white/80 text-lg text-center mb-5">
              This is the <span className="font-bold text-white">ONLY</span> way
              to withdraw your funds. <br />
              If you lose it, your money is{" "}
              <span className="font-bold text-white">GONE FOREVER</span>!
            </p>

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

              <div className="bg-black p-4 mb-4 font-mono text-xs break-all w-full text-white border border-white">
                {generatedNote}
              </div>
            </div>

            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              className={`w-full text-xl mt-2 bg-white text-black px-4 py-3 transition-all duration-200 ease-in-out font-bold hover:bg-black hover:text-white border border-transparent hover:border-white relative overflow-hidden select-none flex items-center justify-center gap-3 ${
                isHoldingButton ? "border-white" : "bg-white text-black"
              }`}
            >
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
                    className="text-white"
                  />
                </svg>
              )}

              <span>
                {isHoldingButton
                  ? `Confirming... ${Math.ceil(3 - (holdProgress / 100) * 3)}s`
                  : "Hold 3s to confirm I saved my note"}
              </span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
