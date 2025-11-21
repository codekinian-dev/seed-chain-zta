#!/bin/bash

# Deploy chaincode with enhanced error handling and retry logic
# Usage: ./deploy-chaincode-enhanced.sh [channel-name]

set -e

CHANNEL_NAME=${1:-"benihchannel"}
CC_NAME="benih-certification"
CC_VERSION="1.0"
CC_SEQUENCE="1"
DELAY=3
MAX_RETRY=3

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
CHAINCODE_DIR="$(dirname "$NETWORK_DIR")/chaincode"

println() { echo -e "${GREEN}${1}${NC}"; }
errorln() { echo -e "${RED}ERROR: ${1}${NC}"; }
warnln() { echo -e "${YELLOW}WARNING: ${1}${NC}"; }
infoln() { echo -e "${BLUE}INFO: ${1}${NC}"; }

# Verify prerequisites
verifyPrereqs() {
    println "Verifying prerequisites..."
    
    # Check Docker
    if ! docker info > /dev/null 2>&1; then
        errorln "Docker is not accessible"
        errorln "Run: sudo ./scripts/fix-docker-deployment.sh"
        exit 1
    fi
    
    # Check if peers are running
    if ! docker ps --format '{{.Names}}' | grep -q "pusat.chain-bpsbp.jabarchain.me"; then
        errorln "Fabric network is not running"
        errorln "Start network first: cd blockchain && ./fabric.sh up"
        exit 1
    fi
    
    # Check chaincode directory
    if [ ! -d "$CHAINCODE_DIR" ]; then
        errorln "Chaincode directory not found: $CHAINCODE_DIR"
        exit 1
    fi
    
    println "✓ Prerequisites verified"
}

# Set environment for peer
setPeerEnv() {
    local ORG=$1
    local PEER=${2:-"peer0"}
    
    export FABRIC_LOGGING_SPEC=INFO
    export CORE_PEER_TLS_ENABLED=true
    
    if [ "$ORG" == "bpsbp" ]; then
        export CORE_PEER_LOCALMSPID="BPSBPMSP"
        export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/peers/${PEER}.chain-bpsbp.jabarchain.me/tls/ca.crt
        export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/users/Admin@chain-bpsbp.jabarchain.me/msp
        
        if [ "$PEER" == "peer0" ]; then
            export CORE_PEER_ADDRESS=localhost:7051
        else
            export CORE_PEER_ADDRESS=localhost:8051
        fi
    else # disbun
        export CORE_PEER_LOCALMSPID="DisbunMSP"
        export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/chain-disbun.jabarchain.me/peers/${PEER}.chain-disbun.jabarchain.me/tls/ca.crt
        export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/chain-disbun.jabarchain.me/users/Admin@chain-disbun.jabarchain.me/msp
        
        if [ "$PEER" == "peer0" ]; then
            export CORE_PEER_ADDRESS=localhost:9051
        else
            export CORE_PEER_ADDRESS=localhost:10051
        fi
    fi
    
    infoln "Environment set for ${ORG} ${PEER}"
}

# Package chaincode
packageChaincode() {
    println "Packaging chaincode..."
    
    cd "$CHAINCODE_DIR"
    
    # Clean old node_modules
    rm -rf node_modules package-lock.json
    
    # Install dependencies
    infoln "Installing dependencies..."
    npm install --production --no-audit --no-fund
    
    cd "$NETWORK_DIR"
    
    # Remove old package
    rm -f ${CC_NAME}-v${CC_VERSION}.tar.gz
    
    # Set peer environment for packaging
    setPeerEnv "bpsbp" "peer0"
    
    # Package with timeout handling
    infoln "Creating chaincode package..."
    timeout 60s peer lifecycle chaincode package ${CC_NAME}-v${CC_VERSION}.tar.gz \
        --path "$CHAINCODE_DIR" \
        --lang node \
        --label ${CC_NAME}_${CC_VERSION} 2>&1 | tee package.log
    
    if [ ! -f "${CC_NAME}-v${CC_VERSION}.tar.gz" ]; then
        errorln "Package file not created"
        cat package.log
        exit 1
    fi
    
    println "✓ Chaincode packaged: ${CC_NAME}-v${CC_VERSION}.tar.gz"
}

