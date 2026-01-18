# Sui Contract Deployment Script with Specific Address
# Usage: .\scripts\deploy-with-address.ps1
# Or: .\scripts\deploy-with-address.ps1 -Address "0x..."

param(
    [string]$Address = "0x174a43ffabe53872a9f1a41be51033026aad4d1d4ab4f5f4de8b4ce6d62f1516"
)

Write-Host "🚀 PharmaDNA Sui Contract Deployment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Target Address: $Address" -ForegroundColor Yellow
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

# Initialize Sui client if not configured
Write-Host "📝 Checking Sui client configuration..." -ForegroundColor Yellow
try {
    $null = sui client active-address 2>$null
    Write-Host "✅ Sui client is configured" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Sui client not configured. Initializing..." -ForegroundColor Yellow
    Write-Host "   Creating a new address for deployment..." -ForegroundColor Yellow
    # Create a new address to initialize the client
    sui client new-address ed25519 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to initialize Sui client" -ForegroundColor Red
        exit 1
    }
}

# Switch to testnet
Write-Host "🌐 Switching to testnet..." -ForegroundColor Yellow
sui client switch --env testnet 2>$null

# Try to set the provided address as active
Write-Host "🔑 Setting active address..." -ForegroundColor Yellow
try {
    # List all addresses
    $addresses = sui client addresses
    if ($addresses -match $Address) {
        # Address exists, set it as active
        sui client switch --address $Address 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Set active address to: $Address" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Could not set address as active. Using current active address." -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Address $Address not found in keystore." -ForegroundColor Yellow
        Write-Host "   To use this address, you need to:" -ForegroundColor Yellow
        Write-Host "   1. Import the private key: sui client import --key-scheme ed25519" -ForegroundColor White
        Write-Host "   2. Or use: sui client switch --address $Address" -ForegroundColor White
        Write-Host ""
        Write-Host "   For now, using current active address..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not check addresses. Using current active address." -ForegroundColor Yellow
}

# Get active address
$ACTIVE_ADDRESS = sui client active-address 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to get active address" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Active address: $ACTIVE_ADDRESS" -ForegroundColor Green

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
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Check if you have enough SUI for gas fees" -ForegroundColor White
    Write-Host "   - Verify your address has the correct permissions" -ForegroundColor White
    exit 1
}

# Extract Package ID and Published Object ID
Write-Host ""
Write-Host "📋 Extracting deployment information..." -ForegroundColor Yellow

# Try multiple patterns to extract Package ID
$PACKAGE_ID = $null
$PUBLISHED_OBJECT_ID = $null

# Pattern 1: "PackageID: 0x..."
$match = $DEPLOY_OUTPUT | Select-String -Pattern 'PackageID:\s*(0x[a-fA-F0-9]+)'
if ($match) {
    $PACKAGE_ID = $match.Matches.Groups[1].Value
}

# Pattern 2: "Published Objects:" followed by object ID
$match = $DEPLOY_OUTPUT | Select-String -Pattern 'Published Objects:\s*(0x[a-fA-F0-9]+)'
if ($match) {
    $PUBLISHED_OBJECT_ID = $match.Matches.Groups[1].Value
}

# Pattern 3: Look for "0x" followed by 64 hex characters
if (-not $PACKAGE_ID) {
    $matches = [regex]::Matches($DEPLOY_OUTPUT, '0x[a-fA-F0-9]{64}')
    if ($matches.Count -gt 0) {
        $PACKAGE_ID = $matches[0].Value
        if ($matches.Count -gt 1) {
            $PUBLISHED_OBJECT_ID = $matches[1].Value
        }
    }
}

if (-not $PACKAGE_ID) {
    Write-Host "⚠️  Could not extract Package ID automatically" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📄 Full deployment output:" -ForegroundColor Cyan
    Write-Host $DEPLOY_OUTPUT
    Write-Host ""
    Write-Host "📝 Please manually extract:" -ForegroundColor Yellow
    Write-Host "   - Package ID: Look for 'PackageID: 0x...' or the first 0x address" -ForegroundColor White
    Write-Host "   - Published Object ID: Look for 'Published Objects:' or object ID" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "Package ID: $PACKAGE_ID" -ForegroundColor Green
    if ($PUBLISHED_OBJECT_ID) {
        Write-Host "Published Object ID: $PUBLISHED_OBJECT_ID" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "📝 Add these to your .env file:" -ForegroundColor Yellow
    Write-Host "   SUI_PACKAGE_ID=$PACKAGE_ID" -ForegroundColor White
    if ($PUBLISHED_OBJECT_ID) {
        Write-Host "   SUI_CONTRACT_OBJECT_ID=$PUBLISHED_OBJECT_ID" -ForegroundColor White
    } else {
        Write-Host "   SUI_CONTRACT_OBJECT_ID=<extract from output above>" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "🎉 Contract deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 View on Sui Explorer:" -ForegroundColor Cyan
    Write-Host "   https://suiexplorer.com/object/$PACKAGE_ID?network=testnet" -ForegroundColor White
}

Set-Location ..

