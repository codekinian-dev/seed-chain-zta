#!/bin/bash

# =========================================
# Download TLS Certificates via HTTP
# =========================================
# Download TLS certificates dari blockchain server
# tanpa perlu akses SSH/root
#
# Cara pakai:
#   ./download-tls-certs.sh
#
# Environment variables:
#   BLOCKCHAIN_TLS_URL - URL server TLS certs
# =========================================

# Configuration
BLOCKCHAIN_TLS_URL="${BLOCKCHAIN_TLS_URL:-http://168.144.141.220/}"

# Local paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
TLS_DIR="$APP_DIR/tls-certs"

echo "========================================="
echo "Download TLS Certificates"
echo "========================================="
echo ""
echo "Source: $BLOCKCHAIN_TLS_URL"
echo "Destination: $TLS_DIR"
echo ""

# Check if server is reachable
echo "🔍 Checking server availability..."
if ! curl -s --connect-timeout 5 "$BLOCKCHAIN_TLS_URL/health" > /dev/null 2>&1; then
    # Try without health endpoint
    if ! curl -s --connect-timeout 5 "$BLOCKCHAIN_TLS_URL/" > /dev/null 2>&1; then
        echo "❌ Cannot reach $BLOCKCHAIN_TLS_URL"
        echo ""
        echo "Pastikan:"
        echo "  1. Blockchain server sudah menjalankan TLS cert server"
        echo "  2. Port 8443 terbuka di firewall"
        echo "  3. URL benar: $BLOCKCHAIN_TLS_URL"
        exit 1
    fi
fi
echo "✅ Server reachable"

# Method 1: Download bundle (recommended)
echo ""
echo "📥 Downloading TLS bundle..."

mkdir -p "$TLS_DIR"
cd "$TLS_DIR"

if curl -sS -o bundle.tar.gz "$BLOCKCHAIN_TLS_URL/bundle.tar.gz" 2>/dev/null; then
    echo "✅ Bundle downloaded"
    
    # Extract bundle
    echo "📦 Extracting..."
    tar -xzf bundle.tar.gz
    rm bundle.tar.gz
    echo "✅ Extracted"
else
    # Method 2: Download individual files
    echo "⚠️  Bundle not available, downloading individual files..."
    
    mkdir -p orderer peers ca
    
    curl -sS -o orderer/orderer-tls-ca.crt "$BLOCKCHAIN_TLS_URL/orderer/orderer-tls-ca.crt" && \
        echo "  ✅ Orderer TLS CA"
    
    curl -sS -o peers/pusat-tls-ca.crt "$BLOCKCHAIN_TLS_URL/peers/pusat-tls-ca.crt" && \
        echo "  ✅ Peer pusat TLS CA"
    
    curl -sS -o peers/cert-tls-ca.crt "$BLOCKCHAIN_TLS_URL/peers/cert-tls-ca.crt" && \
        echo "  ✅ Peer cert TLS CA"
    
    curl -sS -o ca/ca-bpsbp-tls.pem "$BLOCKCHAIN_TLS_URL/ca/ca-bpsbp-tls.pem" && \
        echo "  ✅ Fabric CA TLS"
fi

# Verify downloads
echo ""
echo "📋 Downloaded files:"
find "$TLS_DIR" -type f \( -name "*.crt" -o -name "*.pem" \) | while read f; do
    if [ -s "$f" ]; then
        echo "  ✅ $f"
    else
        echo "  ❌ $f (empty or missing)"
    fi
done

echo ""
echo "========================================="
echo "✅ TLS Certificates Downloaded!"
echo "========================================="
echo ""
echo "Next step: Enroll identities"
echo "  node scripts/enroll-remote.js"
echo ""
