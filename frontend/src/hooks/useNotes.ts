"use client";

import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toHex,
} from "viem";

export type Note = {
  nullifier: `0x${string}`;
  secret: `0x${string}`;
  commitment: `0x${string}`;
  token: string;
  poolId: number;
  amount: string;
  chainId: number;
};

export const generateNote = (
  token: string,
  poolId: number,
  amount: string,
  chainId: number
): Note => {
  const nullifier = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const secret = toHex(crypto.getRandomValues(new Uint8Array(32)));

  const commitment = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [
      nullifier,
      secret,
    ])
  );

  return {
    nullifier,
    secret,
    commitment,
    token,
    poolId,
    amount,
    chainId,
  };
};

export const encodeNote = (note: Note): string => {
  const noteString = JSON.stringify(note);
  const base64 = Buffer.from(noteString).toString("base64");
  return `silentpool-${base64}`;
};

export const decodeNote = (noteString: string): Note => {
  if (!noteString.startsWith("silentpool-")) {
    throw new Error("Invalid note format - must start with 'silentpool-'");
  }

  const base64 = noteString.replace("silentpool-", "");
  const jsonString = Buffer.from(base64, "base64").toString("utf-8");
  const note = JSON.parse(jsonString);

  if (
    !note.nullifier ||
    !note.secret ||
    !note.commitment ||
    !note.token ||
    note.poolId === undefined ||
    !note.amount ||
    !note.chainId
  ) {
    throw new Error("Invalid note format - missing fields");
  }

  return note;
};

export const validateNote = (note: Note): boolean => {
  try {
    const computed = keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [
        note.nullifier,
        note.secret,
      ])
    );
    return computed === note.commitment;
  } catch {
    return false;
  }
};

export const useNotes = () => {
  return {
    generateNote,
    encodeNote,
    decodeNote,
    validateNote,
  };
};
