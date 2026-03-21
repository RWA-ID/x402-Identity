require("dotenv").config({ path: ".env.local" });

// Explicitly load the ethers plugin to ensure HRE augmentation
require("@nomicfoundation/hardhat-ethers");

const hre = require("hardhat");

const NAME_WRAPPER    = "0x0635513f179D50A207757E05759CbD106d7dFbE"; // Sepolia
const PUBLIC_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD"; // Sepolia
const ENS_REGISTRY    = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  const Factory = await hre.ethers.getContractFactory("X402SubnameRegistrar");
  const registrar = await Factory.deploy(NAME_WRAPPER, ENS_REGISTRY, PUBLIC_RESOLVER);
  await registrar.waitForDeployment();
  const addr = await registrar.getAddress();
  console.log("\n✅ X402SubnameRegistrar deployed to:", addr);
  console.log("\nNext: run scripts/setup.js to approve + add parent nodes");
}

main().catch((e) => { console.error(e); process.exit(1); });
