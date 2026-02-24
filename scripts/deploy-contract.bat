@echo off
REM ============================================
REM PHARMA DNA - SMART CONTRACT DEPLOYMENT
REM Windows Batch Script
REM ============================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo 🚀 PHARMA DNA Smart Contract Deployment
echo ========================================
echo.

REM ===== CHECK REQUIREMENTS =====
echo 📋 Checking requirements...

REM Check Sui CLI
sui --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Sui CLI not found. Please install from: https://docs.sui.io
    echo    Run: choco install sui
    exit /b 1
)

echo ✅ Sui CLI found
echo.

REM ===== BUILD CONTRACT =====
echo 🔨 Building Smart Contract...
cd sui-contract

REM Clean
if exist build (
    rmdir /s /q build
)

REM Build
sui move build
if errorlevel 1 (
    echo ❌ Build failed!
    cd ..
    exit /b 1
)

echo ✅ Build successful!
echo.

REM ===== DEPLOY CONTRACT =====
echo 🚀 Deploying Contract to testnet...

REM Deploy
sui move publish --gas-budget 100000 > deploy_output.txt 2>&1

REM Check result
if errorlevel 1 (
    echo ❌ Deployment failed!
    type deploy_output.txt
    cd ..
    exit /b 1
)

echo ✅ Deployment successful!
echo.

REM ===== EXTRACT PACKAGE ID =====
echo 📊 Extracting deployment info...

setlocal enabledelayedexpansion
for /f "delims=" %%i in (deploy_output.txt) do (
    set "line=%%i"
    if "!line:Package ID=!" neq "!line!" (
        for /f "tokens=3" %%j in ("!line!") do (
            set PACKAGE_ID=%%j
        )
    )
)

if "!PACKAGE_ID!"=="" (
    echo ⚠️ Could not extract Package ID
    echo Please check deploy_output.txt
) else (
    echo ✅ Package ID: !PACKAGE_ID!
)

echo.

REM ===== SAVE TO .env.local =====
echo 💾 Saving to .env.local...

set ENV_FILE=..\\.env.local

REM Create backup
if exist "!ENV_FILE!" (
    copy "!ENV_FILE!" "!ENV_FILE!.backup" >nul
    echo    Backup: !ENV_FILE!.backup
)

REM Create/Update .env.local
if exist "!ENV_FILE!" (
    REM Update existing (simple method - doesn't handle all cases)
    echo Existing .env.local found. Please manually add:
) else (
    REM Create new
    (
        echo # PHARMA DNA - ENVIRONMENT CONFIGURATION
        echo # Generated: %date% %time%
        echo.
        echo # Smart Contract
        if "!PACKAGE_ID!" neq "" (
            echo NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID=!PACKAGE_ID!
        ) else (
            echo NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID=0x...
        )
        echo NEXT_PUBLIC_SUI_NETWORK=testnet
        echo SUI_NETWORK=testnet
        echo SUI_RPC_URL=https://rpc.testnet.sui.io
        echo.
        echo # Blockchain
        echo OWNER_ADDRESS=0x...
        echo OWNER_PRIVATE_KEY=0x...
        echo.
        echo # Database
        echo DATABASE_URL=postgresql://user:password@localhost:5432/pharma_dna
        echo.
        echo # Authentication
        echo JWT_SECRET=your_32_character_secret_key_here
        echo.
        echo # API
        echo NEXT_PUBLIC_API_URL=http://localhost:3000
        echo FRONTEND_URL=http://localhost:3000
    ) > "!ENV_FILE!"
)

echo ✅ .env.local ready
echo.

REM ===== DISPLAY RESULTS =====
echo 📊 DEPLOYMENT RESULTS
echo ======================================
echo.
if "!PACKAGE_ID!" neq "" (
    echo ✅ Package ID: !PACKAGE_ID!
) else (
    echo ⚠️  Package ID: Check deploy_output.txt
)
echo ✅ Network: testnet
echo ✅ Status: Deployed
echo.
echo 📄 Files:
echo    - Deploy log: deploy_output.txt
echo    - .env.local: !ENV_FILE!
echo.

REM ===== NEXT STEPS =====
echo 📝 Next Steps:
echo.
echo 1. Update .env.local with:
echo    - OWNER_ADDRESS: Your wallet address
echo    - OWNER_PRIVATE_KEY: Your private key
echo    - NEXT_PUBLIC_PHARMA_NFT_PACKAGE_ID: !PACKAGE_ID!
echo.
echo 2. Start server:
echo    npm run dev
echo.
echo 3. Test API:
echo    npm test
echo.
echo 4. Deploy frontend:
echo    npm run build ^&^& npm run deploy
echo.

echo 🎉 Deployment Complete!
echo.

cd ..

pause
