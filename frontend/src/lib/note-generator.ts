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
  amount: string;
  chainId: number;
};

export const generateNote = (
  token: string,
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

  return { nullifier, secret, commitment, token, amount, chainId };
};

export const encodeNote = (note: Note): string => {
  return `silence-${Buffer.from(JSON.stringify(note)).toString("base64")}`;
};

export const decodeNote = (noteString: string): Note => {
  if (!noteString.startsWith("silence-")) throw new Error("Invalid note");
  const base64 = noteString.replace("silence-", "");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
};
