/**
 * Test script to verify private key parsing
 * Run with: npx tsx scripts/test-private-key-parse.ts
 */

import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { bech32 } from 'bech32';
import * as readline from 'readline';

// Copy the parsePrivateKey function logic for testing
function parsePrivateKey(privateKey: string): Ed25519Keypair {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('Private key must be a non-empty string');
  }

  const trimmedKey = privateKey.trim();

  try {
    // Check if it's bech32 format (suiprivkey1...)
    if (trimmedKey.startsWith('suiprivkey1')) {
      const decoded = bech32.decode(trimmedKey);
      const privateKeyBytes = Uint8Array.from(bech32.fromWords(decoded.words));
      const keyBytes = privateKeyBytes.length > 32 
        ? privateKeyBytes.slice(-32) 
        : privateKeyBytes;
      
      if (keyBytes.length !== 32) {
        throw new Error(`Invalid bech32 private key length: ${keyBytes.length}, expected 32 bytes`);
      }
      
      return Ed25519Keypair.fromSecretKey(keyBytes);
    }
    
    // Check if it's hex format with 0x prefix
    if (trimmedKey.startsWith('0x')) {
      const hexPart = trimmedKey.slice(2);
      if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
        throw new Error('Invalid hex format in 0x-prefixed private key');
      }
      
      if (hexPart.length === 64) {
        const privateKeyBytes = Uint8Array.from(Buffer.from(hexPart, 'hex'));
        if (privateKeyBytes.length !== 32) {
          throw new Error(`Invalid hex private key length: ${privateKeyBytes.length}, expected 32 bytes`);
        }
        return Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else if (hexPart.length === 128) {
        const privateKeyBytes = Uint8Array.from(Buffer.from(hexPart.slice(0, 64), 'hex'));
        return Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else {
        throw new Error(`Invalid hex private key length: ${hexPart.length} chars, expected 64 or 128 chars`);
      }
    }
    
    // Check if it's raw hex string (64 chars = 32 bytes)
    if (trimmedKey.length === 64 && /^[0-9a-fA-F]+$/.test(trimmedKey)) {
      const privateKeyBytes = Uint8Array.from(Buffer.from(trimmedKey, 'hex'));
      if (privateKeyBytes.length !== 32) {
        throw new Error(`Invalid hex private key length: ${privateKeyBytes.length}, expected 32 bytes`);
      }
      return Ed25519Keypair.fromSecretKey(privateKeyBytes);
    }
    
    // Try base64
    try {
      const privateKeyBytes = Uint8Array.from(Buffer.from(trimmedKey, 'base64'));
      
      if (privateKeyBytes.length === 32) {
        return Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else if (privateKeyBytes.length === 64) {
        return Ed25519Keypair.fromSecretKey(privateKeyBytes.slice(0, 32));
      } else if (privateKeyBytes.length > 32) {
        return Ed25519Keypair.fromSecretKey(privateKeyBytes.slice(-32));
      } else {
        throw new Error(`Invalid base64 private key length: ${privateKeyBytes.length} bytes, expected 32 bytes`);
      }
    } catch (base64Error: any) {
      throw new Error(`Failed to parse private key. Tried bech32, hex, and base64 formats. Error: ${base64Error.message}`);
    }
  } catch (error: any) {
    if (error.message.includes('Invalid private key format') || error.message.includes('Failed to parse')) {
      throw error;
    }
    throw new Error(`Invalid private key format: ${error.message || error}`);
  }
}

async function testPrivateKeyParsing() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  console.log('🔐 Private Key Parser Test');
  console.log('==========================\n');

  try {
    // Get private key from environment or prompt
    let privateKey = process.env.OWNER_PRIVATE_KEY;
    
    if (!privateKey) {
      console.log('OWNER_PRIVATE_KEY not found in environment.');
      privateKey = await question('Enter private key to test (or press Enter to skip): ');
      
      if (!privateKey || privateKey.trim() === '') {
        console.log('Skipping test. Set OWNER_PRIVATE_KEY environment variable to test.');
        rl.close();
        return;
      }
    }

    console.log(`\nTesting private key (first 10 chars): ${privateKey.substring(0, 10)}...`);
    console.log(`Private key length: ${privateKey.length} characters`);
    console.log(`Private key type detection:`);
    
    if (privateKey.startsWith('suiprivkey1')) {
      console.log('  - Format: Bech32 (suiprivkey1...)');
    } else if (privateKey.startsWith('0x')) {
      console.log('  - Format: Hex with 0x prefix');
    } else if (privateKey.length === 64 && /^[0-9a-fA-F]+$/.test(privateKey)) {
      console.log('  - Format: Raw hex (64 chars)');
    } else {
      console.log('  - Format: Base64 (or unknown)');
    }

    console.log('\nParsing private key...');
    const keypair = parsePrivateKey(privateKey);
    
    const address = keypair.toSuiAddress();
    console.log(`✅ Successfully parsed private key!`);
    console.log(`   Address: ${address}`);
    console.log(`   Address length: ${address.length} characters`);
    
    // Verify it's a valid Sui address
    if (address.startsWith('0x') && address.length === 66) {
      console.log(`   ✅ Valid Sui address format`);
    } else {
      console.log(`   ⚠️  Unexpected address format`);
    }

    console.log('\n✅ All tests passed!');
  } catch (error: any) {
    console.error('\n❌ Test failed!');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run test
testPrivateKeyParsing().catch(console.error);

