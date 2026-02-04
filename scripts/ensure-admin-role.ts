/**
 * Script to ensure OWNER_PRIVATE_KEY has ADMIN role
 * This should be run after deploying the contract
 * Usage: npx tsx scripts/ensure-admin-role.ts
 */

import * as dotenv from 'dotenv';
import { getRole, assignRole } from '../lib/blockchain/contract-sui';
import { Role } from '../lib/blockchain/types-sui';
import { parsePrivateKey } from '../lib/blockchain/contract-sui';

// Load .env file
dotenv.config();

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

async function main() {
  console.log('🔑 Ensuring OWNER_PRIVATE_KEY has ADMIN role');
  console.log('==========================================\n');

  if (!OWNER_PRIVATE_KEY) {
    console.error('❌ OWNER_PRIVATE_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    // Get owner address
    const keypair = parsePrivateKey(OWNER_PRIVATE_KEY);
    const ownerAddress = keypair.toSuiAddress();
    console.log(`✅ Owner address: ${ownerAddress}\n`);

    // Check current role
    console.log('📋 Checking current role...');
    const currentRole = await getRole(ownerAddress);
    console.log(`   Current role: ${Role[currentRole] || 'NONE'} (${currentRole})\n`);

    if (currentRole === Role.ADMIN) {
      console.log('✅ Owner already has ADMIN role!');
      console.log('   No action needed.\n');
      return;
    }

    // Try to assign ADMIN role
    // Note: This will only work if the owner is the deployer (who automatically gets ADMIN)
    // Or if another admin assigns ADMIN role to this address
    console.log('🔑 Attempting to assign ADMIN role...');
    console.log('   Note: This will only work if this address is the deployer.\n');

    const result = await assignRole(ownerAddress, Role.ADMIN, OWNER_PRIVATE_KEY);

    if (result.success) {
      console.log('✅ Successfully assigned ADMIN role!');
      console.log(`   Transaction: ${result.digest}`);
      console.log(`   Explorer: https://suiexplorer.com/txblock/${result.digest}?network=testnet\n`);

      // Verify
      console.log('📋 Verifying role assignment...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newRole = await getRole(ownerAddress);
      
      if (newRole === Role.ADMIN) {
        console.log('✅ Verification successful! Owner now has ADMIN role.\n');
      } else {
        console.warn(`⚠️  Verification: Role is ${Role[newRole] || 'NONE'} (expected ADMIN)`);
        console.warn('   This might be a timing issue. Try checking again in a few seconds.\n');
      }
    } else {
      console.error('❌ Failed to assign ADMIN role');
      console.error(`   Error: ${result.error}\n`);
      
      if (result.error?.includes('does not have ADMIN role') || result.error?.includes('Only admin')) {
        console.error('💡 Solution:');
        console.error('   1. If this address is the deployer, it should already have ADMIN role.');
        console.error('   2. If this address is NOT the deployer, you need to:');
        console.error('      - Use the deployer address to assign ADMIN role to this address');
        console.error('      - Or deploy the contract with this address\n');
      }
      
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

