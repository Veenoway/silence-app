"use client";

import { VscMute } from "react-icons/vsc";
import { WalletConnection } from "../../components/ConnectModal";

export default function Header() {
  return (
    <header>
      <div className="px-7 pt-6 mx-auto py-4 bg-black">
        <div className="flex justify-between items-center">
          <div className="flex items-center text-white">
            <VscMute size={70} />
          </div>
          <WalletConnection />
        </div>
      </div>
    </header>
  );
}
