#!/bin/bash

# =========================================
# Setup TLS Public Directory
# =========================================
# Jalankan sekali di blockchain server untuk
# membuat folder public berisi TLS certificates
#
# Cara pakai:
#   ./setup-tls-public.sh                    # Auto-detect dari lokasi script
#   BLOCKCHAIN_PATH=/root/tesis ./setup-tls-public.sh  # Manual set path
#
# Struktur yang dibuat:
#   <BLOCKCHAIN_PATH>/network/tls-public/
#   ├── orderer/
#   │   └── orderer-tls-ca.crt
#   ├── peers/
#   │   ├── pusat-tls-ca.crt
#   │   └── cert-tls-ca.crt
#   ├── ca/
#   │   └── ca-bpsbp-tls.pem
#   └── bundle.tar.gz
# =========================================

# Auto-detect path dari lokasi script ini
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Script berada di blockchain/scripts/, jadi parent adalah blockchain/
AUTO_DETECTED_PATH="$(dirname "$SCRIPT_DIR")"

# Configuration - gunakan env var atau auto-detect
BLOCKCHAIN_PATH="${BLOCKCHAIN_PATH:-$AUTO_DETECTED_PATH}"
ORGANIZATIONS_PATH="$BLOCKCHAIN_PATH/network/organizations"
PUBLIC_TLS_PATH="$BLOCKCHAIN_PATH/network/tls-public"

echo "========================================="
echo "Setup TLS Public Directory"
echo "========================================="
echo ""
echo "Source: $ORGANIZATIONS_PATH"
echo "Destination: $PUBLIC_TLS_PATH"
echo ""

# Buat symlink agar path selalu sama untuk nginx
mkdir -p /var/www
rm -rf /var/www/tls-public

ln -s "$PUBLIC_TLS_PATH" /var/www/tls-public
echo "✅ Symlink created: /var/www/tls-public -> $PUBLIC_TLS_PATH"

# Create public directory
rm -rf "$PUBLIC_TLS_PATH"
mkdir -p "$PUBLIC_TLS_PATH/orderer"
mkdir -p "$PUBLIC_TLS_PATH/peers"
mkdir -p "$PUBLIC_TLS_PATH/ca"

# Copy TLS certificates (public certificates only, no private keys)
echo "📦 Copying TLS certificates..."

# Orderer TLS CA
cp "$ORGANIZATIONS_PATH/ordererOrganizations/jabarchain.me/orderers/chain-orderer.jabarchain.me/tls/ca.crt" \
   "$PUBLIC_TLS_PATH/orderer/orderer-tls-ca.crt" 2>/dev/null && echo "  ✅ Orderer TLS CA"

# Peer TLS CAs  
cp "$ORGANIZATIONS_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/peers/pusat.chain-bpsbp.jabarchain.me/tls/ca.crt" \
   "$PUBLIC_TLS_PATH/peers/pusat-tls-ca.crt" 2>/dev/null && echo "  ✅ Peer pusat TLS CA"

cp "$ORGANIZATIONS_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/peers/cert.chain-bpsbp.jabarchain.me/tls/ca.crt" \
   "$PUBLIC_TLS_PATH/peers/cert-tls-ca.crt" 2>/dev/null && echo "  ✅ Peer cert TLS CA"

# Fabric CA TLS - dari folder fabric-ca
cp "$ORGANIZATIONS_PATH/fabric-ca/bpsbp/ca-cert.pem" \
   "$PUBLIC_TLS_PATH/ca/ca-bpsbp-tls.pem" 2>/dev/null && echo "  ✅ Fabric CA TLS"

# Create bundle
echo ""
echo "📦 Creating bundle..."
cd "$PUBLIC_TLS_PATH"
tar -czf bundle.tar.gz orderer peers ca
echo "  ✅ bundle.tar.gz created"

# Set permissions (readable by all, but directory owned by root)
chmod -R 644 "$PUBLIC_TLS_PATH"/*
chmod 755 "$PUBLIC_TLS_PATH" "$PUBLIC_TLS_PATH/orderer" "$PUBLIC_TLS_PATH/peers" "$PUBLIC_TLS_PATH/ca"

echo ""
echo "========================================="
echo "✅ TLS Public Directory Ready!"
echo "========================================="
echo ""
echo "Files created:"
find "$PUBLIC_TLS_PATH" -type f | while read f; do
    echo "  - $f"
done
echo ""
echo "Next steps:"
echo "  1. Setup nginx dengan config/nginx-tls-certs.conf"
echo "  2. Atau jalankan: python3 -m http.server 8443 -d $PUBLIC_TLS_PATH"
echo ""
