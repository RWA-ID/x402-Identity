const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const REGISTRAR    = "0xeb9e9ea385fe28b51a3f9a7d93fb893e0a1f9633";
const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const PARENT_NAME  = "402bot.eth";
const PARENT_NODE  = require("ethers").namehash(PARENT_NAME);

describe("X402RegistrarForwarder (mainnet fork)", function () {
  this.timeout(120_000);

  let forwarder, user, treasury, mintFee, nameWrapper;

  before(async function () {
    if (!process.env.NEXT_PUBLIC_ALCHEMY_MAINNET) this.skip();

    [user, treasury] = await ethers.getSigners();

    const Fwd = await ethers.getContractFactory("X402RegistrarForwarder");
    forwarder = await Fwd.deploy(REGISTRAR, NAME_WRAPPER);
    await forwarder.waitForDeployment();

    const reg = await ethers.getContractAt(
      ["function mintFee() view returns (uint256)"],
      REGISTRAR
    );
    mintFee = await reg.mintFee();

    nameWrapper = await ethers.getContractAt(
      ["function ownerOf(uint256) view returns (address)"],
      NAME_WRAPPER
    );
  });

  it("registers a fresh subname through the forwarder", async () => {
    const label = "fwdfork" + Date.now().toString(36);
    const platformFee = ethers.parseEther("0.001");

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);

    const tx = await forwarder
      .connect(user)
      .registerVia(PARENT_NODE, label, treasury.address, platformFee, {
        value: mintFee + platformFee,
      });
    await tx.wait();

    // Subname tokenId = uint256(keccak256(parentNode || keccak256(label)))
    const subnode = ethers.keccak256(
      ethers.concat([PARENT_NODE, ethers.keccak256(ethers.toUtf8Bytes(label))])
    );
    const ownerOfSubname = await nameWrapper.ownerOf(BigInt(subnode));
    expect(ownerOfSubname).to.equal(user.address);

    const treasuryAfter = await ethers.provider.getBalance(treasury.address);
    expect(treasuryAfter - treasuryBefore).to.equal(platformFee);
  });
});
