import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AppKitNetwork, sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { cookieStorage, createStorage, webSocket } from "wagmi";

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID as string;

if (!projectId) throw new Error("Project ID is not defined");

export const networks = [sepolia] as unknown as [
  AppKitNetwork,
  ...AppKitNetwork[]
];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  networks: [sepolia],
  projectId,
  transports: {
    [sepolia.id]: webSocket(process.env.NEXT_PUBLIC_ALCHEMY_WSS as string),
  },
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