# Install chaincode with retry
installChaincode() {
    local ORG=$1
    local PEER=$2
    
    println "Installing chaincode on ${ORG} ${PEER}..."
    
    setPeerEnv "$ORG" "$PEER"
    
    local COUNTER=1
    while [ $COUNTER -le $MAX_RETRY ]; do
        infoln "Attempt $COUNTER of $MAX_RETRY"
        
        # Kill any hung docker build processes
        pkill -f "docker.*build" 2>/dev/null || true
        
        if peer lifecycle chaincode install ${CC_NAME}-v${CC_VERSION}.tar.gz 2>&1 | tee install_${ORG}_${PEER}.log; then
            if grep -q "Chaincode code package identifier" install_${ORG}_${PEER}.log; then
                println "✓ Installed on ${ORG} ${PEER}"
                return 0
            fi
        fi
        
        warnln "Install failed, retrying in ${DELAY}s..."
        sleep $DELAY
        COUNTER=$((COUNTER + 1))
        
        # Clean docker build cache between retries
        docker builder prune -f > /dev/null 2>&1 || true
    done
    
    errorln "Failed to install on ${ORG} ${PEER} after $MAX_RETRY attempts"
    cat install_${ORG}_${PEER}.log
    return 1
}

# Query installed chaincode
queryInstalled() {
    local ORG=$1
    
    setPeerEnv "$ORG" "peer0"
    
    peer lifecycle chaincode queryinstalled --output json > queryInstalled.json
    PACKAGE_ID=$(jq -r '.installed_chaincodes[] | select(.label=="'${CC_NAME}_${CC_VERSION}'") | .package_id' queryInstalled.json)
    
    echo "$PACKAGE_ID"
}

# Approve chaincode
approveForOrg() {
    local ORG=$1
    local PACKAGE_ID=$2
    
    println "Approving chaincode for ${ORG}..."
    
    setPeerEnv "$ORG" "peer0"
    
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.jabarchain.me \
        --tls \
        --cafile ${NETWORK_DIR}/organizations/ordererOrganizations/jabarchain.me/orderers/orderer.jabarchain.me/msp/tlscacerts/tlsca.jabarchain.me-cert.pem \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $CC_SEQUENCE
    
    println "✓ Approved for ${ORG}"
}

# Check commit readiness
checkCommitReadiness() {
    println "Checking commit readiness..."
    
    setPeerEnv "bpsbp" "peer0"
    
    peer lifecycle chaincode checkcommitreadiness \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --sequence $CC_SEQUENCE \
        --output json | jq .
}

# Commit chaincode
commitChaincode() {
    println "Committing chaincode..."
    
    setPeerEnv "bpsbp" "peer0"
    
    peer lifecycle chaincode commit \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.jabarchain.me \
        --tls \
        --cafile ${NETWORK_DIR}/organizations/ordererOrganizations/jabarchain.me/orderers/orderer.jabarchain.me/msp/tlscacerts/tlsca.jabarchain.me-cert.pem \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --sequence $CC_SEQUENCE \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/chain-bpsbp.jabarchain.me/peers/peer0.chain-bpsbp.jabarchain.me/tls/ca.crt \
        --peerAddresses localhost:9051 \
        --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/chain-disbun.jabarchain.me/peers/peer0.chain-disbun.jabarchain.me/tls/ca.crt
    
    println "✓ Chaincode committed"
}

# Query committed
queryCommitted() {
    println "Verifying committed chaincode..."
    
    setPeerEnv "bpsbp" "peer0"
    
    peer lifecycle chaincode querycommitted \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --output json | jq .
}

# Main execution
main() {
    println "=== Enhanced Chaincode Deployment ==="
    println "Channel: $CHANNEL_NAME"
    println "Chaincode: $CC_NAME v$CC_VERSION"
    echo ""
    
    cd "$NETWORK_DIR"
    
    # Step 1: Verify
    verifyPrereqs
    
    # Step 2: Package
    packageChaincode
    
    # Step 3: Install on all peers
    installChaincode "bpsbp" "peer0" || exit 1
    sleep 2
    installChaincode "disbun" "peer0" || exit 1
    
    # Step 4: Get package ID
    PACKAGE_ID=$(queryInstalled "bpsbp")
    if [ -z "$PACKAGE_ID" ]; then
        errorln "Could not get package ID"
        exit 1
    fi
    println "Package ID: $PACKAGE_ID"
    
    # Step 5: Approve for both orgs
    approveForOrg "bpsbp" "$PACKAGE_ID"
    sleep 2
    approveForOrg "disbun" "$PACKAGE_ID"
    
    # Step 6: Check readiness
    sleep 3
    checkCommitReadiness
    
    # Step 7: Commit
    sleep 2
    commitChaincode
    
    # Step 8: Verify
    sleep 3
    queryCommitted
    
    echo ""
    println "=== Deployment Completed Successfully! ==="
    println "Chaincode: $CC_NAME v$CC_VERSION"
    println "Channel: $CHANNEL_NAME"
    println "Package ID: $PACKAGE_ID"
    echo ""
    infoln "Test chaincode with:"
    echo "  peer chaincode invoke -C $CHANNEL_NAME -n $CC_NAME -c '{\"function\":\"yourFunction\",\"Args\":[]}'"
}

# Run main
main
