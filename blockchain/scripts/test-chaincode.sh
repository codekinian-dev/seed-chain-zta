#!/bin/bash
#
# Script untuk testing koneksi dan fungsi chaincode
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

# Test Query
test_query() {
    print_message "==========================================="
    print_message "TEST QUERY: queryAllSeedBatches"
    print_message "==========================================="
    
    docker exec cli peer chaincode query -C $CHANNEL_NAME -n $CHAINCODE_NAME -c '{"Args":["queryAllSeedBatches"]}'
    
    if [ $? -eq 0 ]; then
        print_message "✓ Query berhasil"
    else
        print_error "✗ Query gagal"
        exit 1
    fi
}

# Test Invoke
test_invoke() {
    print_message "==========================================="
    print_message "TEST INVOKE: createSeedBatch"
    print_message "==========================================="
    
    # Generate random ID untuk menghindari duplikasi
    BATCH_ID="BATCH-TEST-$(date +%s)"
    
    print_message "Creating Seed Batch with ID: $BATCH_ID"
    print_message "Orderer: ${ORDERER_DOMAIN}:${ORDERER_PORT}"
    
    docker exec cli peer chaincode invoke \
        -o ${ORDERER_DOMAIN}:${ORDERER_PORT} \
        --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/${DOMAIN_SUFFIX}/orderers/${ORDERER_DOMAIN}/tls/ca.crt \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        --peerAddresses pusat.${BPSBP_DOMAIN}:${BPSBP_PEER0_PORT} --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${BPSBP_DOMAIN}/peers/pusat.${BPSBP_DOMAIN}/tls/ca.crt \
        --peerAddresses sekretariat.${DISBUN_DOMAIN}:${DISBUN_PEER0_PORT} --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${DISBUN_DOMAIN}/peers/sekretariat.${DISBUN_DOMAIN}/tls/ca.crt \
        -c "{\"Args\":[\"createSeedBatch\", \"$BATCH_ID\", \"Varietas Test\", \"Komoditas Test\", \"2025-01-01\", \"SRC-001\", \"Bandung\", \"IUP-001\", \"BR\", \"PROD-UUID-001\", \"DocName\", \"IPFS-CID\"]}"
        
    if [ $? -eq 0 ]; then
        print_message "✓ Invoke berhasil"
        
        # Verifikasi data tersimpan
        print_message "Verifying data..."
        sleep 2
        docker exec cli peer chaincode query -C $CHANNEL_NAME -n $CHAINCODE_NAME -c "{\"Args\":[\"querySeedBatch\", \"$BATCH_ID\"]}"
    else
        print_error "✗ Invoke gagal"
        exit 1
    fi
}

# Main execution
main() {
    case "$1" in
        "query")
            test_query
            ;;
        "invoke")
            test_invoke
            ;;
        "all")
            test_query
            test_invoke
            ;;
        *)
            print_message "Usage: $0 {query|invoke|all}"
            exit 1
            ;;
    esac
}

main "${1:-all}"
