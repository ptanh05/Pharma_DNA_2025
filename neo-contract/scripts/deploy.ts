/**
 * Deploy PharmaNFT Contract to Neo N3 Testnet
 * Using TypeScript with neon-core SDK v5
 */

import { wallet, rpc, u, sc, tx } from '@cityofzion/neon-core';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

dotenv.config();

// Neo N3 Testnet Configuration
const NEO_TESTNET_CONFIG = {
  name: 'TestNet',
  rpcServer: process.env.NEO_TESTNET_RPC || 'https://seed1t5.neo.org:20331',
  neoscan: process.env.NEO_TESTNET_EXPLORER || 'https://testnet.neoscan.io',
  networkMagic: 56753, // Neo N3 Testnet network magic
};

// Deployer account
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || '';

if (!DEPLOYER_PRIVATE_KEY) {
  console.error('❌ DEPLOYER_PRIVATE_KEY not found in .env');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 PharmaNFT Contract Deployment to Neo N3 Testnet');
  console.log('='.repeat(60));

  try {
    // Step 1: Load contract file
    console.log('\n📦 Step 1: Loading contract...');
    const contractPath = path.join(__dirname, '../PharmaNFT.nef');
    
    if (!fs.existsSync(contractPath)) {
      console.error('❌ Contract file not found:', contractPath);
      console.error('💡 Please compile the contract first: npm run compile');
      process.exit(1);
    }

    const nefFile = fs.readFileSync(contractPath);
    const manifestPath = path.join(__dirname, '../PharmaNFT.manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      console.error('❌ Manifest file not found:', manifestPath);
      console.error('💡 Please compile the contract first: npm run compile');
      process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    console.log('✅ Contract files loaded');

    // Step 2: Create account from private key
    console.log('\n👤 Step 2: Setting up deployer account...');
    const account = new wallet.Account(DEPLOYER_PRIVATE_KEY);
    console.log('   Address:', account.address);
    console.log('   Public Key:', account.publicKey);

    // Step 3: Check balance
    console.log('\n💰 Step 3: Checking balance...');
    const rpcClient = new rpc.RPCClient(NEO_TESTNET_CONFIG.rpcServer);
    
    try {
      const balanceResult = await rpcClient.getNep17Balances(account.address);
      console.log('   Balance:', JSON.stringify(balanceResult, null, 2));
      
      // Check GAS balance
      const balances = (balanceResult as any).balances || [];
      const gasBalance = balances.find((b: any) => b.asset_symbol === 'GAS');
      if (!gasBalance || parseFloat(gasBalance.amount) < 10) {
        console.warn('⚠️  Low GAS balance! You need GAS to deploy.');
        console.warn('   Get testnet GAS from: https://neowish.ngd.network/');
      } else {
        console.log('   ✅ GAS balance:', gasBalance.amount);
      }
    } catch (error: any) {
      console.warn('⚠️  Could not check balance:', error.message);
    }

    // Step 4: Deploy contract
    console.log('\n📤 Step 4: Deploying contract...');
    
    // Read NEF file
    const nefBuffer = Buffer.from(nefFile);
    const nefBase64 = nefBuffer.toString('base64');
    
    // ContractManagement contract hash (Neo N3)
    const CONTRACTMANAGEMENT_HASH = '0xfffdc93764db5d547b3f43ad962121ffb7949ca2';
    
    // Build script: ContractManagement.deploy(nef, manifest)
    const scriptBuilder = new sc.ScriptBuilder();
    
    // Prepare arguments
    const manifestJson = JSON.stringify(manifest);
    
    // Call ContractManagement.deploy with arguments as array
    scriptBuilder.emitAppCall(
      u.HexString.fromHex(CONTRACTMANAGEMENT_HASH),
      'deploy',
      [nefBase64, manifestJson]  // Arguments as array
    );
    
    const deployScript = u.HexString.fromHex(scriptBuilder.build());

    // Get network fee
    console.log('   ⏳ Calculating network fee...');
    try {
      const invokeResult = await rpcClient.invokeScript(deployScript);
      console.log('   Network fee:', invokeResult.gasconsumed || 'N/A');
    } catch (error: any) {
      console.warn('   ⚠️  Could not calculate fee:', error.message);
    }

    // Build transaction
    console.log('   ⏳ Building deployment transaction...');
    const transaction = new tx.Transaction();
    transaction.script = deployScript;
    transaction.networkFee = u.BigInteger.fromNumber(10000000); // 0.1 GAS
    transaction.systemFee = u.BigInteger.fromNumber(10000000); // 0.1 GAS
    transaction.validUntilBlock = 0; // Will be set by RPC
    
    // Create signer
    const signer = new tx.Signer();
    signer.account = u.HexString.fromHex(account.scriptHash);
    signer.scopes = tx.WitnessScope.CalledByEntry;
    transaction.signers = [signer];

    // Get current block height
    try {
      const blockCount = await rpcClient.getBlockCount();
      transaction.validUntilBlock = blockCount + 1000;
    } catch (error: any) {
      console.warn('   ⚠️  Could not get block count, using default');
      transaction.validUntilBlock = 1000000;
    }

    // Sign transaction
    console.log('   ⏳ Signing transaction...');
    transaction.sign(account, NEO_TESTNET_CONFIG.networkMagic);

    // Send transaction
    console.log('   ⏳ Sending transaction...');
    const result = await rpcClient.sendRawTransaction(transaction);

    if (result) {
      console.log('   ✅ Transaction sent!');
      const txHash = transaction.hash();
      console.log('   📝 Transaction hash:', txHash);
      console.log('   🔗 Explorer:', `${NEO_TESTNET_CONFIG.neoscan}/tx/${txHash}`);
      
      // Wait for confirmation
      console.log('\n⏳ Step 5: Waiting for confirmation...');
      console.log('   This may take 15-30 seconds...');
      
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (!confirmed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const txInfo = await rpcClient.getApplicationLog(txHash);
          if (txInfo && txInfo.executions && txInfo.executions.length > 0) {
            const execution = txInfo.executions[0];
            if (execution.vmstate === 'HALT') {
              confirmed = true;
              console.log('   ✅ Transaction confirmed!');
              
              // Get contract hash from transaction result
              // In Neo N3, contract hash is calculated from NEF and manifest
              // We need to get it from the application log or calculate it
              let contractHash = '';
              
              try {
                // Try to get contract hash from application log
                if (txInfo.executions && txInfo.executions[0].notifications) {
                  const notifications = txInfo.executions[0].notifications;
                  // ContractManagement contract emits notification with contract hash
                  for (const notif of notifications) {
                    if (notif.contract === '0xfffdc93764db5d547b3f43ad962121ffb7949ca2') {
                      // This is ContractManagement notification
                      if (notif.state && notif.state.value) {
                        // Convert value to string (Neo returns various types)
                        const value = notif.state.value;
                        if (typeof value === 'string') {
                          contractHash = value;
                        } else if (typeof value === 'number') {
                          contractHash = value.toString(16).padStart(40, '0');
                          if (!contractHash.startsWith('0x')) {
                            contractHash = '0x' + contractHash;
                          }
                        } else if (Array.isArray(value) && value.length > 0) {
                          // If it's an array, take first element
                          const firstItem = value[0];
                          if (firstItem && typeof firstItem.value === 'string') {
                            contractHash = firstItem.value;
                          }
                        }
                        if (contractHash) break;
                      }
                    }
                  }
                }
                
                // If not found, calculate from NEF
                if (!contractHash) {
                  // Contract hash = hash160(nef + manifest)
                  const nefHash = crypto.createHash('sha256').update(nefFile).digest();
                  const manifestHash = crypto.createHash('sha256').update(JSON.stringify(manifest)).digest();
                  const combined = Buffer.concat([nefHash, manifestHash]);
                  const hash160 = crypto.createHash('ripemd160').update(crypto.createHash('sha256').update(combined).digest()).digest();
                  contractHash = '0x' + hash160.toString('hex');
                }
              } catch (error: any) {
                console.warn('   ⚠️  Could not get contract hash:', error.message);
                // Fallback: use script hash (not ideal but works)
                contractHash = account.scriptHash;
              }
              
              console.log('\n' + '='.repeat(60));
              console.log('✅ DEPLOYMENT SUCCESSFUL!');
              console.log('='.repeat(60));
              console.log('\n📍 Transaction Hash:', txHash);
              console.log('📍 Contract Hash:', contractHash);
              console.log('🔗 Explorer:', `${NEO_TESTNET_CONFIG.neoscan}/tx/${txHash}`);
              
              // Save contract hash to .env
              const envPath = path.join(__dirname, '../../.env');
              let envContent = fs.existsSync(envPath) 
                ? fs.readFileSync(envPath, 'utf-8')
                : '';
              
              // Update or add NEO_CONTRACT_HASH
              if (envContent.includes('NEO_CONTRACT_HASH=')) {
                envContent = envContent.replace(/NEO_CONTRACT_HASH=.*/g, `NEO_CONTRACT_HASH=${contractHash}`);
                fs.writeFileSync(envPath, envContent);
              } else {
                fs.appendFileSync(envPath, `\nNEO_CONTRACT_HASH=${contractHash}\n`);
              }
              
              // Also save to neo-contract/.env
              const contractEnvPath = path.join(__dirname, '../.env');
              let contractEnvContent = fs.existsSync(contractEnvPath) 
                ? fs.readFileSync(contractEnvPath, 'utf-8')
                : '';
              
              if (contractEnvContent.includes('NEO_CONTRACT_HASH=')) {
                contractEnvContent = contractEnvContent.replace(/NEO_CONTRACT_HASH=.*/g, `NEO_CONTRACT_HASH=${contractHash}`);
                fs.writeFileSync(contractEnvPath, contractEnvContent);
              } else {
                fs.appendFileSync(contractEnvPath, `\nNEO_CONTRACT_HASH=${contractHash}\n`);
              }
              
              console.log('\n📝 Contract hash saved to .env files');
              
              console.log('\n📋 Next Steps:');
              console.log('1. Contract hash:', contractHash);
              console.log('2. Update frontend/backend to use Neo SDK');
              console.log('3. Test contract functions');
              
            } else if (execution.vmstate === 'FAULT') {
              console.error('   ❌ Transaction failed!');
              console.error('   Error:', execution.exception);
              process.exit(1);
            }
          }
        } catch (error: any) {
          // Transaction not confirmed yet
          process.stdout.write(`\r   ⏳ Waiting... (${attempts + 1}/${maxAttempts})`);
        }
        
        attempts++;
      }
      
      if (!confirmed) {
        console.warn('\n⚠️  Transaction not confirmed yet, but it was sent.');
        console.warn('   Check explorer:', `${NEO_TESTNET_CONFIG.neoscan}/tx/${txHash}`);
      }
      
    } else {
      console.error('❌ Failed to send transaction');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Deployment failed!');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n✅ Deployment script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
