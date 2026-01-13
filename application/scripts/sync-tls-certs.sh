#!/bin/bash

# =========================================
# Sync TLS Certificates from Blockchain Server
# =========================================
# Script ini hanya perlu dijalankan sekali saat setup awal
# atau jika ada perubahan pada TLS certificates (jarang terjadi)

# Configuration
BLOCKCHAIN_SERVER="${BLOCKCHAIN_SERVER:-206.189.82.125}"
BLOCKCHAIN_USER="${BLOCKCHAIN_USER:-root}"
BLOCKCHAIN_CRYPTO_PATH="${BLOCKCHAIN_CRYPTO_PATH:-/root/fabric-network/organizations}"

# Local paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
TLS_DIR="$APP_DIR/tls-certs"

echo "========================================="
echo "Sync TLS Certificates from Blockchain"
echo "========================================="
echo ""
echo "Configuration:"
echo "  Blockchain Server: $BLOCKCHAIN_SERVER"
echo "  Blockchain User: $BLOCKCHAIN_USER"
echo "  Remote Crypto Path: $BLOCKCHAIN_CRYPTO_PATH"
echo "  Local TLS Dir: $TLS_DIR"
echo ""

# Create local directories
mkdir -p "$TLS_DIR/orderer"
mkdir -p "$TLS_DIR/peers"
mkdir -p "$TLS_DIR/ca"

echo "📥 Syncing TLS certificates..."

# Sync Orderer TLS CA cert
echo "  - Orderer TLS CA..."
scp "$BLOCKCHAIN_USER@$BLOCKCHAIN_SERVER:$BLOCKCHAIN_CRYPTO_PATH/ordererOrganizations/jabarchain.me/orderers/chain-orderer.jabarchain.me/tls/ca.crt" \
    "$TLS_DIR/orderer/orderer-tls-ca.crt" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "    ✅ Orderer TLS CA synced"
else
    echo "    ❌ Failed to sync Orderer TLS CA"
fi

# Sync Peer TLS CA certs
echo "  - Peer pusat TLS CA..."
scp "$BLOCKCHAIN_USER@$BLOCKCHAIN_SERVER:$BLOCKCHAIN_CRYPTO_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/peers/pusat.chain-bpsbp.jabarchain.me/tls/ca.crt" \
    "$TLS_DIR/peers/pusat-tls-ca.crt" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "    ✅ Peer pusat TLS CA synced"
else
    echo "    ❌ Failed to sync Peer pusat TLS CA"
fi

echo "  - Peer cert TLS CA..."
scp "$BLOCKCHAIN_USER@$BLOCKCHAIN_SERVER:$BLOCKCHAIN_CRYPTO_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/peers/cert.chain-bpsbp.jabarchain.me/tls/ca.crt" \
    "$TLS_DIR/peers/cert-tls-ca.crt" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "    ✅ Peer cert TLS CA synced"
else
    echo "    ❌ Failed to sync Peer cert TLS CA"
fi

# Sync CA TLS cert (for enrollment)
echo "  - Fabric CA TLS cert..."
scp "$BLOCKCHAIN_USER@$BLOCKCHAIN_SERVER:$BLOCKCHAIN_CRYPTO_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/ca/ca-cert.pem" \
    "$TLS_DIR/ca/ca-bpsbp-tls.pem" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "    ✅ Fabric CA TLS synced"
else
    echo "    ❌ Failed to sync Fabric CA TLS"
fi

echo ""
echo "========================================="
echo "📋 TLS Certificates Status:"
echo "========================================="
ls -la "$TLS_DIR"/*/ 2>/dev/null

echo ""
echo "✅ Sync complete!"
echo ""
echo "Note: These TLS certificates rarely change."
echo "You only need to re-run this script if:"
echo "  1. TLS certificates are renewed/rotated"
echo "  2. New peers/orderers are added"
echo "  3. Setting up a new application server"
