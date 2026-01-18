#!/bin/bash

# Sui Contract Deployment Script
# Usage: ./scripts/deploy-sui-contract.sh

set -e

echo "🚀 PharmaDNA Sui Contract Deployment"
echo "======================================"

cd sui-contract

# Check if Sui CLI is installed
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI not found. Please install it first."
    echo "   Visit: https://docs.sui.io/build/install"
    exit 1
fi

# Check if client is configured
if ! sui client active-address &> /dev/null; then
    echo "📝 Setting up Sui client..."
    echo "   Please follow the prompts to create a new address or connect to existing wallet"
    sui client new-address ed25519
fi

# Switch to testnet
echo "🌐 Switching to testnet..."
sui client switch --env testnet

# Get active address
ACTIVE_ADDRESS=$(sui client active-address)
echo "✅ Active address: $ACTIVE_ADDRESS"

# Check balance
echo "💰 Checking SUI balance..."
BALANCE=$(sui client gas | grep -oP '\d+\.\d+' | head -1 || echo "0")
echo "   Balance: $BALANCE SUI"

if (( $(echo "$BALANCE < 0.1" | bc -l) )); then
    echo "⚠️  Low balance detected. Requesting from faucet..."
    echo "   Please visit: https://faucet.testnet.sui.io/"
    echo "   Or run: curl -X POST \"https://faucet.testnet.sui.io/gas\" -H \"Content-Type: application/json\" -d '{\"FixedAmountRequest\":{\"recipient\":\"$ACTIVE_ADDRESS\"}}'"
    read -p "Press Enter after requesting from faucet..."
fi

# Build contract
echo "🔨 Building contract..."
sui move build

# Deploy contract
echo "📦 Deploying contract..."
echo "   This may take a few minutes..."
DEPLOY_OUTPUT=$(sui client publish --gas-budget 100000000)

# Extract Package ID
PACKAGE_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'PackageID: \K0x[a-fA-F0-9]+' | head -1)
PUBLISHED_OBJECT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'PublishedAt: \K0x[a-fA-F0-9]+' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    echo "❌ Failed to extract Package ID from deployment output"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo "================================"
echo "Package ID: $PACKAGE_ID"
echo "Published Object ID: $PUBLISHED_OBJECT_ID"
echo ""
echo "📝 Please add these to your .env file:"
echo "   SUI_PACKAGE_ID=$PACKAGE_ID"
echo "   SUI_CONTRACT_OBJECT_ID=$PUBLISHED_OBJECT_ID"
echo ""
echo "🎉 Contract deployed successfully!"

