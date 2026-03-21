import { ethers } from "hardhat";

const NAME_WRAPPER    = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";
const ENS_REGISTRY    = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("X402SubnameRegistrar");
  const registrar = await Factory.deploy(NAME_WRAPPER, ENS_REGISTRY, PUBLIC_RESOLVER);
  await registrar.waitForDeployment();
  const addr = await registrar.getAddress();
  console.log("X402SubnameRegistrar deployed to:", addr);
  console.log("\nUpdate NEXT_PUBLIC_REGISTRAR_ADDRESS in .env.local and src/lib/contracts.ts");
  console.log("\nNext: run scripts/setup.ts to approve & add parent nodes");
}

main().catch((e) => { console.error(e); process.exit(1); });
