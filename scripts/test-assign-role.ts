/**
 * Test assign role via API
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_ADDRESS = '0x18162b27978483857b7f60341944f1443431ace6'; // Ethereum format address
const TEST_ROLE = 'DISTRIBUTOR';

async function testAssignRole() {
  console.log('🧪 Testing assign role via API...\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Address: ${TEST_ADDRESS}`);
  console.log(`Role: ${TEST_ROLE}\n`);

  try {
    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: TEST_ADDRESS,
        role: TEST_ROLE,
      }),
    });

    const data = await response.json();

    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('\n✅ Test PASSED: Role assigned successfully!');
      if (data.blockchainSynced) {
        console.log('✅ Blockchain sync: SUCCESS');
      } else {
        console.log('⚠️  Blockchain sync: FAILED (but database updated)');
        if (data.error) {
          console.log(`   Error: ${data.error}`);
        }
        if (data.hints && data.hints.length > 0) {
          console.log('   Hints:');
          data.hints.forEach((hint: string) => console.log(`   - ${hint}`));
        }
      }
    } else {
      console.log('\n❌ Test FAILED');
      if (data.error) {
        console.log(`   Error: ${data.error}`);
      }
      if (data.detail) {
        console.log(`   Detail: ${data.detail}`);
      }
    }
  } catch (error: any) {
    console.error('\n❌ Test ERROR:', error.message);
    console.error('   Make sure the server is running: npm run dev');
  }
}

testAssignRole();

