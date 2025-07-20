import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const PharmaNFT = await ethers.getContractFactory("PharmaNFT");
  const contract = await PharmaNFT.deploy();
  await contract.deployed();

  console.log("PharmaNFT deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 