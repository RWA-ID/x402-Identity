require("dotenv").config({ path: ".env.local" });
const { ethers, run, network } = require("hardhat");

const REGISTRAR    = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";
const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);

  console.log("Network   :", network.name, "chainId", (await ethers.provider.getNetwork()).chainId);
  console.log("Deployer  :", deployer.address);
  console.log("Balance   :", ethers.formatEther(bal), "ETH");
  console.log("Registrar :", REGISTRAR);
  console.log("NameWrapper:", NAME_WRAPPER);

  if (network.name !== "mainnet") {
    throw new Error(`Refusing to deploy on network "${network.name}" — pass --network mainnet`);
  }
  if (bal < ethers.parseEther("0.02")) {
    throw new Error("Deployer balance below 0.02 ETH; refusing to deploy");
  }

  const Fwd = await ethers.getContractFactory("X402RegistrarForwarder");
  const fwd = await Fwd.deploy(REGISTRAR, NAME_WRAPPER);
  console.log("Tx        :", fwd.deploymentTransaction().hash);
  await fwd.waitForDeployment();
  const addr = await fwd.getAddress();
  console.log("Forwarder :", addr);

  console.log("\nWaiting 30s before Etherscan verify…");
  await new Promise((r) => setTimeout(r, 30_000));

  try {
    await run("verify:verify", {
      address: addr,
      constructorArguments: [REGISTRAR, NAME_WRAPPER],
    });
    console.log("Verified ✓");
  } catch (e) {
    console.error("Verify failed:", e.message);
    console.log("Re-run manually:");
    console.log(`  npx hardhat verify --network mainnet ${addr} ${REGISTRAR} ${NAME_WRAPPER}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
