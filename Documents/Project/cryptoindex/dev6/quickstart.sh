#!/bin/bash

# Hyperliquid Index Platform - Quick Start Guide
# ================================================

echo "======================================"
echo "🚀 Hyperliquid Index Platform Setup"
echo "======================================"
echo ""

# Check Node version
echo "📋 Checking Node.js version..."
node_version=$(node -v)
echo "Node version: $node_version"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Compile contracts
echo ""
echo "🔨 Compiling smart contracts..."
npx hardhat compile

# Run tests
echo ""
echo "🧪 Running tests..."
npx hardhat test

# Generate ABIs
echo ""
echo "📋 Extracting ABIs..."
node scripts/extract-abis.js

# Start local node (in background)
echo ""
echo "🌐 Starting local Hardhat node..."
npx hardhat node &
NODE_PID=$!

# Wait for node to start
sleep 5

# Deploy to local network
echo ""
echo "📦 Deploying to local network..."
npx hardhat run scripts/deploy-complete.js --network localhost

# Show deployment info
echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "📝 Next Steps:"
echo "1. Local node is running (PID: $NODE_PID)"
echo "2. Contracts are deployed to localhost"
echo "3. Check deployments/ folder for contract addresses"
echo "4. Import test accounts to MetaMask:"
echo "   - Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "   - Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo ""
echo "To stop the local node: kill $NODE_PID"
echo ""
echo "======================================"
echo "📚 Documentation"
echo "======================================"
echo "- README: README-PLATFORM.md"
echo "- Security Report: SECURITY_REVIEW_REPORT.md"
echo "- Final Checklist: FINAL_CHECKLIST.md"
echo "- Work Report: WORK_COMPLETION_REPORT.md"
echo ""
echo "======================================"
echo "🌟 Ready for Development!"
echo "======================================"
