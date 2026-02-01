/**
 * Script to verify and assign ADMIN role
 * Usage: npx tsx scripts/verify-and-assign-admin.ts [address]
 */

import { getRole, assignRole } from '../lib/blockchain/contract-sui';
import { Role } from '../lib/blockchain/types-sui';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const TARGET_ADDRESS = process.argv[2] || process.env.OWNER_ADDRESS || '';

async function main() {
  if (!OWNER_PRIVATE_KEY) {
    console.error('❌ OWNER_PRIVATE_KEY not found in environment variables');
    console.error('   Please set OWNER_PRIVATE_KEY in .env file');
    process.exit(1);
  }

  // Get the address from the private key
  const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
  const { bech32 } = require('bech32');
  
  let ownerAddress: string;
  try {
    // Parse private key (same logic as in contract-sui.ts)
    const trimmedKey = OWNER_PRIVATE_KEY.trim();
    let keypair: any;
    
    if (trimmedKey.startsWith('suiprivkey1')) {
      const decoded = bech32.decode(trimmedKey);
      const privateKeyBytes = Uint8Array.from(bech32.fromWords(decoded.words));
      const keyBytes = privateKeyBytes.length > 32 
        ? privateKeyBytes.slice(-32) 
        : privateKeyBytes;
      keypair = Ed25519Keypair.fromSecretKey(keyBytes);
    } else if (trimmedKey.startsWith('0x')) {
      const hexPart = trimmedKey.slice(2);
      if (hexPart.length === 64) {
        const privateKeyBytes = Uint8Array.from(Buffer.from(hexPart, 'hex'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else if (hexPart.length === 128) {
        const privateKeyBytes = Uint8Array.from(Buffer.from(hexPart.slice(0, 64), 'hex'));
        keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else {
        throw new Error('Invalid hex private key length');
      }
    } else if (trimmedKey.length === 64 && /^[0-9a-fA-F]+$/.test(trimmedKey)) {
      const privateKeyBytes = Uint8Array.from(Buffer.from(trimmedKey, 'hex'));
      keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    } else {
      throw new Error('Unsupported private key format');
    }
    
    ownerAddress = keypair.toSuiAddress();
    console.log(`✅ Owner address: ${ownerAddress}`);
  } catch (error: any) {
    console.error('❌ Failed to parse OWNER_PRIVATE_KEY:', error.message);
    process.exit(1);
  }

  // Check current role
  console.log('\n📋 Checking current role...');
  try {
    const currentRole = await getRole(ownerAddress);
    console.log(`   Current role: ${Role[currentRole] || 'NONE'} (${currentRole})`);
    
    if (currentRole === Role.ADMIN) {
      console.log('✅ Owner already has ADMIN role!');
      
      // If target address is provided and different, assign ADMIN to it
      if (TARGET_ADDRESS && TARGET_ADDRESS.toLowerCase() !== ownerAddress.toLowerCase()) {
        console.log(`\n🔑 Assigning ADMIN role to ${TARGET_ADDRESS}...`);
        const result = await assignRole(TARGET_ADDRESS, Role.ADMIN, OWNER_PRIVATE_KEY);
        
        if (result.success) {
          console.log(`✅ Successfully assigned ADMIN role to ${TARGET_ADDRESS}`);
          console.log(`   Transaction: ${result.digest}`);
        } else {
          console.error(`❌ Failed to assign ADMIN role: ${result.error}`);
          process.exit(1);
        }
      }
      
      return;
    }
  } catch (error: any) {
    console.error('❌ Error checking role:', error.message);
    process.exit(1);
  }

  // If owner doesn't have ADMIN role, we can't assign it
  // This should only happen if the contract was deployed by a different address
  console.log('\n⚠️  Owner does not have ADMIN role.');
  console.log('   The deployer address automatically gets ADMIN role.');
  console.log('   If you need to assign ADMIN role to this address, you need to:');
  console.log('   1. Use the deployer address to assign ADMIN role to this address');
  console.log('   2. Or deploy the contract with this address');
  
  if (TARGET_ADDRESS) {
    console.log(`\n   To assign ADMIN role to ${TARGET_ADDRESS}, use the deployer address.`);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

