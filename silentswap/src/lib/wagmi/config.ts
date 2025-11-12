import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { cookieStorage, createStorage } from "wagmi";

export const projectId = "71cb70b160a3c0bdf69a9b358d250c4c";

if (!projectId) throw new Error("Project ID is not defined");

export const networks = [sepolia] as const;

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  networks: [sepolia],
  projectId,
});

const metadata = {
  name: "Silence",
  description: "Silence - Privacy Pool",
  url: "https://silence.xyz",
  icons: ["https://silence.xyz/icon.png"],
};

export const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: sepolia,
  metadata,
  features: {
    analytics: true,
    socials: false,
  },
});

export const config = wagmiAdapter.wagmiConfig;
