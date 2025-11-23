#!/bin/bash
#
# Skrip untuk deploy chaincode menggunakan Chaincode-as-a-Service (CCaaS)
# Sistem Sertifikasi Benih Perkebunan - Hyperledger Fabric v2.4.7
#

set -e
source "$(dirname "$0")/../.env"

# Fungsi untuk mencetak pesan dengan warna
print_message() {
    echo -e "\033[1;32m$1\033[0m"
}

print_error() {
    echo -e "\033[1;31m$1\033[0m"
}

print_warning() {
    echo -e "\033[1;33m$1\033[0m"
}

# Set working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$ROOT_DIR/network"
CHAINCODE_DIR="$ROOT_DIR/chaincode"
CCAAS_DIR="$CHAINCODE_DIR/chaincode-ccaas"

# Set Fabric environment
export FABRIC_CFG_PATH="$ROOT_DIR/config"
export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem"

# Chaincode configuration
CHAINCODE_NAME="${CHAINCODE_NAME}"
CHANNEL_NAME="${CHANNEL_NAME}"
CHAINCODE_VERSION="${1:-1.0}"
CHAINCODE_SEQUENCE="${2:-1}"
CCAAS_PORT=9999

# Endorsement Policy: AND('BPSBPBenihMSP.peer','DisbunBenihMSP.peer')
ENDORSEMENT_POLICY=${ENDORSEMENT_POLICY:-"AND('BPSBPBenihMSP.peer','DisbunBenihMSP.peer')"}

print_message "==========================================="
print_message "DEPLOY CHAINCODE - CCaaS MODE"
print_message "Sistem Sertifikasi Benih Perkebunan"
print_message "==========================================="
print_message "Chaincode: $CHAINCODE_NAME"
print_message "Version: $CHAINCODE_VERSION"
print_message "Sequence: $CHAINCODE_SEQUENCE"
print_message "Channel: $CHANNEL_NAME"
print_message "Port: $CCAAS_PORT"
print_message "==========================================="

# Function to set peer environment
set_peer_env() {
    local org=$1
    local peer=$2
    
    case $org in
        "bpsbp")
            case $peer in
                "peer0")
                    export CORE_PEER_LOCALMSPID="${BPSBP_MSP_ID}"
                    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt"
                    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp"
                    export CORE_PEER_ADDRESS=${IP_BPSBP}:${BPSBP_PEER0_PORT}
                    ;;
                "peer1")
                    export CORE_PEER_LOCALMSPID="${BPSBP_MSP_ID}"
                    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/cert.${BPSBP_DOMAIN}/tls/ca.crt"
                    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/users/Admin@${BPSBP_DOMAIN}/msp"
                    export CORE_PEER_ADDRESS=${IP_BPSBP}:${BPSBP_PEER1_PORT}
                    ;;
            esac
            ;;
        "disbun")
            case $peer in
                "peer0")
                    export CORE_PEER_LOCALMSPID="${DISBUN_MSP_ID}"
                    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt"
                    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp"
                    export CORE_PEER_ADDRESS=${IP_DISBUN}:${DISBUN_PEER0_PORT}
                    ;;
                "peer1")
                    export CORE_PEER_LOCALMSPID="${DISBUN_MSP_ID}"
                    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/digital.${DISBUN_DOMAIN}/tls/ca.crt"
                    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/${DISBUN_DOMAIN}/users/Admin@${DISBUN_DOMAIN}/msp"
                    export CORE_PEER_ADDRESS=${IP_DISBUN}:${DISBUN_PEER1_PORT}
                    ;;
            esac
            ;;
    esac
    
    export CORE_PEER_TLS_ENABLED=true
}

# Function 1: Build chaincode Docker image
build_chaincode_image() {
    print_message "Step 1: Building chaincode Docker image..."
    
    # Copy chaincode files to ccaas directory
    print_message "Copying chaincode files..."
    cp -r "$CHAINCODE_DIR/lib" "$CCAAS_DIR/"
    cp "$CHAINCODE_DIR/index.js" "$CCAAS_DIR/"
    
    # Build Docker image
    cd "$CCAAS_DIR"
    print_message "Building Docker image: seedbatch-ccaas:latest"
    docker build -t seedbatch-ccaas:latest .
    
    if [ $? -eq 0 ]; then
        print_message "✓ Docker image built successfully"
    else
        print_error "✗ Failed to build Docker image"
        exit 1
    fi
    
    cd "$ROOT_DIR"
}

