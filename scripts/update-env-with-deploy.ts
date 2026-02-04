/**
 * Update .env file with new deployment information
 */

import * as fs from 'fs';
import * as path from 'path';

const PACKAGE_ID = '0xe440177fdd4b9020e92d455c34ff2ad52c6ceb934ef23ece68921fb31bc67b6f';
const CONTRACT_OBJECT_ID = '0x6f9e896642e4553f830e50e8626b29a812cfb7c7ea4236412d8bb139dd4da7bc';
const OWNER_PRIVATE_KEY = 'suiprivkey1qpt6eqr6lm4738kz229lk5zr2xsxh0lezkmyuhc59mfuwwcffyv4ulu06tu';
const DEPLOYER_ADDRESS = '0x174a43ffabe53872a9f1a41be51033026aad4d1d4ab4f5f4de8b4ce6d62f1516';

const envPath = path.join(process.cwd(), '.env');

// Read existing .env file
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
} else {
  console.log('⚠️  .env file not found, creating new one...');
}

// Update or add SUI_PACKAGE_ID
if (envContent.includes('SUI_PACKAGE_ID=')) {
  envContent = envContent.replace(/SUI_PACKAGE_ID=.*/g, `SUI_PACKAGE_ID=${PACKAGE_ID}`);
} else {
  envContent += `\nSUI_PACKAGE_ID=${PACKAGE_ID}`;
}

// Update or add NEXT_PUBLIC_SUI_PACKAGE_ID
if (envContent.includes('NEXT_PUBLIC_SUI_PACKAGE_ID=')) {
  envContent = envContent.replace(/NEXT_PUBLIC_SUI_PACKAGE_ID=.*/g, `NEXT_PUBLIC_SUI_PACKAGE_ID=${PACKAGE_ID}`);
} else {
  envContent += `\nNEXT_PUBLIC_SUI_PACKAGE_ID=${PACKAGE_ID}`;
}

// Update or add SUI_CONTRACT_OBJECT_ID
if (envContent.includes('SUI_CONTRACT_OBJECT_ID=')) {
  envContent = envContent.replace(/SUI_CONTRACT_OBJECT_ID=.*/g, `SUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`);
} else {
  envContent += `\nSUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`;
}

// Update or add NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID
if (envContent.includes('NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID=')) {
  envContent = envContent.replace(/NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID=.*/g, `NEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`);
} else {
  envContent += `\nNEXT_PUBLIC_SUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`;
}

// Update or add OWNER_PRIVATE_KEY
if (envContent.includes('OWNER_PRIVATE_KEY=')) {
  envContent = envContent.replace(/OWNER_PRIVATE_KEY=.*/g, `OWNER_PRIVATE_KEY=${OWNER_PRIVATE_KEY}`);
} else {
  envContent += `\nOWNER_PRIVATE_KEY=${OWNER_PRIVATE_KEY}`;
}

// Clean up: remove leading newlines
envContent = envContent.replace(/^\n+/, '');

// Write back to .env
fs.writeFileSync(envPath, envContent, 'utf-8');

console.log('✅ Đã cập nhật .env file với thông tin deploy mới:');
console.log('');
console.log(`   SUI_PACKAGE_ID=${PACKAGE_ID}`);
console.log(`   SUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`);
console.log(`   OWNER_PRIVATE_KEY=${OWNER_PRIVATE_KEY}`);
console.log('');
console.log(`✅ Deployer address: ${DEPLOYER_ADDRESS}`);
console.log('   (Deployer tự động có ADMIN role trong contract)');
console.log('');
console.log('🔗 View contract on explorer:');
console.log(`   https://suiexplorer.com/object/${PACKAGE_ID}?network=testnet`);
console.log(`   https://suiexplorer.com/object/${CONTRACT_OBJECT_ID}?network=testnet`);

