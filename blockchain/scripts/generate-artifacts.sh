#!/bin/bash
#
# Script untuk generate genesis block dan channel artifacts
# Sistem Sertifikasi Benih Perkebunan - v2.4.7
#

set -e
source "$(dirname "$0")/../.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_message() {
    echo -e "${GREEN}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../network"

print_message "🔧 Generating channel artifacts for Hyperledger Fabric..."

cd "$NETWORK_DIR"

# Check if organizations exist
if [ ! -d "organizations/peerOrganizations/${BPSBP_DOMAIN}" ] || [ ! -d "organizations/peerOrganizations/${DISBUN_DOMAIN}" ] || [ ! -d "organizations/ordererOrganizations/${DOMAIN_SUFFIX}" ]; then
    print_error "❌ Organizations not found! Please run setup-ca-certificates.sh first"
    exit 1
fi

# Set environment variables
export FABRIC_CFG_PATH=$NETWORK_DIR
export CHANNEL_NAME=${CHANNEL_NAME}

# Clean previous artifacts
print_message "Cleaning previous artifacts..."
rm -rf system-genesis-block/*
rm -rf channel-artifacts/*

# Create directories
mkdir -p system-genesis-block
mkdir -p channel-artifacts

# Generate genesis block (orderer only untuk v2.4.7)
print_message "🏗️ Generating genesis block..."
configtxgen -profile BenihOrdererGenesis -channelID system-channel -outputBlock system-genesis-block/genesis.block

if [ $? -ne 0 ]; then
    print_error "❌ Failed to generate genesis block"
    exit 1
fi

print_message "✅ Genesis block generated: system-genesis-block/genesis.block"

# Generate channel creation transaction
print_message "🔗 Generating channel creation transaction..."
configtxgen -profile ${CHANNEL_ARTIFACTS} -outputCreateChannelTx channel-artifacts/${CHANNEL_ARTIFACTS}.tx -channelID $CHANNEL_NAME

if [ $? -ne 0 ]; then
    print_error "❌ Failed to generate channel creation transaction"
    exit 1
fi

print_message "✅ Channel creation transaction generated: channel-artifacts/${CHANNEL_ARTIFACTS}.tx"

# Generate anchor peer transactions
print_message "⚓ Generating anchor peer transactions..."

# BPSBP anchor peer
configtxgen -profile ${CHANNEL_ARTIFACTS} -outputAnchorPeersUpdate channel-artifacts/BPSBPBenihanchors.tx -channelID $CHANNEL_NAME -asOrg BPSBPBenih

if [ $? -ne 0 ]; then
    print_error "❌ Failed to generate BPSBP anchor peer transaction"
    exit 1
fi

print_message "✅ BPSBP anchor peer transaction generated"

# Disbun anchor peer
configtxgen -profile ${CHANNEL_ARTIFACTS} -outputAnchorPeersUpdate channel-artifacts/DisbunBenihanchors.tx -channelID $CHANNEL_NAME -asOrg DisbunBenih

if [ $? -ne 0 ]; then
    print_error "❌ Failed to generate Disbun anchor peer transaction"
    exit 1
fi

print_message "✅ Disbun anchor peer transaction generated"

print_message "📋 Channel artifacts summary:"
print_message "   - Genesis block: system-genesis-block/genesis.block"
print_message "   - Channel tx: channel-artifacts/${CHANNEL_ARTIFACTS}.tx"
print_message "   - BPSBP anchor: channel-artifacts/BPSBPBenihanchors.tx"
print_message "   - Disbun anchor: channel-artifacts/DisbunBenihanchors.tx"
print_message ""
print_message "✅ All channel artifacts generated successfully!"
print_message "Next step: Start the network with './network.sh up'"
