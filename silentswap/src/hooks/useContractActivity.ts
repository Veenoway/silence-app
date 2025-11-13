"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";

type ContractEvent = {
  type: "Deposited" | "NoteCreated" | "NoteRedeemed" | "Withdrawn";
  user: string;
  token: string;
  amount?: string;
  timestamp: number;
  txHash: string;
  blockNumber: bigint;
};

const SILENTPOOL_ABI = [
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "NoteCreated",
    inputs: [
      { indexed: true, name: "noteHash", type: "bytes32" },
      { indexed: true, name: "depositor", type: "address" },
      { indexed: true, name: "token", type: "address" },
    ],
  },
  {
    type: "event",
    name: "NoteRedeemed",
    inputs: [
      { indexed: true, name: "nullifier", type: "bytes32" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: true, name: "token", type: "address" },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
] as const;

export const useContractActivity = (contractAddress: `0x${string}`) => {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecentEvents = useCallback(async () => {
    if (!publicClient) return;

    setIsLoading(true);
    try {
      // ✅ Chercher depuis le début (ou depuis le block de deployment)
      // Tu peux mettre le block de deployment si tu le connais pour être plus rapide
      const deploymentBlock = BigInt(9615028); // ou le block réel de deployment

      const logs = await publicClient.getLogs({
        address: contractAddress,
        events: SILENTPOOL_ABI,
        fromBlock: deploymentBlock,
        toBlock: "latest",
      });

      console.log("📜 Fetched ALL logs:", logs.length);

      if (logs.length === 0) {
        console.log("⚠️ No events found for this contract");
        setEvents([]);
        setIsLoading(false);
        return;
      }

      // Parser tous les events
      const parsedEvents: ContractEvent[] = await Promise.all(
        logs.map(async (log) => {
          // Récupérer le block pour avoir le timestamp
          const block = await publicClient.getBlock({
            blockNumber: log.blockNumber!,
          });

          if (log.eventName === "Deposited") {
            return {
              type: "Deposited" as const,
              user: log.args.user as string,
              token: log.args.token as string,
              timestamp: Number(log.args.timestamp),
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber!,
            };
          }

          if (log.eventName === "NoteCreated") {
            return {
              type: "NoteCreated" as const,
              user: log.args.depositor as string,
              token: log.args.token as string,
              timestamp: Number(block.timestamp),
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber!,
            };
          }

          if (log.eventName === "NoteRedeemed") {
            return {
              type: "NoteRedeemed" as const,
              user: log.args.recipient as string,
              token: log.args.token as string,
              timestamp: Number(block.timestamp),
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber!,
            };
          }

          if (log.eventName === "Withdrawn") {
            return {
              type: "Withdrawn" as const,
              user: log.args.recipient as string,
              token: log.args.token as string,
              timestamp: Number(log.args.timestamp),
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber!,
            };
          }

          return null;
        })
      );

      // ✅ Trier par blockNumber décroissant et prendre les 5 derniers
      const validEvents = parsedEvents
        .filter((e): e is ContractEvent => e !== null)
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
        .slice(0, 5); // ✅ Toujours 5 events max

      console.log("✅ Showing last 5 events:", validEvents);
      setEvents(validEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, contractAddress]);

  useEffect(() => {
    fetchRecentEvents();
  }, [fetchRecentEvents]);

  // ✅ 2. Écouter les nouveaux events en temps réel (Deposited)
  useWatchContractEvent({
    address: contractAddress,
    abi: SILENTPOOL_ABI,
    eventName: "Deposited",
    onLogs: (logs) => {
      console.log("🔔 New Deposited event:", logs);

      logs.forEach((log) => {
        const newEvent: ContractEvent = {
          type: "Deposited",
          user: log.args.user as string,
          token: log.args.token as string,
          timestamp: Number(log.args.timestamp),
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
        };

        setEvents((prev) => [newEvent, ...prev].slice(0, 4));
      });
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: SILENTPOOL_ABI,
    eventName: "NoteCreated",
    onLogs: async (logs) => {
      console.log("🔔 New NoteCreated event:", logs);

      for (const log of logs) {
        const block = await publicClient!.getBlock({
          blockNumber: log.blockNumber!,
        });

        const newEvent: ContractEvent = {
          type: "NoteCreated",
          user: log.args.depositor as string,
          token: log.args.token as string,
          timestamp: Number(block.timestamp),
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
        };

        setEvents((prev) => [newEvent, ...prev].slice(0, 4));
      }
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: SILENTPOOL_ABI,
    eventName: "NoteRedeemed",
    onLogs: async (logs) => {
      console.log("🔔 New NoteRedeemed event:", logs);

      for (const log of logs) {
        const block = await publicClient!.getBlock({
          blockNumber: log.blockNumber!,
        });

        const newEvent: ContractEvent = {
          type: "NoteRedeemed",
          user: log.args.recipient as string,
          token: log.args.token as string,
          timestamp: Number(block.timestamp),
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
        };

        setEvents((prev) => [newEvent, ...prev].slice(0, 4));
      }
    },
  });

  return {
    events,
    isLoading,
    refresh: fetchRecentEvents,
  };
};
