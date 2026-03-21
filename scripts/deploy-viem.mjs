import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dir = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(
  readFileSync(join(__dir, "../artifacts/contracts/X402SubnameRegistrar.sol/X402SubnameRegistrar.json"), "utf8")
);

// Ethereum Mainnet addresses
const NAME_WRAPPER    = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";
const ENS_REGISTRY    = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const ALCHEMY_MAINNET = process.env.NEXT_PUBLIC_ALCHEMY_MAINNET;
const PRIVATE_KEY     = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env.local");

const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: mainnet, transport: http(ALCHEMY_MAINNET) });
const publicClient = createPublicClient({ chain: mainnet, transport: http(ALCHEMY_MAINNET) });

async function main() {
  console.log("Deploying with:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", Number(balance) / 1e18, "ETH");

  console.log("\nDeploying X402SubnameRegistrar to mainnet...");
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [NAME_WRAPPER, ENS_REGISTRY, PUBLIC_RESOLVER],
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const addr = receipt.contractAddress;
  console.log("\n✅ X402SubnameRegistrar deployed to:", addr);
  console.log("\nNext steps:");
  console.log("1. Update NEXT_PUBLIC_REGISTRAR_ADDRESS in .env.local:", addr);
  console.log("2. Update ADDRESSES.mainnet.registrar in src/lib/contracts.ts:", addr);
  console.log("3. Run setup-viem.mjs to approve the registrar + add parent nodes");
}

main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
