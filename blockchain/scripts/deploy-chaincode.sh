#!/bin/bash
#
# Skrip untuk deploy chaincode dengan endorsement policy
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
CHAINCODE_DIR="$ROOT_DIR/./chaincode"

# Set Fabric environment
export FABRIC_CFG_PATH="$ROOT_DIR/config"
export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem"

# Chaincode configuration
CHAINCODE_NAME="${CHAINCODE_NAME}"
CHANNEL_NAME="${CHANNEL_NAME}"
CHAINCODE_PATH="$CHAINCODE_DIR"

# Endorsement Policy: AND('BPSBPBenihMSP.peer','DisbunBenihMSP.peer')
ENDORSEMENT_POLICY=${ENDORSEMENT_POLICY:-"AND('BPSBPBenihMSP.peer','DisbunBenihMSP.peer')"}

print_message "==========================================="
print_message "DEPLOY CHAINCODE BENIH CERTIFICATION"
print_message "Sistem Sertifikasi Benih Perkebunan"
print_message "==========================================="

# Function to get auto-incremented version and sequence
get_chaincode_version() {
    print_message "Detecting chaincode version and sequence..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    # Query committed chaincode
    COMMITTED_INFO=$(peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name $CHAINCODE_NAME 2>/dev/null || echo "")
    
    if [ -z "$COMMITTED_INFO" ]; then
        # No chaincode committed yet, start with version 1.0 and sequence 1
        CHAINCODE_VERSION="1.0"
        CHAINCODE_SEQUENCE="1"
        print_message "✓ No previous version found. Starting with version $CHAINCODE_VERSION, sequence $CHAINCODE_SEQUENCE"
    else
        # Extract current version and sequence (macOS compatible)
        CURRENT_VERSION=$(echo "$COMMITTED_INFO" | sed -n 's/.*Version: \([^,]*\).*/\1/p')
        CURRENT_SEQUENCE=$(echo "$COMMITTED_INFO" | sed -n 's/.*Sequence: \([^,]*\).*/\1/p')
        
        # Increment sequence
        CHAINCODE_SEQUENCE=$((CURRENT_SEQUENCE + 1))
        
        # Increment version (increment minor version)
        MAJOR_VERSION=$(echo "$CURRENT_VERSION" | cut -d. -f1)
        MINOR_VERSION=$(echo "$CURRENT_VERSION" | cut -d. -f2)
        
        # Convert to integer for arithmetic
        NEW_MINOR_VERSION=$((MINOR_VERSION + 1))
        CHAINCODE_VERSION="${MAJOR_VERSION}.${NEW_MINOR_VERSION}"
        
        print_message "✓ Current version: $CURRENT_VERSION (sequence $CURRENT_SEQUENCE)"
        print_message "✓ New version: $CHAINCODE_VERSION (sequence $CHAINCODE_SEQUENCE)"
    fi
    
    export CHAINCODE_VERSION
    export CHAINCODE_SEQUENCE
}

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
    
    print_message "Environment set untuk $org $peer"
}

# Function to package chaincode
# package_chaincode() {
#     print_message "Packaging chaincode..."
    
#     # --- TAMBAHAN PENTING MULAI ---
#     print_warning "Membersihkan node_modules untuk mencegah error Broken Pipe..."
#     if [ -d "${CHAINCODE_PATH}/node_modules" ]; then
#         rm -rf "${CHAINCODE_PATH}/node_modules"
#         print_message "✓ Folder node_modules dihapus."
#     fi
    
#     if [ -d "${CHAINCODE_PATH}/package-lock.json" ]; then
#          # Opsional: kadang package-lock bikin masalah versi, aman dihapus
#          rm -f "${CHAINCODE_PATH}/package-lock.json" 
#     fi
#     # --- TAMBAHAN PENTING SELESAI ---

#     cd "$NETWORK_DIR"
    
#     # Set environment to any peer
#     set_peer_env "bpsbp" "peer0"
    
#     # Package chaincode
#     peer lifecycle chaincode package ${CHAINCODE_NAME}-v${CHAINCODE_VERSION}.tar.gz --path ${CHAINCODE_PATH} --lang node --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}
    
