require("@nomicfoundation/hardhat-verify");
require("dotenv").config({ path: ".env.local" });

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    mainnet: {
      url: process.env.NEXT_PUBLIC_ALCHEMY_MAINNET || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
