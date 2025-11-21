#!/bin/bash
#
# Script untuk setup single appUser dengan combined roles untuk dApp
# UUIDs akan dikirim sebagai parameter ke chaincode
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_DIR="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$BLOCKCHAIN_DIR/network"

source "$BLOCKCHAIN_DIR/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

# Single appUser for dApp - will handle all roles
APP_USER="appUser"

# Fabric environment
export FABRIC_CFG_PATH="$BLOCKCHAIN_DIR/config"
export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem"

# Function to set peer environment
set_peer_env() {
    local org=$1
    local username=$2
    local domain=$3
    local peer_port=$4
    local msp_id=$5
    local peer_name=$6
    
    export CORE_PEER_LOCALMSPID="$msp_id"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/$domain/peers/$peer_name.$domain/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/$domain/users/${username}@${domain}/msp"
    export CORE_PEER_ADDRESS="localhost:$peer_port"
    export CORE_PEER_TLS_ENABLED=true
}

# Function to join user to channel
join_user_to_channel() {
    local org=$1
    local username=$2
    local domain=$3
    local peer_port=$4
    local msp_id=$5
    local peer_name=$6
    
    print_message "Joining user $username to channel benihchannel..."
    
    set_peer_env "$org" "$username" "$domain" "$peer_port" "$msp_id" "$peer_name"
    
    # Fetch channel block
    peer channel fetch 0 benihchannel.block \
        -o localhost:${ORDERER_PORT} \
        --ordererTLSHostnameOverride ${ORDERER_DOMAIN} \
        -c benihchannel \
        --tls \
        --cafile "$ORDERER_CA" 2>/dev/null || true
    
    # Join channel
    peer channel join -b benihchannel.block 2>/dev/null || print_warning "Already joined or join failed (this is OK if already joined)"
    
    # Create ca.crt symlink for MSP structure
    local user_msp_dir="$NETWORK_DIR/organizations/peerOrganizations/$domain/users/${username}@${domain}/msp"
    if [ ! -f "$user_msp_dir/cacerts/ca.crt" ]; then
        local ca_file=$(ls "$user_msp_dir/cacerts/" | head -n 1)
        if [ -n "$ca_file" ]; then
            ln -sf "$ca_file" "$user_msp_dir/cacerts/ca.crt"
            print_message "✓ Created ca.crt symlink for $username"
        fi
    fi
    
    # Verify
    if peer channel list 2>/dev/null | grep -q "benihchannel"; then
        print_message "✓ User $username successfully joined channel benihchannel"
        return 0
    else
        print_warning "⚠ User $username may not have joined channel (check manually)"
        return 1
    fi
}

# Function to enroll single appUser with combined roles
enroll_app_user() {
    local org=$1
    local username=$2
    local ca_port=$3
    local domain=$4
    
    export FABRIC_CA_CLIENT_HOME=$NETWORK_DIR/organizations/fabric-ca/$org
    
    # Register appUser with ALL roles as comma-separated attributes
    fabric-ca-client register \
        --caname ca-$org \
        --id.name $username \
        --id.secret apppw \
        --id.type client \
        --id.attrs "role_producer=true:ecert,role_pbt_field=true:ecert,role_pbt_chief=true:ecert,role_lsm_head=true:ecert" \
        --tls.certfiles $NETWORK_DIR/organizations/fabric-ca/$org/ca-cert.pem \
        -u https://localhost:$ca_port 2>/dev/null || true
    
    # Enroll with all role attributes
    fabric-ca-client enroll \
        -u https://${username}:apppw@localhost:$ca_port \
        --caname ca-$org \
        --enrollment.attrs "role_producer,role_pbt_field,role_pbt_chief,role_lsm_head" \
        -M $NETWORK_DIR/organizations/peerOrganizations/$domain/users/${username}@${domain}/msp \
        --tls.certfiles $NETWORK_DIR/organizations/fabric-ca/$org/ca-cert.pem
    
    cp $NETWORK_DIR/organizations/peerOrganizations/$domain/msp/config.yaml \
       $NETWORK_DIR/organizations/peerOrganizations/$domain/users/${username}@${domain}/msp/config.yaml
    
    print_message "✓ $username enrolled with combined roles: producer, pbt_field, pbt_chief, lsm_head"
}

print_message "Setting up single appUser for dApp..."

# Create appUser in BPSBP (can also be created in Disbun, choose one)
enroll_app_user "bpsbp" "$APP_USER" $BPSBP_CA_PORT $BPSBP_DOMAIN
join_user_to_channel "bpsbp" "$APP_USER" "$BPSBP_DOMAIN" "$BPSBP_PEER0_PORT" "$BPSBP_MSP_ID" "pusat"

# Cleanup
rm -f benihchannel.block

print_message "\n✓ appUser created and joined to channel successfully"
print_message "Note: UUIDs (producer, inspector_field, inspector_chief, issuer) will be sent as parameters to chaincode"
