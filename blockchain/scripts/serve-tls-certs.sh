#!/bin/bash

# =========================================
# Simple TLS Certificate Server
# =========================================
# Jalankan script ini di blockchain server untuk
# menyediakan TLS certificates via HTTP
#
# Cara pakai:
#   ./serve-tls-certs.sh                    # Auto-detect dari lokasi script
#   BLOCKCHAIN_PATH=/root/tesis ./serve-tls-certs.sh  # Manual set path
#
# Certificates akan tersedia di:
#   http://<blockchain-server>:8443/
# =========================================

# Auto-detect path dari lokasi script ini
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTO_DETECTED_PATH="$(dirname "$SCRIPT_DIR")"

# Configuration - gunakan env var atau auto-detect
BLOCKCHAIN_PATH="${BLOCKCHAIN_PATH:-$AUTO_DETECTED_PATH}"
ORGANIZATIONS_PATH="$BLOCKCHAIN_PATH/network/organizations"
SERVE_PORT="${SERVE_PORT:-8443}"

# Create temporary directory for TLS certs
TLS_SERVE_DIR="/tmp/fabric-tls-certs"
rm -rf "$TLS_SERVE_DIR"
mkdir -p "$TLS_SERVE_DIR"

echo "========================================="
echo "Fabric TLS Certificate Server"
echo "========================================="
echo ""

# Copy TLS certificates to serve directory
echo "📦 Preparing TLS certificates..."

# Orderer TLS CA
mkdir -p "$TLS_SERVE_DIR/orderer"
cp "$ORGANIZATIONS_PATH/ordererOrganizations/jabarchain.me/orderers/chain-orderer.jabarchain.me/tls/ca.crt" \
   "$TLS_SERVE_DIR/orderer/orderer-tls-ca.crt" 2>/dev/null && echo "  ✅ Orderer TLS CA"

# Peer TLS CAs
mkdir -p "$TLS_SERVE_DIR/peers"
cp "$ORGANIZATIONS_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/peers/pusat.chain-bpsbp.jabarchain.me/tls/ca.crt" \
   "$TLS_SERVE_DIR/peers/pusat-tls-ca.crt" 2>/dev/null && echo "  ✅ Peer pusat TLS CA"

cp "$ORGANIZATIONS_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/peers/cert.chain-bpsbp.jabarchain.me/tls/ca.crt" \
   "$TLS_SERVE_DIR/peers/cert-tls-ca.crt" 2>/dev/null && echo "  ✅ Peer cert TLS CA"

# Fabric CA TLS
mkdir -p "$TLS_SERVE_DIR/ca"
cp "$ORGANIZATIONS_PATH/peerOrganizations/chain-bpsbp.jabarchain.me/ca/ca-cert.pem" \
   "$TLS_SERVE_DIR/ca/ca-bpsbp-tls.pem" 2>/dev/null && echo "  ✅ Fabric CA TLS"

# Create index file for easy browsing
cat > "$TLS_SERVE_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head><title>Fabric TLS Certificates</title></head>
<body>
<h1>Fabric TLS Certificates</h1>
<p>Download these files for your application server:</p>
<ul>
  <li><a href="orderer/orderer-tls-ca.crt">Orderer TLS CA</a></li>
  <li><a href="peers/pusat-tls-ca.crt">Peer Pusat TLS CA</a></li>
  <li><a href="peers/cert-tls-ca.crt">Peer Cert TLS CA</a></li>
  <li><a href="ca/ca-bpsbp-tls.pem">Fabric CA TLS</a></li>
</ul>
<hr>
<p><a href="bundle.tar.gz">Download All (bundle.tar.gz)</a></p>
</body>
</html>
EOF

# Create bundle
cd "$TLS_SERVE_DIR"
tar -czf bundle.tar.gz orderer peers ca
echo "  ✅ Bundle created"

echo ""
echo "📋 Files ready to serve:"
find "$TLS_SERVE_DIR" -type f -name "*.crt" -o -name "*.pem" | while read f; do
    echo "  - $f"
done

echo ""
echo "========================================="
echo "🚀 Starting HTTP server on port $SERVE_PORT"
echo "========================================="
echo ""
echo "TLS certificates available at:"
echo "  http://$(hostname -I | awk '{print $1}'):$SERVE_PORT/"
echo ""
echo "Application server can download with:"
echo "  curl -O http://<this-server>:$SERVE_PORT/bundle.tar.gz"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start simple HTTP server
cd "$TLS_SERVE_DIR"
python3 -m http.server $SERVE_PORT 2>/dev/null || python -m SimpleHTTPServer $SERVE_PORT
