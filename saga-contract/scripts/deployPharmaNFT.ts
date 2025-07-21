import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const PharmaNFT = await ethers.getContractFactory("PharmaNFT");
  const contract = await PharmaNFT.deploy(deployer.address);
  await contract.waitForDeployment();

  console.log("PharmaNFT deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 