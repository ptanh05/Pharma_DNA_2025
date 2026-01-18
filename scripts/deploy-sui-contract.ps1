# Sui Contract Deployment Script for Windows PowerShell
# Usage: .\scripts\deploy-sui-contract.ps1

Write-Host "🚀 PharmaDNA Sui Contract Deployment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Set-Location sui-contract

# Check if Sui CLI is installed
try {
    $null = sui --version
} catch {
    Write-Host "❌ Sui CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "   Visit: https://docs.sui.io/build/install" -ForegroundColor Yellow
    exit 1
}

# Check if client is configured
try {
    $null = sui client active-address 2>$null
} catch {
    Write-Host "📝 Setting up Sui client..." -ForegroundColor Yellow
    Write-Host "   Please follow the prompts to create a new address" -ForegroundColor Yellow
    sui client new-address ed25519
}

# Switch to testnet
Write-Host "🌐 Switching to testnet..." -ForegroundColor Yellow
sui client switch --env testnet

# Get active address
$ACTIVE_ADDRESS = sui client active-address 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to get active address" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Active address: $ACTIVE_ADDRESS" -ForegroundColor Green

# Build contract
Write-Host "🔨 Building contract..." -ForegroundColor Yellow
sui move build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Deploy contract
Write-Host "📦 Deploying contract..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Yellow
$DEPLOY_OUTPUT = sui client publish --gas-budget 100000000

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    Write-Host $DEPLOY_OUTPUT
    exit 1
}

# Extract Package ID (simple regex)
$PACKAGE_ID = ($DEPLOY_OUTPUT | Select-String -Pattern 'PackageID:\s*(0x[a-fA-F0-9]+)').Matches.Groups[1].Value
$PUBLISHED_OBJECT_ID = ($DEPLOY_OUTPUT | Select-String -Pattern 'PublishedAt:\s*(0x[a-fA-F0-9]+)').Matches.Groups[1].Value

if (-not $PACKAGE_ID) {
    Write-Host "⚠️  Could not extract Package ID automatically" -ForegroundColor Yellow
    Write-Host "   Please check the output above and manually extract:" -ForegroundColor Yellow
    Write-Host $DEPLOY_OUTPUT
    Write-Host ""
    Write-Host "   Look for 'PackageID: 0x...' and 'PublishedAt: 0x...'" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "Package ID: $PACKAGE_ID" -ForegroundColor Green
    Write-Host "Published Object ID: $PUBLISHED_OBJECT_ID" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Please add these to your .env file:" -ForegroundColor Yellow
    Write-Host "   SUI_PACKAGE_ID=$PACKAGE_ID" -ForegroundColor White
    Write-Host "   SUI_CONTRACT_OBJECT_ID=$PUBLISHED_OBJECT_ID" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Contract deployed successfully!" -ForegroundColor Green
}

Set-Location ..

