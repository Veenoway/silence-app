export const CONTRACT_ADDRESS = "0x39bA257b79B5Bd11A8Ac96B98789dBEe615c513D";
export const CONTRACT_ABI = [
  // ===== POOL MANAGEMENT =====
  {
    type: "function",
    name: "createPool",
    inputs: [
      { name: "token", type: "address" },
      { name: "denomination", type: "uint128" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "togglePool",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pools",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
    ],
    outputs: [
      { name: "denomination", type: "uint128" },
      { name: "isActive", type: "bool" },
      { name: "depositCount", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenPoolCount",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },

  // ===== DEPOSITS =====
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "payable",
  },

  // ===== WITHDRAWALS =====
  {
    type: "function",
    name: "requestWithdrawal",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
      { name: "commitment", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "secret", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [{ type: "uint256", name: "requestId" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fulfillWithdrawal",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawalRequests",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "commitment", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
      { name: "requestTimestamp", type: "uint256" },
      { name: "fulfilled", type: "bool" },
    ],
    stateMutability: "view",
  },

  // ===== VIEW FUNCTIONS =====
  {
    type: "function",
    name: "getPoolInfo",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
    ],
    outputs: [
      { name: "isActive", type: "bool" },
      { name: "denomination", type: "uint128" },
      { name: "depositCount", type: "uint256" },
      { name: "anonymitySetSize", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWithdrawalRequest",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "commitment", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "requestTimestamp", type: "uint256" },
      { name: "fulfilled", type: "bool" },
      { name: "timeUntilWithdrawal", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "commitmentExists",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isNullifierUsed",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMerkleRoot",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyMerkleProof",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
      { name: "commitment", type: "bytes32" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "commitmentMetadata",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [
      { name: "encryptedTimestamp", type: "uint256" }, // euint64 mappé en uint256
      { name: "amount", type: "uint128" },
      { name: "exists", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextRequestId",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },

  // ===== CONSTANTS =====
  {
    type: "function",
    name: "MERKLE_TREE_HEIGHT",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MIN_WITHDRAWAL_DELAY",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },

  // ===== EVENTS =====
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "poolId", type: "uint256", indexed: false },
      { name: "denomination", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "poolId", type: "uint256", indexed: true },
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "leafIndex", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawalRequested",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "WithdrawalFulfilled",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
    ],
  },

  // ===== FALLBACK =====
  {
    type: "receive",
    stateMutability: "payable",
  },
] as const;
