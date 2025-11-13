"use client";

import { useAppKit } from "@reown/appkit/react";
import { useEffect, useState } from "react";
import { sepolia } from "viem/chains";
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

  const isWrongNetwork = chainId !== (sepolia?.id as number);

  const handleSwitchNetwork = async () => {
    try {
      switchChain({
        chainId: sepolia?.id as number,
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

  const btnClass =
    "font-syne text-black hover:text-white hover:bg-black bg-white px-5 h-[50px] border border-transparent hover:border-white text-lg font-bold transition-all duration-200 ease-in-out";

  if (address && isWrongNetwork) {
    return (
      <button onClick={handleSwitchNetwork} className={btnClass}>
        Switch Network
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleWalletAction}
        className={btnClass}
        // disabled={isConnecting || isInitialLoading}
      >
        {!address ? "Connect Wallet" : getDisplayText()}
      </button>
    </div>
  );
}
