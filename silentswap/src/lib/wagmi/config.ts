import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { cookieStorage, createStorage, webSocket } from "wagmi";

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
  transports: {
    [sepolia.id]: webSocket(
      process.env.NEXT_PUBLIC_ALCHEMY_WSS ||
        "wss://sepolia.infura.io/ws/v3/ac915beb7bc346c9a1b4c49348fc3ab3"
    ),
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
