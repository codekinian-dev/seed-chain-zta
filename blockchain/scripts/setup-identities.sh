#!/bin/bash
#
# Script untuk setup admin identity untuk Fabric CA
# User identities akan di-generate otomatis saat register via Keycloak
#
# Flow:
# 1. User register di Keycloak (IDP)
# 2. Application memanggil Fabric CA untuk generate private key
# 3. Enroll dan simpan wallet di application/wallet
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_DIR="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$BLOCKCHAIN_DIR/network"
APPLICATION_DIR="$(dirname "$BLOCKCHAIN_DIR")/application"

source "$BLOCKCHAIN_DIR/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_info() {
    echo -e "${BLUE}$1${NC}"
}

# Fabric environment
export FABRIC_CFG_PATH="$BLOCKCHAIN_DIR/config"
export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem"

# Wallet directory in application
WALLET_DIR="$APPLICATION_DIR/wallet"

# Function to enroll CA admin and store in application wallet
enroll_admin() {
    local org=$1
    local ca_port=$2
    local domain=$3
    local msp_id=$4
    local admin_name=${5:-admin}
    local admin_secret=${6:-adminpw}
    
    print_message "\n=========================================="
    print_message "Enrolling CA Admin for: $org"
    print_message "==========================================\n"
    
    export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/fabric-ca/$org
    
    # Enroll admin
    print_info "Enrolling admin identity..."
    
    local admin_msp_dir="$NETWORK_DIR/organizations/peerOrganizations/$domain/users/${admin_name}@${domain}/msp"
    mkdir -p "$admin_msp_dir"
    
    fabric-ca-client enroll \
        -u https://${admin_name}:${admin_secret}@localhost:$ca_port \
        --caname ca-$org \
        -M "$admin_msp_dir" \
        --tls.certfiles $NETWORK_DIR/organizations/fabric-ca/$org/ca-cert.pem
    
    # Copy NodeOUs config
    cp $NETWORK_DIR/organizations/peerOrganizations/$domain/msp/config.yaml \
       "$admin_msp_dir/config.yaml"
    
    print_message "✓ Admin enrolled successfully"
    
    # Create wallet for admin
    create_wallet_for_admin "$admin_name" "$domain" "$msp_id" "$admin_msp_dir"
}

# Function to create wallet in application directory
create_wallet_for_admin() {
    local username=$1
    local domain=$2
    local msp_id=$3
    local user_msp_dir=$4
    
    print_info "Creating wallet for $username in application..."
    
    # Create wallet directory
    mkdir -p "$WALLET_DIR"
    
    # Get certificate
    local cert_file=$(ls "$user_msp_dir/signcerts/" 2>/dev/null | head -n 1)
    if [ -z "$cert_file" ]; then
        print_error "✗ Certificate not found for $username"
        return 1
    fi
    local cert_path="$user_msp_dir/signcerts/$cert_file"
    
    # Get private key
    local key_file=$(ls "$user_msp_dir/keystore/" 2>/dev/null | head -n 1)
    if [ -z "$key_file" ]; then
        print_error "✗ Private key not found for $username"
        return 1
    fi
    local key_path="$user_msp_dir/keystore/$key_file"
    
    # Read certificate and key content
    local cert_content=$(cat "$cert_path" | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}')
    local key_content=$(cat "$key_path" | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}')
    
    # Create wallet identity JSON (Fabric SDK wallet format)
    cat > "$WALLET_DIR/$username.id" << EOF
{
    "credentials": {
        "certificate": "${cert_content}",
        "privateKey": "${key_content}"
    },
    "mspId": "${msp_id}",
    "type": "X.509",
    "version": 1
}
EOF
    
    # Create metadata file
    cat > "$WALLET_DIR/$username.metadata.json" << EOF
{
    "userId": "${username}",
    "username": "${username}",
    "mspId": "${msp_id}",
    "domain": "${domain}",
    "role": "admin",
    "enrolledAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "isAdmin": true
}
EOF
    
    print_message "✓ Wallet created for $username at $WALLET_DIR"
    return 0
}

# Function to copy CA TLS certificate to application
copy_ca_tls_cert() {
    local org=$1
    
    print_info "Copying CA TLS certificate to application..."
    
    local ca_tls_cert="$NETWORK_DIR/organizations/fabric-ca/$org/ca-cert.pem"
    local app_config_dir="$APPLICATION_DIR/config"
    
    mkdir -p "$app_config_dir"
    
    if [ -f "$ca_tls_cert" ]; then
        cp "$ca_tls_cert" "$app_config_dir/ca-cert-$org.pem"
        print_message "✓ CA TLS certificate copied to $app_config_dir/ca-cert-$org.pem"
    else
        print_warning "CA TLS certificate not found at $ca_tls_cert"
    fi
}

# Main execution
main() {
    print_message "=========================================="
    print_message "Setup Admin Identity for Fabric CA"
    print_message "==========================================\n"
    
    print_info "This script sets up the admin identity required for"
    print_info "the application to register new user identities."
    print_info ""
    print_info "User identities will be created automatically when"
    print_info "users register through Keycloak (IDP)."
    print_info ""
    
    # Create wallet directory
    mkdir -p "$WALLET_DIR"
    print_message "Wallet directory: $WALLET_DIR\n"
    
    # Enroll admin for BPSBP organization
    enroll_admin "bpsbp" "$BPSBP_CA_PORT" "$BPSBP_DOMAIN" "$BPSBP_MSP_ID" "admin" "adminpw"
    
    # Copy CA TLS certificate
    copy_ca_tls_cert "bpsbp"
    
    print_message "\n=========================================="
    print_message "✓ Admin setup completed successfully!"
    print_message "==========================================\n"
    
    print_info "Next steps:"
    print_info "1. Configure application/.env with CA settings:"
    print_info "   FABRIC_CA_URL=https://localhost:$BPSBP_CA_PORT"
    print_info "   FABRIC_CA_NAME=ca-bpsbp"
    print_info "   FABRIC_CA_TLS_CERT=./config/ca-cert-bpsbp.pem"
    print_info "   FABRIC_CA_ADMIN_USER=admin"
    print_info "   FABRIC_CA_ADMIN_SECRET=adminpw"
    print_info ""
    print_info "2. When users register via Keycloak, call:"
    print_info "   POST /api/v1/identity/enroll"
    print_info ""
    print_info "3. User identities will be stored in:"
    print_info "   $WALLET_DIR/<keycloak-user-id>.id"
}

# Run main function
main "$@"
