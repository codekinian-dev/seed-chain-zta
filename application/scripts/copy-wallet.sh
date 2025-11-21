#!/bin/bash

# Script to copy appUser wallet from blockchain network to application

set -e

echo "========================================="
echo "Copying Wallet from Blockchain Network"
echo "========================================="

# Paths
BLOCKCHAIN_DIR="../blockchain/network/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/users/appUser@chain-bpsbp.jabarchain.me/msp"
WALLET_DIR="./wallet/appUser"

# Check if blockchain wallet exists
if [ ! -d "$BLOCKCHAIN_DIR" ]; then
    echo "❌ Error: Blockchain wallet not found at $BLOCKCHAIN_DIR"
    echo "Please ensure the blockchain network is set up and appUser is created."
    exit 1
fi

# Create wallet directory
echo "📁 Creating wallet directory..."
mkdir -p "$WALLET_DIR"

# Copy signcerts
echo "📋 Copying signing certificate..."
mkdir -p "$WALLET_DIR/signcerts"
cp "$BLOCKCHAIN_DIR/signcerts/"*.pem "$WALLET_DIR/signcerts/cert.pem"

# Copy keystore
echo "🔑 Copying private key..."
mkdir -p "$WALLET_DIR/keystore"
cp "$BLOCKCHAIN_DIR/keystore/"*_sk "$WALLET_DIR/keystore/"

# Copy CA cert
echo "🏛️  Copying CA certificate..."
CA_CERT_PATH="../blockchain/network/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/msp/cacerts/ca.crt"
if [ -f "$CA_CERT_PATH" ]; then
    cp "$CA_CERT_PATH" "$WALLET_DIR/ca.crt"
else
    echo "❌ Error: CA certificate not found at $CA_CERT_PATH"
    exit 1
fi

# Set permissions
chmod 600 "$WALLET_DIR/keystore/"*
chmod 644 "$WALLET_DIR/signcerts/cert.pem"
chmod 644 "$WALLET_DIR/ca.crt"

echo ""
echo "✅ Wallet copied successfully!"
echo "📍 Location: $WALLET_DIR"
echo ""
echo "Contents:"
ls -lh "$WALLET_DIR"
ls -lh "$WALLET_DIR/signcerts"
ls -lh "$WALLET_DIR/keystore"
echo ""
echo "========================================="