#     if [ $? -eq 0 ]; then
#         # Cek ukuran file
#         FILE_SIZE=$(du -h ${CHAINCODE_NAME}-v${CHAINCODE_VERSION}.tar.gz | cut -f1)
#         print_message "✓ Chaincode berhasil di-package: ${CHAINCODE_NAME}-v${CHAINCODE_VERSION}.tar.gz (Ukuran: $FILE_SIZE)"
#     else
#         print_error "✗ Gagal packaging chaincode"
#         exit 1
#     fi
# }
package_chaincode() {
    print_message "Packaging chaincode for CCaaS..."
    
    cd "$CHAINCODE_PATH"
    
    # Pack connection.json ke dalam archive
    tar cfz code.tar.gz connection.json
    
    # Buat metadata.json
    echo "{\"type\":\"ccaas\",\"label\":\"${CHAINCODE_NAME}_${CHAINCODE_VERSION}\"}" > metadata.json
    
    # Pack final package yang diterima Peer
    tar cfz ${CHAINCODE_NAME}-v${CHAINCODE_VERSION}.tar.gz metadata.json code.tar.gz
    
    # Pindahkan ke folder network agar bisa diinstall
    mv ${CHAINCODE_NAME}-v${CHAINCODE_VERSION}.tar.gz "$NETWORK_DIR/"
    
    # Bersihkan temp file
    rm metadata.json code.tar.gz
    
    print_message "✓ CCaaS Package created"
}

# Function to install chaincode on peer
install_chaincode_on_peer() {
    local org=$1
    local peer=$2
    
    print_message "Installing chaincode pada $org $peer..."
    
    cd "$NETWORK_DIR"
    set_peer_env $org $peer
    
    peer lifecycle chaincode install ${CHAINCODE_NAME}-v${CHAINCODE_VERSION}.tar.gz
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode berhasil diinstall pada $org $peer"
    else
        print_error "✗ Gagal install chaincode pada $org $peer"
        exit 1
    fi
}

# Function to install chaincode on all peers
install_chaincode() {
    print_message "Installing chaincode pada semua peers..."
    
    install_chaincode_on_peer "bpsbp" "peer0"
    install_chaincode_on_peer "bpsbp" "peer1"
    install_chaincode_on_peer "disbun" "peer0"
    install_chaincode_on_peer "disbun" "peer1"
    
    print_message "✓ Chaincode berhasil diinstall pada semua peers"
}

# Function to query installed chaincode
query_installed() {
    print_message "Querying installed chaincode..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode queryinstalled
    
    # Get package ID based on label
    local LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
    print_message "Mencari Package ID untuk label: $LABEL"
    
    export PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r ".installed_chaincodes[] | select(.label == \"$LABEL\") | .package_id" | head -n 1)
    
    if [ -n "$PACKAGE_ID" ]; then
        print_message "✓ Package ID ditemukan: $PACKAGE_ID"
        echo $PACKAGE_ID > package_id.txt
    else
        print_error "✗ Gagal mendapatkan package ID untuk label $LABEL"
        print_error "Pastikan chaincode dengan versi $CHAINCODE_VERSION sudah terinstall."
        exit 1
    fi
}

# Function to update chaincode container with new Package ID
update_chaincode_container() {
    print_message "Updating chaincode container..."
    
    cd "$NETWORK_DIR"
    
    if [ -f "../package_id.txt" ]; then
        PACKAGE_ID=$(cat ../package_id.txt)
    elif [ -f "package_id.txt" ]; then
        PACKAGE_ID=$(cat package_id.txt)
    else
        print_error "Package ID tidak ditemukan. Jalankan query_installed terlebih dahulu."
        exit 1
    fi
    
    print_message "Updating docker compose-chaincode.yaml with Package ID: $PACKAGE_ID"
    
    # Update CHAINCODE_ID in docker compose-chaincode.yaml
    # Note: Using sed compatible with both GNU and BSD (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|CHAINCODE_ID=.*|CHAINCODE_ID=$PACKAGE_ID|g" docker compose-chaincode.yaml
    else
        sed -i "s|CHAINCODE_ID=.*|CHAINCODE_ID=$PACKAGE_ID|g" docker compose-chaincode.yaml
    fi
    
    print_message "Restarting chaincode container..."
    docker compose -f docker compose-chaincode.yaml up -d --no-deps benih-cc
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode container updated and restarted"
    else
        print_error "✗ Gagal restart chaincode container"
        exit 1
    fi
}

# Function to approve chaincode for organization
approve_chaincode_for_org() {
    local org=$1
    
    print_message "Approving chaincode untuk $org..."
    
    cd "$NETWORK_DIR"
    
    # Read package ID
    if [ -f "package_id.txt" ]; then
        PACKAGE_ID=$(cat package_id.txt)
    else
        print_error "Package ID tidak ditemukan. Jalankan query_installed terlebih dahulu."
        exit 1
    fi
    
    set_peer_env $org "peer0"
    
    peer lifecycle chaincode approveformyorg -o ${IP_ORDERER}:${ORDERER_PORT} --ordererTLSHostnameOverride ${ORDERER_DOMAIN} --channelID $CHANNEL_NAME --name $CHAINCODE_NAME --version $CHAINCODE_VERSION --package-id $PACKAGE_ID --sequence $CHAINCODE_SEQUENCE --tls --cafile "$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem" --signature-policy "$ENDORSEMENT_POLICY"
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode berhasil di-approve untuk $org"
    else
        print_error "✗ Gagal approve chaincode untuk $org"
        exit 1
    fi
}