# Function 2: Create CCaaS package
create_ccaas_package() {
    print_message "Step 2: Creating CCaaS package..."
    
    cd "$NETWORK_DIR"
    
    # Create temporary package directory
    PACKAGE_DIR="ccaas-package-temp"
    rm -rf "$PACKAGE_DIR"
    mkdir -p "$PACKAGE_DIR"
    
    # Create connection.json with actual address
    cat > "$PACKAGE_DIR/connection.json" <<EOF
{
  "address": "seedbatch.ccaas:${CCAAS_PORT}",
  "dial_timeout": "10s",
  "tls_required": false
}
EOF
    
    # Create metadata.json
    cat > "$PACKAGE_DIR/metadata.json" <<EOF
{
  "type": "ccaas",
  "label": "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
}
EOF
    
    print_message "Package contents:"
    ls -la "$PACKAGE_DIR"
    
    # Create tar.gz package with correct structure
    # Use tar without compression first, then gzip
    cd "$PACKAGE_DIR"
    tar cf "../${CHAINCODE_NAME}-ccaas.tar" connection.json metadata.json
    gzip -f "../${CHAINCODE_NAME}-ccaas.tar"
    cd ..
    
    if [ -f "${CHAINCODE_NAME}-ccaas.tar.gz" ]; then
        print_message "✓ CCaaS package created: ${CHAINCODE_NAME}-ccaas.tar.gz"
        
        # Verify package contents
        print_message "Package contents verification:"
        tar tzf "${CHAINCODE_NAME}-ccaas.tar.gz"
        
        rm -rf "$PACKAGE_DIR"
    else
        print_error "✗ Failed to create CCaaS package"
        exit 1
    fi
}

# Function 3: Install chaincode on peer
install_chaincode_on_peer() {
    local org=$1
    local peer=$2
    
    print_message "Step 3: Installing chaincode on $org $peer..."
    
    cd "$NETWORK_DIR"
    set_peer_env $org $peer
    
    peer lifecycle chaincode install ${CHAINCODE_NAME}-ccaas.tar.gz
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode installed on $org $peer"
    else
        print_error "✗ Failed to install chaincode on $org $peer"
        exit 1
    fi
}

# Function 4: Install on all peers
install_chaincode() {
    print_message "Installing chaincode on all peers..."
    
    install_chaincode_on_peer "bpsbp" "peer0"
    install_chaincode_on_peer "bpsbp" "peer1"
    install_chaincode_on_peer "disbun" "peer0"
    install_chaincode_on_peer "disbun" "peer1"
    
    print_message "✓ Chaincode installed on all peers"
}

# Function 5: Query installed chaincode and get package ID
query_installed() {
    print_message "Step 4: Querying installed chaincode..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode queryinstalled
    
    # Get package ID
    export PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r ".installed_chaincodes[] | select(.label==\"${CHAINCODE_NAME}_${CHAINCODE_VERSION}\") | .package_id")
    
    if [ -n "$PACKAGE_ID" ]; then
        print_message "✓ Package ID: $PACKAGE_ID"
        echo $PACKAGE_ID > package_id.txt
    else
        print_error "✗ Failed to get package ID"
        exit 1
    fi
}

# Function 6: Start CCaaS container
start_ccaas_container() {
    print_message "Step 5: Starting CCaaS container..."
    
    cd "$CHAINCODE_DIR"
    
    # Check if container already exists
    if docker ps -a | grep -q "seedbatch.ccaas"; then
        print_warning "Stopping existing CCaaS container..."
        docker stop seedbatch.ccaas 2>/dev/null || true
        docker rm seedbatch.ccaas 2>/dev/null || true
    fi
    
    # Start new container
    docker-compose up -d seedbatch.ccaas
    
    if [ $? -eq 0 ]; then
        print_message "✓ CCaaS container started"
        sleep 3
        
        # Check container status
        if docker ps | grep -q "seedbatch.ccaas"; then
            print_message "✓ CCaaS container is running"
            docker logs seedbatch.ccaas --tail 10
        else
            print_error "✗ CCaaS container failed to start"
            docker logs seedbatch.ccaas
            exit 1
        fi
    else
        print_error "✗ Failed to start CCaaS container"
        exit 1
    fi
}

