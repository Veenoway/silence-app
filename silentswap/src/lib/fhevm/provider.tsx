"use client";
import { InMemoryStorageProvider } from "fhevm-sdk";
import { useEffect, useState } from "react";

export const DappWrapperWithProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return <InMemoryStorageProvider>{children}</InMemoryStorageProvider>;
};
