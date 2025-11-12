"use client";

import { useAppKit } from "@reown/appkit/react";
import { useEffect, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

export function WalletConnection() {
  const { open } = useAppKit();
  const { address, isConnecting, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (address) {
      setIsInitialLoading(false);
    }
  }, [address]);

  const getDisplayText = () => {
    if (isConnecting || isInitialLoading) return "Loading...";
    return `${address?.slice(0, 6)}...${address?.slice(-4)}`;
  };

  const isWrongNetwork = chainId !== 10143;

  const handleSwitchNetwork = async () => {
    try {
      switchChain({
        chainId: 10143,
      });
    } catch (err) {
      console.error("Failed to switch network:", err);
    }
  };

  const handleWalletAction = async () => {
    if (!address) {
      await open();
    } else {
      await open({ view: "Account" });
    }
  };

  if (address && isWrongNetwork) {
    return (
      <button
        onClick={handleSwitchNetwork}
        className="sm:px-4 sm:py-2 px-3 py-2 rounded-xl font-medium sm:text-base text-sm transition-colors ease-in-out duration-200 bg-[#836EF9] text-white hover:bg-[#836EF9]"
      >
        Switch to Monad Testnet
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleWalletAction}
        className={`sm:px-4 sm:py-2 px-3 py-2 rounded-xl font-medium sm:text-base text-sm transition-colors ease-in-out duration-200 bg-[#836EF9] text-white hover:bg-[#836EF9]
         `}
        // disabled={isConnecting || isInitialLoading}
      >
        {!address ? "Connect Wallet" : getDisplayText()}
      </button>
    </div>
  );
}
