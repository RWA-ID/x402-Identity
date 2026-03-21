import { ethers } from "hardhat";
import { namehash } from "ethers";

// Run AFTER deploy.ts. Requires deployer to own & have wrapped parents.
async function main() {
  const REGISTRAR_ADDRESS = process.env.REGISTRAR_ADDRESS;
  if (!REGISTRAR_ADDRESS) throw new Error("Set REGISTRAR_ADDRESS env var");

  const [owner] = await ethers.getSigners();
  console.log("Setting up with:", owner.address);

  const registrar = await ethers.getContractAt("X402SubnameRegistrar", REGISTRAR_ADDRESS);

  const parents = [
    { node: namehash("402bot.eth"), label: "402bot.eth" },
    { node: namehash("402api.eth"), label: "402api.eth" },
    { node: namehash("402mcp.eth"), label: "402mcp.eth" },
  ];

  // Step 1: Approve registrar as operator on NameWrapper
  const nameWrapper = await ethers.getContractAt(
    ["function setApprovalForAll(address operator, bool approved) external"],
    "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401"
  );
  const approveTx = await nameWrapper.connect(owner).setApprovalForAll(REGISTRAR_ADDRESS, true);
  await approveTx.wait();
  console.log("✅ Registrar approved as operator");

  // Step 2: Add each parent to the contract
  for (const parent of parents) {
    const tx = await registrar.addParent(parent.node, parent.label);
    await tx.wait();
    console.log(`✅ Added parent: ${parent.label}`);
  }

  console.log("\nSetup complete! The registrar is ready to mint subnames.");
}

main().catch((e) => { console.error(e); process.exit(1); });
