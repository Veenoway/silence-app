import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import Header from "../layouts/header";
import { DappWrapperWithProviders } from "../lib/fhevm/provider";
import ContextProvider from "../lib/wagmi/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Silence | Private Transactions on EVM",
  description:
    "Deposit, and withdraw crypto anonymously. Privacy-preserving DeFi protocol built with fully homomorphic encryption for secure, untraceable transactions.",
  keywords: [
    "privacy pool",
    "anonymous transactions",
    "DeFi privacy",
    "zero knowledge",
    "FHE",
    "encrypted blockchain",
    "private DeFi",
    "anonymous crypto",
    "Zama FHE",
  ],
  authors: [{ name: "Silence Protocol" }],
  creator: "Silence Protocol",
  publisher: "Silence Protocol",

  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://silence-app-six.vercel.app/",
    siteName: "Silence Protocol",
    title: "Silence - Privacy-Preserving DeFi Protocol",
    description:
      "Break on-chain surveillance. Deposit, mix, and withdraw crypto with complete anonymity using advanced encryption technology.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Silence - Privacy Protocol",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Silence - Private Transactions on EVM",
    description:
      "Deposit, mix, and withdraw crypto anonymously with advanced encryption.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "https://silence-app-six.vercel.app/",
  },
  category: "DeFi",
  metadataBase: new URL("https://silence-app-six.vercel.app/"),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookies = (await headers()).get("cookie");
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ContextProvider cookies={cookies}>
          <Toaster
            position="top-center"
            richColors
            theme="dark"
            toastOptions={{
              unstyled: false,
              className: "",
              style: {
                background: "#000",
                color: "#fff",
                border: "1px solid #ffffff90",
                fontSize: "12px",
                fontFamily: "Syne, sans-serif",
                fontWeight: "bold",
                borderRadius: "0px",
                maxWidth: "300px",
                padding: "10px 15px",
              },
              classNames: {
                toast:
                  "group toast group-[.toaster]:bg-black group-[.toaster]:text-white group-[.toaster]:border-white group-[.toaster]:shadow-lg",
                title:
                  "group-[.toast]:text-white group-[.toast]:font-bold group-[.toast]:text-base",
                description:
                  "group-[.toast]:text-white/80 group-[.toast]:text-sm",
                actionButton:
                  "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:font-bold",
                cancelButton:
                  "group-[.toast]:bg-white/10 group-[.toast]:text-white",
                closeButton:
                  "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:border-white",
                error: "group-[.toast]:border-red-500 group-[.toast]:bg-black",
                success:
                  "group-[.toast]:border-green-500 group-[.toast]:bg-black",
                warning:
                  "group-[.toast]:border-yellow-500 group-[.toast]:bg-black",
                info: "group-[.toast]:border-blue-500 group-[.toast]:bg-black",
              },
            }}
          />
          <DappWrapperWithProviders>
            <Header />
            {children}
          </DappWrapperWithProviders>
        </ContextProvider>
      </body>
    </html>
  );
}
