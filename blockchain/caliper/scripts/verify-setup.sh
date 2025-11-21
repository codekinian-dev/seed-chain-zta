#!/bin/bash
#
# Quick test script untuk verify Caliper setup
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "CALIPER QUICK TEST"
echo "========================================"

echo ""
echo "1. Checking Node.js version..."
node --version

echo ""
echo "2. Checking npm packages..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    npm run bind
else
    echo "✓ Dependencies already installed"
fi

echo ""
echo "3. Checking Fabric network..."
if ! docker ps | grep -q "peer0.chain-bpsbp"; then
    echo "✗ Fabric network is not running!"
    echo "Please start the network first: cd ../scripts && ./network.sh up"
    exit 1
else
    echo "✓ Fabric network is running"
fi

echo ""
echo "4. Checking chaincode deployment..."
cd ..
if ./scripts/deploy-chaincode.sh query-committed 2>&1 | grep -q "benih-certification"; then
    echo "✓ Chaincode is deployed"
else
    echo "✗ Chaincode is not deployed!"
    echo "Please deploy chaincode first: ./scripts/deploy-chaincode.sh deploy"
    exit 1
fi

cd caliper

echo ""
echo "5. Checking test identities..."
if [ -d "../network/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/users/User1@chain-bpsbp.jabarchain.me" ]; then
    echo "✓ Test identities exist"
else
    echo "⚠ Test identities not found"
    echo "Running setup script..."
    ./scripts/setup-identities.sh
fi

echo ""
echo "========================================"
echo "✓ Caliper setup verification complete!"
echo "========================================"
echo ""
echo "Ready to run tests:"
echo "  npm run test:create     - Test createSeedBatch"
echo "  npm run test:query      - Test query operations"
echo "  npm run test:workflow   - Test full workflow"
echo "  npm run test:all        - Run all tests"
echo ""
