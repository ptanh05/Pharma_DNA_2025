#!/bin/bash

# ============================================
# PHARMA DNA - SMART CONTRACT DEPLOYMENT
# Deploy Move contract lên Sui blockchain
# ============================================

set -e

echo "🚀 PHARMA DNA Smart Contract Deployment"
echo "========================================"
echo ""

# ===== KIỂM TRA ĐIỀU KIỆN =====
echo "📋 Checking prerequisites..."

# Kiểm tra Sui CLI
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI not found. Please install: https://docs.sui.io/guides/developer/getting-started/sui-install"
    exit 1
fi

# Kiểm tra Move compiler
if ! command -v move &> /dev/null; then
    echo "⚠️ Move compiler not in PATH, trying to use 'sui move'..."
fi

echo "✅ Sui CLI found: $(sui --version)"
echo ""

# ===== SETUP VARIABLES =====
NETWORK="${1:-testnet}"
PROJECT_DIR="./sui-contract"
BUILD_DIR="$PROJECT_DIR/build"
MANIFEST="$PROJECT_DIR/Move.toml"

echo "📦 Deployment Configuration:"
echo "   Network: $NETWORK"
echo "   Project: $PROJECT_DIR"
echo ""

# ===== BUILD CONTRACT =====
echo "🔨 Building Smart Contract..."
cd "$PROJECT_DIR"

# Clean previous builds
rm -rf "$BUILD_DIR"

# Build Move package
sui move build --network "$NETWORK" 2>&1 | tee build.log

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Build failed! Check build.log"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# ===== DEPLOY CONTRACT =====
echo "🚀 Deploying Contract to $NETWORK..."

# Get package info từ build output
PACKAGE_ID=$(grep -oP '│ Package ID: \K[a-zA-Z0-9x]+' build.log | head -1)

if [ -z "$PACKAGE_ID" ]; then
    echo "❌ Could not extract Package ID from build output"
    echo "   Deploying using: sui move publish"
    
    # Deploy và capture output
    DEPLOY_OUTPUT=$(sui move publish --network "$NETWORK" --gas-budget 100000 2>&1)
    echo "$DEPLOY_OUTPUT"
    
    # Extract Package ID từ publish output
    PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP '│ Package ID: \K[a-zA-Z0-9x]+' | head -1)
    
    if [ -z "$PACKAGE_ID" ]; then
        echo "❌ Deployment failed!"
        exit 1
    fi
fi

echo ""
echo "✅ Contract Deployed Successfully!"
echo ""

# ===== DISPLAY RESULTS =====
echo "📊 DEPLOYMENT RESULTS:"
echo "======================================"
echo "Network:      $NETWORK"
echo "Package ID:   $PACKAGE_ID"
echo "Build Log:    $PROJECT_DIR/build.log"
echo "======================================"
echo ""

# ===== SAVE TO .env =====
echo "💾 Saving deployment info to .env..."

ENV_FILE=".env.local"

# Backup existing .env.local
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "$ENV_FILE.backup"
    echo "   Backup: $ENV_FILE.backup"
fi

# Update .env with new PACKAGE_ID
if grep -q "NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID" "$ENV_FILE" 2>/dev/null; then
    # Update existing
    sed -i.bak "s/NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID=.*/NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID=$PACKAGE_ID/" "$ENV_FILE"
else
    # Add new
    echo "" >> "$ENV_FILE"
    echo "# Smart Contract Deployment" >> "$ENV_FILE"
    echo "NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID=$PACKAGE_ID" >> "$ENV_FILE"
fi

echo "✅ .env.local updated"
echo ""

# ===== DISPLAY .env VARIABLES =====
echo "🔑 Environment Variables to Add:"
echo "======================================"
echo "NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID=$PACKAGE_ID"
echo "NEXT_PUBLIC_SUI_NETWORK=$NETWORK"
echo ""
echo "Add these to your .env.local file"
echo "======================================"
echo ""

# ===== NEXT STEPS =====
echo "📝 Next Steps:"
echo ""
echo "1. Verify deployment on Sui Explorer:"
if [ "$NETWORK" = "testnet" ]; then
    echo "   https://suiscan.xyz/testnet/package/$PACKAGE_ID"
elif [ "$NETWORK" = "mainnet" ]; then
    echo "   https://suiscan.xyz/mainnet/package/$PACKAGE_ID"
fi
echo ""
echo "2. Update your application code:"
echo "   - PHARMA_NFT_PACKAGE_ID: $PACKAGE_ID"
echo "   - SUI_NETWORK: $NETWORK"
echo ""
echo "3. Run tests:"
echo "   npm test"
echo ""
echo "4. Deploy frontend:"
echo "   npm run build && npm run deploy"
echo ""

echo "🎉 Deployment Complete!"