# Function to approve chaincode for all organizations
approve_chaincode() {
    print_message "Approving chaincode untuk semua organisasi..."
    
    approve_chaincode_for_org "bpsbp"
    approve_chaincode_for_org "disbun"
    
    print_message "✓ Chaincode berhasil di-approve untuk semua organisasi"
}

# Function to check commit readiness
check_commit_readiness() {
    print_message "Checking commit readiness..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode checkcommitreadiness --channelID $CHANNEL_NAME --name $CHAINCODE_NAME --version $CHAINCODE_VERSION --sequence $CHAINCODE_SEQUENCE --tls --cafile "$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem" --signature-policy "$ENDORSEMENT_POLICY" --output json
    
    if [ $? -eq 0 ]; then
        print_message "✓ Commit readiness check berhasil"
    else
        print_error "✗ Commit readiness check gagal"
        exit 1
    fi
}

# Function to commit chaincode
commit_chaincode() {
    print_message "Committing chaincode..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode commit -o ${IP_ORDERER}:${ORDERER_PORT} --ordererTLSHostnameOverride ${ORDERER_DOMAIN} --channelID $CHANNEL_NAME --name $CHAINCODE_NAME --version $CHAINCODE_VERSION --sequence $CHAINCODE_SEQUENCE --tls --cafile "$NETWORK_DIR/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/tls-localhost-${ORDERER_CA_PORT}-ca-orderer.pem" --peerAddresses ${IP_BPSBP}:${BPSBP_PEER0_PORT} --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt" --peerAddresses ${IP_DISBUN}:${DISBUN_PEER0_PORT} --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt" --signature-policy "$ENDORSEMENT_POLICY"
    
    if [ $? -eq 0 ]; then
        print_message "✓ Chaincode berhasil di-commit"
    else
        print_error "✗ Gagal commit chaincode"
        exit 1
    fi
}

# Function to query committed chaincode
query_committed() {
    print_message "Querying committed chaincode..."
    
    cd "$NETWORK_DIR"
    set_peer_env "bpsbp" "peer0"
    
    peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name $CHAINCODE_NAME
    
    if [ $? -eq 0 ]; then
        print_message "✓ Query committed chaincode berhasil"
    else
        print_error "✗ Query committed chaincode gagal"
        exit 1
    fi
}

# Main execution
main() {
    case "$1" in
        "package")
            get_chaincode_version
            package_chaincode
            ;;
        "install")
            get_chaincode_version
            install_chaincode
            ;;
        "query-installed")
            get_chaincode_version
            query_installed
            ;;
        "approve")
            get_chaincode_version
            approve_chaincode
            ;;
        "check-readiness")
            get_chaincode_version
            check_commit_readiness
            ;;
        "commit")
            get_chaincode_version
            commit_chaincode
            ;;
        "query-committed")
            query_committed
            ;;
        "deploy")
            get_chaincode_version
            package_chaincode
            install_chaincode
            query_installed
            update_chaincode_container
            approve_chaincode
            check_commit_readiness
            commit_chaincode
            query_committed
            print_message "✓ Chaincode deployment selesai"
            print_warning "Note: Testing harus dilakukan melalui aplikasi client dengan proper authentication"
            ;;
        "update-cc")
            update_chaincode_container
            ;;
        *)
            print_message "Usage: $0 {package|install|query-installed|update-cc|approve|check-readiness|commit|query-committed|deploy}"
            print_message ""
            print_message "Commands:"
            print_message "  package          - Package chaincode"
            print_message "  install          - Install chaincode pada semua peers"
            print_message "  query-installed  - Query installed chaincode dan dapatkan package ID"
            print_message "  update-cc        - Update CHAINCODE_ID di docker compose dan restart container"
            print_message "  approve          - Approve chaincode untuk semua organisasi"
            print_message "  check-readiness  - Check commit readiness"
            print_message "  commit           - Commit chaincode dengan endorsement policy"
            print_message "  query-committed  - Query committed chaincode"
            print_message "  deploy           - Jalankan semua langkah deployment secara berurutan"
            print_message ""
            print_message "Endorsement Policy: $ENDORSEMENT_POLICY"
            print_message "Note: Version dan Sequence akan auto-increment dari versi terakhir yang tercommit"
            exit 1
            ;;
    esac
    
    print_message "Chaincode deployment step selesai!"
}

# Run main function
main "$@"
