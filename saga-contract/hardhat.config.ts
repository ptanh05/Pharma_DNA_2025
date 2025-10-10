import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.8.20" },
      { version: "0.8.28" }
    ]
  },
  networks: {
    pharmadna: {
      url: "https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io",
      accounts: ["edbfcf6a307fd200774813b760d39721e5e2e9e7ae75846106b4f32a5fea2d5b"]
    }
  }
};

export default config;
