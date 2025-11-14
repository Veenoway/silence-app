"use client";
import { InMemoryStorageProvider } from "fhevm-sdk";

export const DappWrapperWithProviders = ({
  children,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: any;
}) => {
  return <InMemoryStorageProvider>{children}</InMemoryStorageProvider>;
};
