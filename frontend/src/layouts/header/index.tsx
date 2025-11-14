"use client";

import { WithdrawTrigger } from "~~/src/components/WithdrawTrigger";
import { WalletConnection } from "../../components/ConnectModal";
import { useDrawerStore } from "../../store/useDrawerStore";

export default function Header() {
  const { openDrawer } = useDrawerStore();
  return (
    <header>
      <div className="pr-7 pl-6 pt-6 mx-auto py-4 pb-5 bg-black">
        <div className="flex justify-between items-center">
          <div className="flex items-center text-white">
            {/* <VscMute size={24} /> */}
            <h1 className="text-3xl font-extrabold mb-0 text-center text-white uppercase font-syne">
              Silence <br />
            </h1>
          </div>
          <div className="flex items-center gap-5">
            <div onClick={openDrawer}>
              <WithdrawTrigger />
            </div>{" "}
            <WalletConnection />
          </div>
        </div>
      </div>
    </header>
  );
}
