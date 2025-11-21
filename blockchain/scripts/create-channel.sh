#!/bin/bash
#
# Script untuk create dan join channel
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

print_message "🔗 Creating and joining channel for seed certification..."

cd "$NETWORK_DIR"

# Channel configuration
export CHANNEL_NAME=${CHANNEL_NAME}
export FABRIC_CFG_PATH=$SCRIPT_DIR/../config/
export ORDERER_CA=${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem
export ORDERER_ADMIN_TLS_SIGN_CERT=${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/server.crt
export ORDERER_ADMIN_TLS_PRIVATE_KEY=${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/server.key

# Function to set environment for BPSBP
setGlobalsForPusatBPSBP() {
    export CORE_PEER_LOCALMSPID="${BPSBP_MSP_ID}"
    export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp
    export CORE_PEER_ADDRESS=${IP_BPSBP}:${BPSBP_PEER0_PORT}
}

setGlobalsForCertBPSBP() {
    export CORE_PEER_LOCALMSPID="${BPSBP_MSP_ID}"
    export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp
    export CORE_PEER_ADDRESS=${IP_BPSBP}:${BPSBP_PEER1_PORT}
}

setGlobalsForPusatDisbun() {
    export CORE_PEER_LOCALMSPID="${DISBUN_MSP_ID}"
    export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp
    export CORE_PEER_ADDRESS=${IP_DISBUN}:${DISBUN_PEER0_PORT}
}

setGlobalsForCertDisbun() {
    export CORE_PEER_LOCALMSPID="${DISBUN_MSP_ID}"
    export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp
    export CORE_PEER_ADDRESS=${IP_DISBUN}:${DISBUN_PEER1_PORT}
}

# # Function to set environment for Disbun
# setGlobalsForDisbun() {
#     export CORE_PEER_TLS_ENABLED=true
#     export CORE_PEER_LOCALMSPID="${DISBUN_MSP_ID}"
#     export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt
#     export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp
#     export CORE_PEER_ADDRESS=${IP_DISBUN}:${DISBUN_PEER0_PORT}
# }

# Function to create channel
createChannel() {
    print_message "📋 Creating channel: ${CHANNEL_NAME}"
    
    setGlobalsForPusatBPSBP
    
    peer channel create \
        -o ${IP_ORDERER}:${ORDERER_PORT} \
        -c ${CHANNEL_NAME} \
        -f ./channel-artifacts/${CHANNEL_ARTIFACTS}.tx \
        --outputBlock ./channel-artifacts/${CHANNEL_ARTIFACTS}.block \
        --tls \
                --cafile "${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/ca.crt"
        
    print_message "✅ Channel created successfully"
}

# Function to join BPSBP peers to channel
joinBPSBPToChannel() {
    print_message "🔗 Joining BPSBP peers to channel..."
    
    setGlobalsForPusatBPSBP
    
    # Join pusat.bpsbp
    peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block
    print_message "✅ pusat.bpsbp joined channel"
    
    # Join cert.bpsbp (if running)
    export CORE_PEER_ADDRESS=${IP_BPSBP}:${BPSBP_PEER1_PORT}
    peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block || print_warning "⚠️ cert.bpsbp might not be running"
    print_message "✅ cert.bpsbp joined channel (if running)"
}

# Function to join Disbun peers to channel
joinDisbunToChannel() {
    print_message "🔗 Joining Disbun peers to channel..."
    
    setGlobalsForPusatDisbun
    
    # Join pusat.disbun
    peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block
    print_message "✅ pusat.disbun joined channel"
    
    # Join cert.disbun (if running)
    export CORE_PEER_ADDRESS=${IP_DISBUN}:${DISBUN_PEER1_PORT}
    peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block || print_warning "⚠️ cert.disbun might not be running"
    print_message "✅ cert.disbun joined channel (if running)"
}

# Alternative function using Docker CLI container for reliable channel operations
joinChannelUsingDocker() {
    print_message "🐳 Using Docker CLI container for channel operations..."
    
    # Copy channel block to CLI container
    print_message "Copying channel block to CLI container..."
    docker cp "${NETWORK_DIR}/channel-artifacts/${CHANNEL_ARTIFACTS}.block" cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/
    
    # Check if channel exists
    print_message "📋 Checking if channel exists..."
    docker exec cli peer channel list

    print_message "🔗 Joining BPSBP pusat to channel..."
    docker exec \
        -e CORE_PEER_LOCALMSPID=${BPSBP_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=pusat.${BPSBP_DOMAIN}:${BPSBP_PEER0_PORT} \
        cli peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block

    print_message "🔗 Joining BPSBP cert to channel..."
    docker exec \
        -e CORE_PEER_LOCALMSPID=${BPSBP_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=cert.${BPSBP_DOMAIN}:${BPSBP_PEER1_PORT} \
        cli peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block

    print_message "🔗 Joining Disbun pusat to channel..."
    docker exec \
        -e CORE_PEER_LOCALMSPID=${DISBUN_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=sekretariat.${DISBUN_DOMAIN}:${DISBUN_PEER0_PORT} \
        cli peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block

    print_message "🔗 Joining Disbun cert to channel..."
    docker exec \
        -e CORE_PEER_LOCALMSPID=${DISBUN_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=digital.${DISBUN_DOMAIN}:${DISBUN_PEER1_PORT} \
        cli peer channel join -b channel-artifacts/${CHANNEL_ARTIFACTS}.block

    print_message "📋 Verifying channel membership..."
    print_message "BPSBP pusat channels:"
    docker exec \
        -e CORE_PEER_LOCALMSPID=${BPSBP_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=pusat.${BPSBP_DOMAIN}:${BPSBP_PEER0_PORT} \
        cli peer channel list

    print_message "Disbun pusat channels:"
    docker exec \
        -e CORE_PEER_LOCALMSPID=${DISBUN_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=sekretariat.${DISBUN_DOMAIN}:${DISBUN_PEER0_PORT} \
        cli peer channel list

    print_message "✅ Channel join operations completed!"
}

# Function to update anchor peers
updateAnchorPeers() {
    print_message "⚓ Updating anchor peers..."
    
    # Update BPSBP anchor peer
    print_message "Updating BPSBP anchor peer..."
    setGlobalsForPusatBPSBP
    peer channel update -o ${IP_ORDERER}:${ORDERER_PORT} \
        --ordererTLSHostnameOverride ${ORDERER_DOMAIN} \
        -c $CHANNEL_NAME \
        -f channel-artifacts/BPSBPBenihanchors.tx \
        --tls \
        --cafile $ORDERER_CA
    
    # Update Disbun anchor peer
    print_message "Updating Disbun anchor peer..."
    setGlobalsForPusatDisbun
    peer channel update -o ${IP_ORDERER}:${ORDERER_PORT} \
        --ordererTLSHostnameOverride ${ORDERER_DOMAIN} \
        -c $CHANNEL_NAME \
        -f channel-artifacts/DisbunBenihanchors.tx \
        --tls \
        --cafile $ORDERER_CA
    
    print_message "✅ Anchor peers updated successfully!"
}

# Function to list channels using Docker CLI
listChannels() {
    print_message "📋 Listing channels for organizations..."
    
    print_message "BPSBP channels:"
    docker exec \
        -e CORE_PEER_LOCALMSPID=${BPSBP_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=pusat.${BPSBP_DOMAIN}:${BPSBP_PEER0_PORT} \
        cli peer channel list
    
    print_message "Disbun channels:"
    docker exec \
        -e CORE_PEER_LOCALMSPID=${DISBUN_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=sekretariat.${DISBUN_DOMAIN}:${DISBUN_PEER0_PORT} \
        cli peer channel list
}

# Function to get channel info using Docker CLI
getChannelInfo() {
    print_message "ℹ️ Getting channel information..."
    
    docker exec \
        -e CORE_PEER_LOCALMSPID=${BPSBP_MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp \
        -e CORE_PEER_ADDRESS=pusat.${BPSBP_DOMAIN}:${BPSBP_PEER0_PORT} \
        cli peer channel getinfo -c $CHANNEL_NAME
}

# Check if network is running
if ! docker compose ps | grep -q "Up"; then
    print_error "❌ Network is not running. Please start the network first with './network.sh up'"
    exit 1
fi

# Main execution
print_message "🚀 Starting channel setup process..."

# Wait for network to be ready
print_message "⏳ Waiting for network to be ready..."
sleep 10

# Create channel
createChannel

# Try joining organizations to channel using peer CLI first
print_message "🔄 Attempting to join channel using direct peer CLI..."
# if joinBPSBPToChannel && joinDisbunToChannel; then
#     print_message "✅ Successfully joined all peers using direct CLI"
# else
#     print_warning "⚠️ Direct CLI method failed, trying Docker CLI method..."
joinChannelUsingDocker
# fi

# Update anchor peers
updateAnchorPeers

# List channels to verify
listChannels

# Get channel info
getChannelInfo

print_message "✅ Channel setup completed successfully!"
print_message "📋 Summary:"
print_message "   - Channel '$CHANNEL_NAME' created"
print_message "   - BPSBP peers joined"
print_message "   - Disbun peers joined"
print_message "   - Anchor peers updated"
print_message ""
print_message "Next step: Deploy chaincode with appropriate scripts"
