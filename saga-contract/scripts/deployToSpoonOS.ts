import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🚀 Deploying PharmaNFT to SpoonOS Network");
  console.log("📋 Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH/SPOON");
  
  if (balance === 0n) {
    console.warn("⚠️  WARNING: Account balance is 0. Make sure you have funds!");
  }

  console.log("\n📦 Deploying contract...");
  const PharmaNFT = await ethers.getContractFactory("PharmaNFT");
  const contract = await PharmaNFT.deploy(deployer.address);
  
  console.log("⏳ Waiting for deployment...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  
  console.log("\n✅ Deployment successful!");
  console.log("📍 Contract address:", address);
  console.log("🌐 SpoonOS Explorer:", `${process.env.SPOONOS_EXPLORER || "https://explorer.spoonos.io"}/address/${address}`);
  console.log("\n📝 Add this to your .env file:");
  console.log(`NEXT_PUBLIC_PHARMA_NFT_ADDRESS=${address}`);
  
  // Verify deployment
  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    console.error("❌ ERROR: Contract code not found at address!");
  } else {
    console.log("✅ Contract code verified");
  }

  // Test basic functions
  try {
    const owner = await contract.owner();
    console.log("👤 Contract owner:", owner);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.warn("⚠️  WARNING: Owner mismatch!");
    }
  } catch (error) {
    console.warn("⚠️  Could not verify owner");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

