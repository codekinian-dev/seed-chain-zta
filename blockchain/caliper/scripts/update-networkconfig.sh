#!/bin/bash
#
# Auto-update networkConfig.yaml untuk single appUser
# Deteksi otomatis private key hash
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$ROOT_DIR/../network"
NETWORK_CONFIG="$ROOT_DIR/networks/networkConfig.yaml"

source "$ROOT_DIR/../.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Single appUser
APP_USER="appUser"

# Function to get private key path
get_private_key() {
    local user_dir=$1
    local keystore_dir="$user_dir/msp/keystore"
    
    if [ -d "$keystore_dir" ]; then
        # Get first _sk file
        local sk_file=$(ls "$keystore_dir"/*_sk 2>/dev/null | head -1)
        if [ -n "$sk_file" ]; then
            echo "$sk_file"
            return 0
        fi
    fi
    return 1
}

# Function to get certificate path
get_cert_path() {
    local user_dir=$1
    local signcerts_dir="$user_dir/msp/signcerts"
    
    if [ -d "$signcerts_dir" ]; then
        local cert_file=$(ls "$signcerts_dir"/*.pem 2>/dev/null | head -1)
        if [ -n "$cert_file" ]; then
            echo "$cert_file"
            return 0
        fi
    fi
    return 1
}

print_message "Updating networkConfig.yaml for single appUser..."

# Get paths for appUser (BPSBP)
APP_USER_DIR="$NETWORK_DIR/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/users/${APP_USER}@chain-bpsbp.jabarchain.me"

APP_USER_KEY=$(get_private_key "$APP_USER_DIR")
APP_USER_CERT=$(get_cert_path "$APP_USER_DIR")

if [ -z "$APP_USER_KEY" ] || [ -z "$APP_USER_CERT" ]; then
    print_warning "appUser certificates not found. Run setup-identities.sh first."
    exit 1
fi

print_message "Found appUser certificate: $(basename $APP_USER_KEY)"

# Create networkConfig.yaml with appUser
cat > "$NETWORK_CONFIG" << EOF
name: Benih Certification Network
version: "2.0.0"
caliper:
  blockchain: fabric

channels:
  - channelName: benihchannel
    contracts:
      - id: benih-certification

organizations:
  - mspid: BPSBPBenihMSP
    identities:
      certificates:
        - name: appUser
          clientSignedCert:
            path: $APP_USER_CERT
          clientPrivateKey:
            path: $APP_USER_KEY
    connectionProfile:
      path: ./networks/connection-bpsbp.yaml
      discover: true

EOF

print_message "networkConfig.yaml updated successfully!"
print_message "appUser will be used for all transactions (combined roles)"
