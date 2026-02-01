# Simple Sui Contract Deployment Script
# Usage: .\scripts\deploy-contract.ps1

Write-Host "🚀 Deploying PharmaDNA Smart Contract" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Sui CLI is installed
try {
    $version = sui --version 2>&1
    Write-Host "✅ Sui CLI: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Sui CLI not found!" -ForegroundColor Red
    Write-Host "   Install from: https://docs.sui.io/build/install" -ForegroundColor Yellow
    exit 1
}

# Navigate to contract directory
Set-Location sui-contract

# Switch to testnet
Write-Host "🌐 Switching to testnet..." -ForegroundColor Yellow
sui client switch --env testnet 2>$null

# Get active address
$ACTIVE_ADDRESS = sui client active-address 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No active address found. Please configure Sui client first." -ForegroundColor Red
    Write-Host "   Run: sui client new-address ed25519" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Active address: $ACTIVE_ADDRESS" -ForegroundColor Green

# Check balance
Write-Host "💰 Checking balance..." -ForegroundColor Yellow
$balance = sui client gas 2>&1
Write-Host $balance

# Build contract
Write-Host ""
Write-Host "🔨 Building contract..." -ForegroundColor Yellow
sui move build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Build successful!" -ForegroundColor Green

# Deploy contract
Write-Host ""
Write-Host "📦 Deploying contract..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray
$DEPLOY_OUTPUT = sui client publish --gas-budget 100000000 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host $DEPLOY_OUTPUT
    Set-Location ..
    exit 1
}

# Extract Package ID and Contract Object ID
Write-Host ""
Write-Host "📋 Extracting deployment info..." -ForegroundColor Yellow

$PACKAGE_ID = $null
$CONTRACT_OBJECT_ID = $null

# Try to find Package ID
$packageMatch = $DEPLOY_OUTPUT | Select-String -Pattern 'PackageID:\s*(0x[a-fA-F0-9]{64})'
if ($packageMatch) {
    $PACKAGE_ID = $packageMatch.Matches.Groups[1].Value
}

# Try to find Published Object ID (Contract Object ID)
$objectMatch = $DEPLOY_OUTPUT | Select-String -Pattern 'Published Objects:\s*(0x[a-fA-F0-9]{64})'
if ($objectMatch) {
    $CONTRACT_OBJECT_ID = $objectMatch.Matches.Groups[1].Value
}

# Fallback: find all 0x addresses
if (-not $PACKAGE_ID -or -not $CONTRACT_OBJECT_ID) {
    $allMatches = [regex]::Matches($DEPLOY_OUTPUT, '0x[a-fA-F0-9]{64}')
    if ($allMatches.Count -gt 0) {
        if (-not $PACKAGE_ID) {
            $PACKAGE_ID = $allMatches[0].Value
        }
        if (-not $CONTRACT_OBJECT_ID -and $allMatches.Count -gt 1) {
            $CONTRACT_OBJECT_ID = $allMatches[1].Value
        }
    }
}

if (-not $PACKAGE_ID) {
    Write-Host "⚠️  Could not extract Package ID automatically" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📄 Full deployment output:" -ForegroundColor Cyan
    Write-Host $DEPLOY_OUTPUT
    Write-Host ""
    Write-Host "Please manually extract Package ID and Contract Object ID from above" -ForegroundColor Yellow
    Set-Location ..
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment Successful!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Package ID: $PACKAGE_ID" -ForegroundColor Green
if ($CONTRACT_OBJECT_ID) {
    Write-Host "Contract Object ID: $CONTRACT_OBJECT_ID" -ForegroundColor Green
} else {
    Write-Host "⚠️  Contract Object ID: Please extract from output above" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "✅ Deployer ($ACTIVE_ADDRESS) automatically has ADMIN role" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Add these to your .env file:" -ForegroundColor Yellow
Write-Host "   SUI_PACKAGE_ID=$PACKAGE_ID" -ForegroundColor White
if ($CONTRACT_OBJECT_ID) {
    Write-Host "   SUI_CONTRACT_OBJECT_ID=$CONTRACT_OBJECT_ID" -ForegroundColor White
} else {
    Write-Host "   SUI_CONTRACT_OBJECT_ID=<extract from output>" -ForegroundColor White
}
Write-Host "   OWNER_PRIVATE_KEY=<your private key>" -ForegroundColor White
Write-Host ""
Write-Host "💡 Note: The deployer address automatically gets ADMIN role." -ForegroundColor Cyan
Write-Host "   If OWNER_PRIVATE_KEY is different, assign ADMIN role using:" -ForegroundColor Cyan
Write-Host "   npx tsx scripts/verify-and-assign-admin.ts" -ForegroundColor White
Write-Host ""
Write-Host "🔗 View on Explorer:" -ForegroundColor Cyan
Write-Host "   https://suiexplorer.com/object/$PACKAGE_ID?network=testnet" -ForegroundColor White

Set-Location ..

