import * as fs from 'fs';
import * as path from 'path';

// Deploy information from transaction
const PACKAGE_ID = '0x8270a3f247a4e39dee98f196626b6f8af5a59faeeed502db3b10fc234eb0ec02';
const CONTRACT_OBJECT_ID = '0x1b14df0a06023f8b6c3e94a66cd471b47f70cba3a9d20ed740b100ee792cfd2c';
const ADMIN_CAP_OBJECT_ID = '0x81643865e89499b64d8373a492969d7bcbfc2af9efd052ab4848073a87368684';
const DEPLOYER_ADDRESS = '0x174a43ffabe53872a9f1a41be51033026aad4d1d4ab4f5f4de8b4ce6d62f1516';

const envPath = path.join(process.cwd(), '.env');
let envContent = '';

// Read existing .env if it exists
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

// Update or add SUI_PACKAGE_ID
if (envContent.includes('SUI_PACKAGE_ID=')) {
  envContent = envContent.replace(/SUI_PACKAGE_ID=.*/g, `SUI_PACKAGE_ID=${PACKAGE_ID}`);
} else {
  envContent += `\nSUI_PACKAGE_ID=${PACKAGE_ID}`;
}

// Update or add SUI_CONTRACT_OBJECT_ID
if (envContent.includes('SUI_CONTRACT_OBJECT_ID=')) {
  envContent = envContent.replace(/SUI_CONTRACT_OBJECT_ID=.*/g, `SUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`);
} else {
  envContent += `\nSUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`;
}

// Update or add SUI_ADMIN_CAP_OBJECT_ID (optional, for reference)
if (envContent.includes('SUI_ADMIN_CAP_OBJECT_ID=')) {
  envContent = envContent.replace(/SUI_ADMIN_CAP_OBJECT_ID=.*/g, `SUI_ADMIN_CAP_OBJECT_ID=${ADMIN_CAP_OBJECT_ID}`);
} else {
  envContent += `\nSUI_ADMIN_CAP_OBJECT_ID=${ADMIN_CAP_OBJECT_ID}`;
}

// Write back to .env
fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');

console.log('✅ Đã lưu thông tin deploy vào .env:');
console.log(`   SUI_PACKAGE_ID=${PACKAGE_ID}`);
console.log(`   SUI_CONTRACT_OBJECT_ID=${CONTRACT_OBJECT_ID}`);
console.log(`   SUI_ADMIN_CAP_OBJECT_ID=${ADMIN_CAP_OBJECT_ID}`);
console.log(`\n⚠️  Bạn cần thêm OWNER_PRIVATE_KEY vào .env thủ công.`);
console.log(`   Để export private key, chạy:`);
console.log(`   sui keytool export --key-identity wizardly-cyanite`);

