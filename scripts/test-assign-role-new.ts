/**
 * Test script to verify role assignment on new deployed contract
 */

import { getRole, assignRole } from '../lib/blockchain/contract-sui';
import { Role } from '../lib/blockchain/types-sui';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const DEPLOYER_ADDRESS = '0x174a43ffabe53872a9f1a41be51033026aad4d1d4ab4f5f4de8b4ce6d62f1516';

// Test address - bạn có thể thay đổi địa chỉ này
const TEST_ADDRESS = '0x174a43ffabe53872a9f1a41be51033026aad4d1d4ab4f5f4de8b4ce6d62f1516';

async function main() {
  console.log('🧪 Testing Role Assignment on New Contract');
  console.log('==========================================\n');

  if (!OWNER_PRIVATE_KEY) {
    console.error('❌ OWNER_PRIVATE_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    // 1. Check deployer role (should be ADMIN)
    console.log('1️⃣ Checking deployer role...');
    const deployerRole = await getRole(DEPLOYER_ADDRESS);
    console.log(`   Deployer: ${DEPLOYER_ADDRESS}`);
    console.log(`   Role: ${Role[deployerRole] || 'NONE'} (${deployerRole})`);
    
    if (deployerRole === Role.ADMIN) {
      console.log('   ✅ Deployer has ADMIN role!\n');
    } else {
      console.log('   ⚠️  Deployer does NOT have ADMIN role. This is unexpected.\n');
    }

    // 2. Check test address role (before assignment)
    console.log('2️⃣ Checking test address role (before assignment)...');
    const testRoleBefore = await getRole(TEST_ADDRESS);
    console.log(`   Test Address: ${TEST_ADDRESS}`);
    console.log(`   Current Role: ${Role[testRoleBefore] || 'NONE'} (${testRoleBefore})\n`);

    // 3. Assign MANUFACTURER role to test address
    if (TEST_ADDRESS === DEPLOYER_ADDRESS) {
      console.log('3️⃣ Test address is same as deployer (already has ADMIN role)');
      console.log('   Assigning MANUFACTURER role to test...\n');
    } else {
      console.log('3️⃣ Assigning MANUFACTURER role to test address...\n');
    }

    const assignResult = await assignRole(TEST_ADDRESS, Role.MANUFACTURER, OWNER_PRIVATE_KEY);
    
    if (assignResult.success) {
      console.log('   ✅ Role assignment successful!');
      console.log(`   Transaction: ${assignResult.digest}`);
      console.log(`   Explorer: https://suiexplorer.com/txblock/${assignResult.digest}?network=testnet\n`);
    } else {
      console.error('   ❌ Role assignment failed!');
      console.error(`   Error: ${assignResult.error}\n`);
      process.exit(1);
    }

    // 4. Verify role was assigned
    console.log('4️⃣ Verifying role assignment...');
    // Wait a bit for transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const testRoleAfter = await getRole(TEST_ADDRESS);
    console.log(`   Test Address: ${TEST_ADDRESS}`);
    console.log(`   New Role: ${Role[testRoleAfter] || 'NONE'} (${testRoleAfter})`);
    
    if (testRoleAfter === Role.MANUFACTURER) {
      console.log('   ✅ Role assignment verified!\n');
    } else {
      console.log('   ⚠️  Role mismatch. Expected MANUFACTURER, got:', Role[testRoleAfter] || 'NONE');
      console.log('   (This might be a timing issue, try again in a few seconds)\n');
    }

    // 5. Test assigning another role (DISTRIBUTOR)
    console.log('5️⃣ Testing role update (assigning DISTRIBUTOR)...\n');
    const updateResult = await assignRole(TEST_ADDRESS, Role.DISTRIBUTOR, OWNER_PRIVATE_KEY);
    
    if (updateResult.success) {
      console.log('   ✅ Role update successful!');
      console.log(`   Transaction: ${updateResult.digest}\n`);
      
      // Wait and verify
      await new Promise(resolve => setTimeout(resolve, 2000));
      const finalRole = await getRole(TEST_ADDRESS);
      console.log(`   Final Role: ${Role[finalRole] || 'NONE'} (${finalRole})`);
      
      if (finalRole === Role.DISTRIBUTOR) {
        console.log('   ✅ Role update verified!\n');
      }
    } else {
      console.error('   ❌ Role update failed!');
      console.error(`   Error: ${updateResult.error}\n`);
    }

    console.log('✅ All tests completed!');
    console.log('\n📝 Summary:');
    console.log(`   - Deployer has ADMIN role: ${deployerRole === Role.ADMIN ? '✅' : '❌'}`);
    console.log(`   - Can assign roles: ${assignResult.success ? '✅' : '❌'}`);
    console.log(`   - Can update roles: ${updateResult.success ? '✅' : '❌'}`);

  } catch (error: any) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

