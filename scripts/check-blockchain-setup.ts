/**
 * Check Blockchain Setup
 * Script to verify blockchain configuration and setup
 */

import { getSuiClient, getPackageId, getContractObjectId, getSuiBalance } from '../lib/blockchain/provider-sui';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

async function checkSetup() {
  console.log('🔍 Checking Blockchain Setup...\n');
  
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // 1. Check OWNER_PRIVATE_KEY
  console.log('1️⃣ Checking OWNER_PRIVATE_KEY...');
  const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
  if (!ownerPrivateKey) {
    issues.push('OWNER_PRIVATE_KEY is not configured in environment variables');
    console.log('   ❌ OWNER_PRIVATE_KEY not found\n');
  } else {
    try {
      // Try to create keypair to validate format
      let keypair: Ed25519Keypair;
      if (ownerPrivateKey.startsWith('0x')) {
        const privateKeyBytes = Uint8Array.from(Buffer.from(ownerPrivateKey.slice(2), 'hex'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else {
        const privateKeyBytes = Uint8Array.from(Buffer.from(ownerPrivateKey, 'base64'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      }
      
      const address = keypair.toSuiAddress();
      console.log(`   ✅ OWNER_PRIVATE_KEY is valid`);
      console.log(`   📍 Owner Address: ${address}`);
      
      // Check balance
      const balance = await getSuiBalance(address);
      const balanceNum = BigInt(balance);
      const minBalance = BigInt(1000000000); // 0.001 SUI
      
      if (balanceNum < minBalance) {
        warnings.push(`Owner address has low balance: ${balance} (recommended: at least 0.001 SUI)`);
        console.log(`   ⚠️  Balance: ${balance} (low, may not be enough for transactions)`);
      } else {
        console.log(`   ✅ Balance: ${balance} (sufficient)`);
      }
    } catch (error: any) {
      issues.push(`OWNER_PRIVATE_KEY format is invalid: ${error.message}`);
      console.log(`   ❌ Invalid format: ${error.message}\n`);
    }
  }
  
  // 2. Check SUI_PACKAGE_ID
  console.log('\n2️⃣ Checking SUI_PACKAGE_ID...');
  try {
    const packageId = getPackageId() ?? '';
    console.log(`   ✅ SUI_PACKAGE_ID: ${packageId}`);
    
    // Try to verify package exists
    try {
      const client = getSuiClient();
      await client.getObject({ id: packageId });
      console.log(`   ✅ Package exists on blockchain`);
    } catch (error) {
      warnings.push(`Package ID ${packageId} may not exist on blockchain`);
      console.log(`   ⚠️  Could not verify package exists`);
    }
  } catch (error: any) {
    issues.push(`SUI_PACKAGE_ID: ${error.message}`);
    console.log(`   ❌ ${error.message}\n`);
  }
  
  // 3. Check SUI_CONTRACT_OBJECT_ID
  console.log('\n3️⃣ Checking SUI_CONTRACT_OBJECT_ID...');
  try {
    const contractObjectId = getContractObjectId();
    console.log(`   ✅ SUI_CONTRACT_OBJECT_ID: ${contractObjectId}`);
    
    // Try to verify contract object exists
    try {
      const client = getSuiClient();
      const object = await client.getObject({ id: contractObjectId! });
      console.log(`   ✅ Contract object exists on blockchain`);
      
      if (object.data && 'type' in object.data) {
        console.log(`   📋 Object type: ${object.data.type}`);
      }
    } catch (error) {
      warnings.push(`Contract Object ID ${contractObjectId} may not exist on blockchain`);
      console.log(`   ⚠️  Could not verify contract object exists`);
    }
  } catch (error: any) {
    issues.push(`SUI_CONTRACT_OBJECT_ID: ${error.message}`);
    console.log(`   ❌ ${error.message}\n`);
  }
  
  // 4. Check RPC Connection
  console.log('\n4️⃣ Checking Sui RPC Connection...');
  try {
    const client = getSuiClient();
    await client.getLatestSuiSystemState();
    console.log(`   ✅ RPC connection successful`);
  } catch (error: any) {
    issues.push(`RPC connection failed: ${error.message}`);
    console.log(`   ❌ RPC connection failed: ${error.message}\n`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log('='.repeat(50));
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed! Blockchain setup is complete.\n');
    console.log('💡 You can now use blockchain features in the application.');
  } else {
    if (issues.length > 0) {
      console.log('\n❌ Critical Issues (must fix):');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings (should fix):');
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }
    
    console.log('\n📖 See SETUP_BLOCKCHAIN.md for detailed setup instructions.');
  }
  
  process.exit(issues.length > 0 ? 1 : 0);
}

// Run check
checkSetup().catch((error) => {
  console.error('Error checking setup:', error);
  process.exit(1);
});

