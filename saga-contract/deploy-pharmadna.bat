@echo off
REM Script để deploy PharmaNFT contract lên PharmaDNA chainlet
echo 🚀 Deploying PharmaNFT contract to PharmaDNA chainlet...

REM Kiểm tra xem đã compile chưa
if not exist "artifacts" (
    echo 📦 Compiling contracts...
    npx hardhat compile
)

REM Deploy contract
echo 🔨 Deploying contract...
npx hardhat run scripts/deployPharmaNFT.ts --network pharmadna

echo ✅ Deployment completed!
echo.
echo 📋 Next steps:
echo 1. Copy the deployed contract address
echo 2. Update PHARMA_NFT_ADDRESS in your .env file
echo 3. Restart your Next.js application
echo.
echo 🌐 PharmaDNA Chainlet Details:
echo Chain ID: 2759821881746000 (0x9ce0b1ae7a250)
echo RPC: https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io
echo Explorer: https://pharmadna-2759821881746000-1.sagaexplorer.io
pause