# Function 7: Approve chaincode for organization
approve_chaincode_for_org() {
    local org=$1
    
    print_message "Step 6: Approving chaincode for $org..."
    
    cd "$NETWORK_DIR"
    
    # Read package ID
    if [ -f "package_id.txt" ]; then
        PACKAGE_ID=$(cat package_id.txt)
    else
        print_error "Package ID not found"
        exit 1
    fi
    
    set_peer_env $org "peer0"
    
    peer lifecycle chaincode approveformyorg \
        -o ${IP_ORDERER}:${ORDERER_PORT} \
        --ordererTLSHostnameOverride ${ORDERER_DOMAIN} \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $CHAINCODE_SEQUENCE \
        --tls \
        --cafile "$ORDERER_CA" \
        --signature-policy "$ENDORSEMENT_POLICY"
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode approved for $org"
    else
        print_error "✗ Failed to approve chaincode for $org"
        exit 1
    fi
}

# Function 8: Approve for all organizations
approve_chaincode() {
    approve_chaincode_for_org "bpsbp"
    approve_chaincode_for_org "disbun"
    
    print_message "✓ Chaincode approved for all organizations"
}

# Function 9: Check commit readiness
check_commit_readiness() {
    print_message "Step 7: Checking commit readiness..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode checkcommitreadiness \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --sequence $CHAINCODE_SEQUENCE \
        --tls \
        --cafile "$ORDERER_CA" \
        --signature-policy "$ENDORSEMENT_POLICY" \
        --output json
    
    if [ $? -eq 0 ]; then
        print_message "✓ Commit readiness check passed"
    else
        print_error "✗ Commit readiness check failed"
        exit 1
    fi
}

# Function 10: Commit chaincode
commit_chaincode() {
    print_message "Step 8: Committing chaincode..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode commit \
        -o ${IP_ORDERER}:${ORDERER_PORT} \
        --ordererTLSHostnameOverride ${ORDERER_DOMAIN} \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --sequence $CHAINCODE_SEQUENCE \
        --tls \
        --cafile "$ORDERER_CA" \
        --peerAddresses ${IP_BPSBP}:${BPSBP_PEER0_PORT} \
        --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt" \
        --peerAddresses ${IP_DISBUN}:${DISBUN_PEER0_PORT} \
        --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt" \
        --signature-policy "$ENDORSEMENT_POLICY"
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode committed successfully"
    else
        print_error "✗ Failed to commit chaincode"
        exit 1
    fi
}

# Function 11: Query committed chaincode
query_committed() {
    print_message "Step 9: Querying committed chaincode..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode querycommitted \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode query successful"
    else
        print_error "✗ Failed to query committed chaincode"
        exit 1
    fi
}

# Main execution
main() {
    case "$1" in
        "build")
            build_chaincode_image
            ;;
        "package")
            create_ccaas_package
            ;;
        "install")
            install_chaincode
            ;;
        "query")
            query_installed
            ;;
        "start")
            start_ccaas_container
            ;;
        "approve")
            approve_chaincode
            ;;
        "check")
            check_commit_readiness
            ;;
        "commit")
            commit_chaincode
            ;;
        "deployed")
            query_committed
            ;;
        "deploy")
            print_message "Starting full CCaaS deployment..."
            build_chaincode_image
            create_ccaas_package
            install_chaincode
            query_installed
            start_ccaas_container
            approve_chaincode
            check_commit_readiness
            commit_chaincode
            query_committed
            print_message "==========================================="
            print_message "✓ CHAINCODE DEPLOYMENT COMPLETED"
            print_message "==========================================="
            print_message "Chaincode: $CHAINCODE_NAME"
            print_message "Version: $CHAINCODE_VERSION"
            print_message "Sequence: $CHAINCODE_SEQUENCE"
            print_message "CCaaS Container: seedbatch.ccaas:${CCAAS_PORT}"
            print_message "==========================================="
            ;;
        *)
            print_message "Usage: $0 {build|package|install|query|start|approve|check|commit|deployed|deploy} [version] [sequence]"
            print_message ""
            print_message "Commands:"
            print_message "  build     - Build chaincode Docker image"
            print_message "  package   - Create CCaaS package"
            print_message "  install   - Install chaincode on all peers"
            print_message "  query     - Query installed chaincode"
            print_message "  start     - Start CCaaS container"
            print_message "  approve   - Approve chaincode for all orgs"
            print_message "  check     - Check commit readiness"
            print_message "  commit    - Commit chaincode"
            print_message "  deployed  - Query committed chaincode"
            print_message "  deploy    - Run full deployment (all steps)"
            print_message ""
            print_message "Examples:"
            print_message "  $0 deploy           # Deploy version 1.0 sequence 1"
            print_message "  $0 deploy 2.0 2     # Deploy version 2.0 sequence 2"
            print_message ""
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
