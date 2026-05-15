const { expect } = require("chai");
const { ethers } = require("hardhat");

const PARENT_LABEL = "402bot";
const PARENT_NODE  = ethers.namehash("402bot.eth");
const RESOLVER     = "0x0000000000000000000000000000000000000123";

describe("X402RegistrarForwarder", function () {
  let owner, parentOwner, user, treasury;
  let nameWrapper, ensRegistry, registrar, forwarder;
  let mintFee;

  beforeEach(async () => {
    [owner, parentOwner, user, treasury] = await ethers.getSigners();

    const NW = await ethers.getContractFactory("MockNameWrapper");
    nameWrapper = await NW.deploy();

    const ENS = await ethers.getContractFactory("MockENSRegistry");
    ensRegistry = await ENS.deploy();

    const Reg = await ethers.getContractFactory("X402SubnameRegistrar");
    registrar = await Reg.deploy(
      await nameWrapper.getAddress(),
      await ensRegistry.getAddress(),
      RESOLVER
    );
    mintFee = await registrar.mintFee();

    // Make parentOwner the holder of the parent name, and approve the registrar.
    await nameWrapper.mintParent(parentOwner.address, BigInt(PARENT_NODE));
    await nameWrapper.connect(parentOwner).setApprovalForAll(await registrar.getAddress(), true);
    await registrar.connect(owner).addParent(PARENT_NODE, PARENT_LABEL);

    const Fwd = await ethers.getContractFactory("X402RegistrarForwarder");
    forwarder = await Fwd.deploy(await registrar.getAddress(), await nameWrapper.getAddress());
  });

  function subnameTokenId(label) {
    const sub = ethers.keccak256(
      ethers.concat([PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes(label))])
    );
    return BigInt(sub);
  }

  it("registers, transfers subname to user, pays treasury", async () => {
    const label = "alice";
    const platformFee = ethers.parseEther("0.003");
    const total = mintFee + platformFee;

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    await expect(
      forwarder.connect(user).registerVia(PARENT_NODE, label, treasury.address, platformFee, { value: total })
    ).to.emit(forwarder, "RegisteredVia");

    const id = subnameTokenId(label);
    expect(await nameWrapper.ownerOf(id)).to.equal(user.address);

    const treasuryAfter = await ethers.provider.getBalance(treasury.address);
    expect(treasuryAfter - treasuryBefore).to.equal(platformFee);
  });

  it("reverts when platformFee exceeds cap", async () => {
    const cap = await forwarder.maxPlatformFee();
    const platformFee = cap + 1n;
    await expect(
      forwarder.connect(user).registerVia(PARENT_NODE, "bob", treasury.address, platformFee, { value: mintFee + platformFee })
    ).to.be.revertedWith("platformFee > cap");
  });

  it("reverts when value is insufficient", async () => {
    const platformFee = ethers.parseEther("0.001");
    await expect(
      forwarder.connect(user).registerVia(PARENT_NODE, "carol", treasury.address, platformFee, { value: mintFee })
    ).to.be.revertedWith("insufficient value");
  });

  it("reverts when treasury is zero", async () => {
    await expect(
      forwarder.connect(user).registerVia(PARENT_NODE, "dave", ethers.ZeroAddress, 0, { value: mintFee })
    ).to.be.revertedWith("treasury=0");
  });

  it("refunds dust to the user", async () => {
    const label = "erin";
    const platformFee = ethers.parseEther("0.001");
    const dust = ethers.parseEther("0.0007");
    const total = mintFee + platformFee + dust;

    const balBefore = await ethers.provider.getBalance(user.address);
    const tx = await forwarder
      .connect(user)
      .registerVia(PARENT_NODE, label, treasury.address, platformFee, { value: total });
    const rc = await tx.wait();
    const gas = rc.gasUsed * rc.gasPrice;
    const balAfter = await ethers.provider.getBalance(user.address);

    // Net spend should equal mintFee + platformFee + gas (dust refunded).
    expect(balBefore - balAfter).to.equal(mintFee + platformFee + gas);
  });

  it("owner can update the platform-fee cap", async () => {
    await forwarder.connect(owner).setMaxPlatformFee(ethers.parseEther("1"));
    expect(await forwarder.maxPlatformFee()).to.equal(ethers.parseEther("1"));
  });
});
