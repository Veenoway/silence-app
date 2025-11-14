/**
 * 🔍 DEBUG ULTRA-COMPLET
 *
 * Ce script va vérifier TOUTES les causes possibles du revert
 */

import { formatUnits, getContract, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

const SILENTPOOL_ABI = [
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
    name: "commitmentExists",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "poolId", type: "uint256" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export function UltraDebugButton({
  silentPoolAddress,
  selectedToken,
  depositAmount,
}: {
  silentPoolAddress: `0x${string}`;
  selectedToken: { address: `0x${string}`; symbol: string; decimals: number };
  depositAmount: string;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const ultraDebug = async () => {
    if (!publicClient || !address) {
      alert("Wallet not connected");
      return;
    }

    console.clear();
    console.log("=== 🔍 ULTRA DEBUG START ===\n");

    const errors: string[] = [];

    try {
      // ===== 1. CONTRACT & TOKEN INFO =====
      console.log("1️⃣ Contract & Token Info:");
      console.log("  - SilentPool:", silentPoolAddress);
      console.log("  - Token:", selectedToken.address);
      console.log("  - Token Symbol:", selectedToken.symbol);
      console.log("  - Token Decimals:", selectedToken.decimals);
      console.log("  - Your Address:", address);

      // ===== 2. POOL INFO =====
      console.log("\n2️⃣ Pool Info:");
      const poolContract = getContract({
        address: silentPoolAddress,
        abi: SILENTPOOL_ABI,
        client: publicClient,
      });

      let poolInfo;
      try {
        poolInfo = await poolContract.read.getPoolInfo([
          selectedToken.address,
          0n,
        ]);
      } catch (error) {
        console.error("❌ Pool doesn't exist!");
        errors.push("Pool doesn't exist for this token");
        alert("❌ FATAL: Pool doesn't exist!\n\nCreate a pool first.");
        return;
      }

      const [isActive, denomination, depositCount, anonymitySetSize] = poolInfo;

      console.log("  - Active:", isActive);
      console.log("  - Denomination (raw):", denomination.toString());
      console.log(
        "  - Denomination (formatted):",
        formatUnits(denomination, selectedToken.decimals),
        selectedToken.symbol
      );
      console.log("  - Deposit Count:", depositCount.toString());
      console.log("  - Anonymity Set:", anonymitySetSize.toString());

      if (!isActive) {
        console.error("❌ Pool is NOT active!");
        errors.push("Pool is not active");
      }

      // ===== 3. AMOUNT CHECK =====
      console.log("\n3️⃣ Amount Check:");
      const amountBigInt = parseUnits(depositAmount, selectedToken.decimals);
      console.log("  - Your amount (display):", depositAmount);
      console.log("  - Your amount (raw):", amountBigInt.toString());
      console.log("  - Pool denomination (raw):", denomination.toString());
      console.log("  - Match:", amountBigInt === denomination ? "✅" : "❌");

      if (amountBigInt !== denomination) {
        console.error("❌ Amount doesn't match denomination!");
        console.error(
          `   Expected: ${formatUnits(denomination, selectedToken.decimals)} ${
            selectedToken.symbol
          }`
        );
        console.error(`   Got: ${depositAmount} ${selectedToken.symbol}`);
        errors.push(
          `Amount mismatch: expected ${formatUnits(
            denomination,
            selectedToken.decimals
          )}, got ${depositAmount}`
        );
      }

      // ===== 4. BALANCE CHECK =====
      console.log("\n4️⃣ Balance Check:");
      const tokenContract = getContract({
        address: selectedToken.address,
        abi: ERC20_ABI,
        client: publicClient,
      });

      const balance = await tokenContract.read.balanceOf([address]);
      const balanceFormatted = formatUnits(balance, selectedToken.decimals);

      console.log("  - Your balance (raw):", balance.toString());
      console.log("  - Your balance (formatted):", balanceFormatted);
      console.log("  - Enough:", balance >= amountBigInt ? "✅" : "❌");

      if (balance < amountBigInt) {
        console.error("❌ Insufficient balance!");
        errors.push(
          `Insufficient balance: have ${balanceFormatted}, need ${depositAmount}`
        );
      }

      // ===== 5. ALLOWANCE CHECK =====
      console.log("\n5️⃣ Allowance Check:");
      const allowance = await tokenContract.read.allowance([
        address,
        silentPoolAddress,
      ]);
      const allowanceFormatted = formatUnits(allowance, selectedToken.decimals);

      console.log("  - Allowance (raw):", allowance.toString());
      console.log("  - Allowance (formatted):", allowanceFormatted);
      console.log("  - Enough:", allowance >= amountBigInt ? "✅" : "❌");

      if (allowance < amountBigInt) {
        console.warn("⚠️ Insufficient allowance (will approve on deposit)");
      }

      // ===== 6. SIMULATE DEPOSIT =====
      console.log("\n6️⃣ Simulating Deposit...");

      // Générer un commitment de test
      const testCommitment =
        "0x1234567890123456789012345678901234567890123456789012345678901234" as `0x${string}`;

      try {
        // Try to simulate the call
        await publicClient.simulateContract({
          address: silentPoolAddress,
          abi: SILENTPOOL_ABI,
          functionName: "deposit",
          args: [selectedToken.address, 0n, testCommitment],
          account: address,
        });

        console.log("✅ Simulation passed!");
      } catch (error: any) {
        console.error("❌ Simulation FAILED!");
        console.error("Error:", error);

        // Parse the revert reason
        if (error.message) {
          console.error("Message:", error.message);

          // Check for common reverts
          if (error.message.includes("Pool not active")) {
            errors.push("Contract says: Pool not active");
          } else if (error.message.includes("Commitment already exists")) {
            errors.push("Contract says: Commitment already exists");
          } else if (error.message.includes("Wrong ETH amount")) {
            errors.push("Contract says: Wrong ETH amount");
          } else if (error.message.includes("ERC20: insufficient allowance")) {
            errors.push("Contract says: Insufficient allowance");
          } else if (
            error.message.includes("ERC20: transfer amount exceeds balance")
          ) {
            errors.push("Contract says: Insufficient balance");
          } else {
            errors.push("Unknown contract error: " + error.message);
          }
        }
      }

      // ===== 7. CHECK ACTUAL DEPOSIT CALL =====
      console.log("\n7️⃣ Checking what your code would call:");
      console.log("  Function: deposit(address, uint256, bytes32)");
      console.log("  Args:");
      console.log("    - token:", selectedToken.address);
      console.log("    - poolId:", "0");
      console.log("    - commitment:", "(will be generated)");
      console.log("    - from:", address);

      // ===== SUMMARY =====
      console.log("\n=== 📊 SUMMARY ===");
      if (errors.length === 0) {
        console.log("✅ ALL CHECKS PASSED!");
        console.log("The deposit SHOULD work.");
        console.log(
          "\nIf it still fails, the problem is in your deposit code."
        );
        alert(
          "✅ ALL CHECKS PASSED!\n\nEverything looks good. If deposit still fails, check your deposit function code."
        );
      } else {
        console.log("❌ FOUND", errors.length, "PROBLEM(S):");
        errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err}`);
        });
        alert(
          `❌ FOUND ${errors.length} PROBLEM(S):\n\n` +
            errors.map((err, i) => `${i + 1}. ${err}`).join("\n") +
            "\n\nCheck console for details."
        );
      }
    } catch (error) {
      console.error("❌ Debug script error:", error);
      alert(`Debug failed: ${error}`);
    }
  };

  return (
    <button
      onClick={ultraDebug}
      className="bg-red-500 text-white px-4 py-2 rounded font-bold hover:bg-red-600 mb-4"
    >
      🔥 ULTRA DEBUG
    </button>
  );
}

/**
 * USAGE:
 *
 * import { UltraDebugButton } from "@/components/UltraDebugButton";
 *
 * <UltraDebugButton
 *   silentPoolAddress={SILENTPOOL_ADDRESS}
 *   selectedToken={selectedToken}
 *   depositAmount={depositAmount}
 * />
 */
