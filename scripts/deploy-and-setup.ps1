# Sui Contract Deployment and Setup Script
# This script deploys the contract and ensures ADMIN role is properly set
# Usage: .\scripts\deploy-and-setup.ps1

param(
    [string]$OwnerAddress = "",
    [string]$OwnerPrivateKey = ""
)

Write-Host "🚀 PharmaDNA Sui Contract Deployment & Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location sui-contract

# Check if Sui CLI is installed
try {
    $null = sui --version
    Write-Host "✅ Sui CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Sui CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "   Visit: https://docs.sui.io/build/install" -ForegroundColor Yellow
    exit 1
}

# Switch to testnet
Write-Host "🌐 Switching to testnet..." -ForegroundColor Yellow
sui client switch --env testnet 2>$null

# Get active address (deployer)
$DEPLOYER_ADDRESS = sui client active-address 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to get active address. Please configure Sui client first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Deployer address: $DEPLOYER_ADDRESS" -ForegroundColor Green

# Check gas balance
Write-Host "💰 Checking gas balance..." -ForegroundColor Yellow
$gasInfo = sui client gas 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Gas info:" -ForegroundColor White
    Write-Host $gasInfo
} else {
    Write-Host "⚠️  Could not check gas balance" -ForegroundColor Yellow
    Write-Host "   Make sure you have SUI in your wallet for gas fees" -ForegroundColor Yellow
    Write-Host "   Testnet faucet: https://faucet.testnet.sui.io/" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🔨 Building contract..." -ForegroundColor Yellow
sui move build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green

# Deploy contract
Write-Host ""
Write-Host "📦 Deploying contract..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Yellow
$DEPLOY_OUTPUT = sui client publish --gas-budget 100000000 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    Write-Host $DEPLOY_OUTPUT
    exit 1
}

# Extract Package ID and Published Object ID
Write-Host ""
Write-Host "📋 Extracting deployment information..." -ForegroundColor Yellow

$PACKAGE_ID = $null
$PUBLISHED_OBJECT_ID = $null

# Pattern 1: "PackageID: 0x..."
$match = $DEPLOY_OUTPUT | Select-String -Pattern 'PackageID:\s*(0x[a-fA-F0-9]+)'
if ($match) {
    $PACKAGE_ID = $match.Matches.Groups[1].Value
}

# Pattern 2: Look for object IDs
$matches = [regex]::Matches($DEPLOY_OUTPUT, '0x[a-fA-F0-9]{64}')
if ($matches.Count -gt 0) {
    if (-not $PACKAGE_ID) {
        $PACKAGE_ID = $matches[0].Value
    }
    if ($matches.Count -gt 1) {
        $PUBLISHED_OBJECT_ID = $matches[1].Value
    }
}

if (-not $PACKAGE_ID) {
    Write-Host "❌ Could not extract Package ID" -ForegroundColor Red
    Write-Host $DEPLOY_OUTPUT
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Package ID: $PACKAGE_ID" -ForegroundColor Green
if ($PUBLISHED_OBJECT_ID) {
    Write-Host "Contract Object ID: $PUBLISHED_OBJECT_ID" -ForegroundColor Green
} else {
    Write-Host "⚠️  Contract Object ID not found. Please extract manually from output above." -ForegroundColor Yellow
}

# Note: The deployer automatically gets ADMIN role in the init function
Write-Host ""
Write-Host "✅ Deployer ($DEPLOYER_ADDRESS) automatically has ADMIN role" -ForegroundColor Green

# If OWNER_PRIVATE_KEY address is provided and different from deployer, assign ADMIN role
if ($OwnerAddress -and $OwnerAddress -ne $DEPLOYER_ADDRESS -and $OwnerPrivateKey) {
    Write-Host ""
    Write-Host "🔑 Assigning ADMIN role to OWNER_PRIVATE_KEY address..." -ForegroundColor Yellow
    Write-Host "   This requires the deployer to have ADMIN role (which it does)" -ForegroundColor White
    
    # Create a TypeScript/Node script to assign the role
    $assignScript = @"
import { assignRole } from '../lib/blockchain/contract-sui';
import { Role } from '../lib/blockchain/types-sui';

async function assignAdminRole() {
  try {
    const result = await assignRole('$OwnerAddress', Role.ADMIN, '$OwnerPrivateKey');
    if (result.success) {
      console.log('✅ ADMIN role assigned successfully!');
      console.log('Transaction:', result.digest);
    } else {
      console.error('❌ Failed to assign ADMIN role:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignAdminRole();
"@
    
    $assignScript | Out-File -FilePath "temp-assign-admin.ts" -Encoding UTF8
    
    Write-Host "   Run this command to assign ADMIN role:" -ForegroundColor White
    Write-Host "   npx tsx temp-assign-admin.ts" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Or manually call the contract function:" -ForegroundColor White
    Write-Host "   sui client call --package $PACKAGE_ID --module pharma_nft --function assign_role_by_admin --args $PUBLISHED_OBJECT_ID $OwnerAddress 4 --gas-budget 10000000" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "📝 Add these to your .env file:" -ForegroundColor Yellow
Write-Host "   SUI_PACKAGE_ID=$PACKAGE_ID" -ForegroundColor White
if ($PUBLISHED_OBJECT_ID) {
    Write-Host "   SUI_CONTRACT_OBJECT_ID=$PUBLISHED_OBJECT_ID" -ForegroundColor White
} else {
    Write-Host "   SUI_CONTRACT_OBJECT_ID=<extract from output above>" -ForegroundColor White
}
Write-Host "   OWNER_PRIVATE_KEY=<your private key>" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Contract deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 View on Sui Explorer:" -ForegroundColor Cyan
Write-Host "   https://suiexplorer.com/object/$PACKAGE_ID?network=testnet" -ForegroundColor White

Set-Location ..

