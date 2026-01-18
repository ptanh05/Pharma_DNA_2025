import * as fs from 'fs';
import * as path from 'path';

const OWNER_PRIVATE_KEY = 'suiprivkey1qpt6eqr6lm4738kz229lk5zr2xsxh0lezkmyuhc59mfuwwcffyv4ulu06tu';

const envPath = path.join(process.cwd(), '.env');
let envContent = '';

// Read existing .env if it exists
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

// Update or add OWNER_PRIVATE_KEY
if (envContent.includes('OWNER_PRIVATE_KEY=')) {
  envContent = envContent.replace(/OWNER_PRIVATE_KEY=.*/g, `OWNER_PRIVATE_KEY=${OWNER_PRIVATE_KEY}`);
} else {
  envContent += `\nOWNER_PRIVATE_KEY=${OWNER_PRIVATE_KEY}`;
}

// Write back to .env
fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');

console.log('✅ Đã lưu OWNER_PRIVATE_KEY vào .env');

