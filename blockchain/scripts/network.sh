#!/bin/bash
#
# Hyperledger Fabric Network Management Script
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

# Function to display help
function print_help() {
    echo "Usage: $0 [COMMAND]"
    echo "Commands:"
    echo "  deploy  - Deploy complete network (CA setup + artifacts + start)"
    echo "  up      - Start the Hyperledger Fabric network"
    echo "  down    - Stop the Hyperledger Fabric network"
    echo "  restart - Restart the Hyperledger Fabric network"
    echo "  clean   - Clean all network artifacts and containers"
    echo "  status  - Show network status"
    echo "  logs    - Show container logs"
    echo "  setup-ca - Setup Certificate Authority and generate certificates"
    echo "  generate-artifacts - Generate channel artifacts"
    echo "  help    - Show this help message"
}

# Function to setup CA and generate certificates
function setup_ca() {
    print_message "🔐 Setting up Certificate Authority..."
    
    if [ ! -f "$SCRIPT_DIR/setup-ca-certificates.sh" ]; then
        print_error "❌ setup-ca-certificates.sh not found!"
        exit 1
    fi
    
    chmod +x "$SCRIPT_DIR/setup-ca-certificates.sh"
    "$SCRIPT_DIR/setup-ca-certificates.sh"
}

# Function to generate channel artifacts
function generate_artifacts() {
    print_message "🏗️ Generating channel artifacts..."
    
    if [ ! -f "$SCRIPT_DIR/generate-artifacts.sh" ]; then
        print_error "❌ generate-artifacts.sh not found!"
        exit 1
    fi
    
    chmod +x "$SCRIPT_DIR/generate-artifacts.sh"
    "$SCRIPT_DIR/generate-artifacts.sh"
}

# Function to deploy complete network
function network_deploy() {
    print_message "🚀 Deploying complete Hyperledger Fabric network..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "❌ Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Step 1: Setup CA and generate certificates
    setup_ca
    
    # Step 2: Generate channel artifacts
    generate_artifacts
    
    # Step 3: Start the full network
    print_message "🌐 Starting peer and orderer containers..."
    cd "$NETWORK_DIR"
    docker compose up -d
    
    # Wait for containers to start
    print_message "⏳ Waiting for containers to initialize..."
    sleep 15
    
    # Show status
    docker compose ps
    
    print_message "✅ Network deployed successfully!"
    print_message "📋 Next steps:"
    print_message "   1. Create and join channel"
    print_message "   2. Deploy chaincode"
    print_message "   3. Test network functionality"
}

# Function to start the network
function network_up() {
    print_message "🚀 Starting Hyperledger Fabric network..."
    
    cd "$NETWORK_DIR"
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "❌ Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if certificates exist
    if [ ! -d "$NETWORK_DIR/organizations/peerOrganizations" ]; then
        print_warning "⚠️ Certificates not found. Running setup first..."
        setup_ca
        generate_artifacts
    fi
    
    # Start the network
    docker compose up -d
    
    # Wait for containers to start
    print_message "⏳ Waiting for containers to initialize..."
    sleep 10
    
    # Show status
    docker compose ps
    
    print_message "✅ Network started successfully!"
}

# Function to stop the network
function network_down() {
    print_message "🛑 Stopping Hyperledger Fabric network..."
    
    cd "$NETWORK_DIR"
    docker compose down
    
    print_message "✅ Network stopped successfully!"
}

# Function to restart the network
function network_restart() {
    print_message "🔄 Restarting Hyperledger Fabric network..."
    network_down
    sleep 5
    network_up
}

# Function to clean the network
function network_clean() {
    print_message "🧹 Cleaning Hyperledger Fabric network..."
    
    cd "$NETWORK_DIR"
    
    # Stop and remove containers
    docker compose down -v --remove-orphans
    
    # Remove Docker images related to the network
    docker rmi $(docker images 'dev-*' -q) 2>/dev/null || true
    
    # Clean up file system
    sudo rm -rf "$NETWORK_DIR/organizations/peerOrganizations" 2>/dev/null || true
    sudo rm -rf "$NETWORK_DIR/organizations/ordererOrganizations" 2>/dev/null || true
    sudo rm -rf "$NETWORK_DIR/organizations/fabric-ca" 2>/dev/null || true
    sudo rm -rf "$NETWORK_DIR/system-genesis-block"/* 2>/dev/null || true
    sudo rm -rf "$NETWORK_DIR/channel-artifacts"/* 2>/dev/null || true
    
    print_message "✅ Network cleaned successfully!"
}

# Function to show network status
function network_status() {
    print_message "📊 Hyperledger Fabric network status:"
    
    cd "$NETWORK_DIR"
    docker compose ps
}

# Function to show container logs
function network_logs() {
    print_message "📋 Container logs:"
    
    cd "$NETWORK_DIR"
    docker compose logs -f
}

# Function to setup application
function setup_application() {
    print_message "Setup aplikasi client..."
    
    cd "$SCRIPT_DIR/../application"
    
    # Install dependencies
    print_message "Installing npm dependencies..."
    npm install
    
    # Setup admin and user for both organizations
    print_message "Setup admin dan user untuk BPSBP..."
    node enrollAdmin.js bpsbp
    node registerUser.js appUser bpsbp
    
    print_message "Setup admin dan user untuk Disbun..."
    node enrollAdmin.js disbun
    node registerUser.js appUser disbun
    
    print_message "✓ Setup aplikasi selesai"
}

# Function to start application
function start_application() {
    print_message "Menjalankan REST API server..."
    
    cd "$SCRIPT_DIR/../application"
    
    print_message "Starting Express.js server..."
    npm start &
    
    sleep 5
    
    print_message "✓ REST API server berjalan di http://localhost:3000"
    print_message "Dokumentasi API tersedia di endpoint /api/health"
}

# Main script logic
case $1 in
    deploy)
        network_deploy
        ;;
    up)
        network_up
        ;;
    down)
        network_down
        ;;
    restart)
        network_restart
        ;;
    clean)
        network_clean
        ;;
    status)
        network_status
        ;;
    logs)
        network_logs
        ;;
    setup-ca)
        setup_ca
        ;;
    generate-artifacts)
        generate_artifacts
        ;;
    app-setup)
        setup_application
        ;;
    app-start)
        start_application
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        print_error "❌ Unknown command: $1"
        print_help
        exit 1
        ;;
esac

# Function to start the network
network_up() {
    print_message "Memulai jaringan Hyperledger Fabric..."
    
    cd "$NETWORK_DIR"
    
    # Start docker containers
    print_message "Starting Docker containers..."
    docker compose up -d
    
    # Wait for services to be ready
    print_message "Menunggu services siap..."
    sleep 30
    
    print_message "✓ Jaringan berhasil dimulai"
    print_message "CA Services:"
    print_message "  - BPSBP CA: https://${IP_CA}:${BPSBP_CA_PORT}"
    print_message "  - Disbun CA: https://${IP_CA}:${DISBUN_CA_PORT}"
    print_message "  - Orderer CA: https://${IP_CA}:${ORDERER_CA_PORT}"
    print_message ""
    print_message "Peer Services:"
    print_message "  - pusat.bpsbp: ${IP_BPSBP}:${BPSBP_PEER0_PORT}"
    print_message "  - cert.bpsbp: ${IP_BPSBP}:${BPSBP_PEER1_PORT}"
    print_message "  - pusat.disbun: ${IP_DISBUN}:${DISBUN_PEER0_PORT}"
    print_message "  - digital.disbun: ${IP_DISBUN}:${DISBUN_PEER1_PORT}"
    print_message ""
    print_message "Orderer Services:"
    print_message "  - ${ORDERER_DOMAIN}: ${IP_ORDERER}:${ORDERER_PORT}"
    print_message "  - chain-orderer2.${DOMAIN_SUFFIX}: ${IP_ORDERER2}:${ORDERER2_PORT}"
    print_message "  - chain-orderer3.${DOMAIN_SUFFIX}: ${IP_ORDERER3}:${ORDERER3_PORT}"
}

# Function to stop the network
network_down() {
    print_message "Menghentikan jaringan Hyperledger Fabric..."
    
    cd "$NETWORK_DIR"
    
    # Stop and remove containers
    docker compose down
    
    # Remove volumes
    docker volume prune -f
    
    print_message "✓ Jaringan berhasil dihentikan"
}

# Function to setup certificates
setup_certificates() {
    print_message "Setup sertifikat menggunakan Fabric CA..."
    
    # Run CA setup script
    "$SCRIPT_DIR/setup-ca-certificates.sh" generate
    
    print_message "✓ Setup sertifikat selesai"
}

# Function to setup channel
setup_channel() {
    print_message "Setup channel dan genesis block..."
    
    # Run channel setup script
    "$SCRIPT_DIR/generate-artifacts.sh" all
    
    print_message "✓ Setup channel selesai"
}

# Function to deploy chaincode
deploy_chaincode() {
    print_message "Deploy chaincode dengan endorsement policy..."
    
    # Run chaincode deployment script
    "$SCRIPT_DIR/deploy-chaincode.sh" deploy
    
    print_message "✓ Deploy chaincode selesai"
}

# Function to run demo
run_demo() {
    print_message "Menjalankan demo transaksi..."
    
    # Run transaction examples
    "$SCRIPT_DIR/transaction-examples.sh" demo
    
    print_message "✓ Demo transaksi selesai"
}

# Function to setup application
setup_application() {
    print_message "Setup aplikasi client..."
    
    cd "$SCRIPT_DIR/../application"
    
    # Install dependencies
    print_message "Installing npm dependencies..."
    npm install
    
    # Setup admin and user for both organizations
    print_message "Setup admin dan user untuk BPSBP..."
    node enrollAdmin.js bpsbp
    node registerUser.js appUser bpsbp
    
    print_message "Setup admin dan user untuk Disbun..."
    node enrollAdmin.js disbun
    node registerUser.js appUser disbun
    
    print_message "✓ Setup aplikasi selesai"
}

# Function to start application
start_application() {
    print_message "Menjalankan REST API server..."
    
    cd "$SCRIPT_DIR/../application"
    
    print_message "Starting Express.js server..."
    npm start &
    
    sleep 5
    
    print_message "✓ REST API server berjalan di http://localhost:3000"
    print_message "Dokumentasi API tersedia di endpoint /api/health"
}

# Function to check network status
check_status() {
    print_message "Memeriksa status jaringan..."
    
    cd "$NETWORK_DIR"
    
    print_message "Docker containers:"
    docker-compose ps
    
    print_message "\nDocker networks:"
    docker network ls | grep fabric
    
    print_message "\nDocker volumes:"
    docker volume ls | grep -E "(peer|orderer)"
    
    print_message "✓ Status check selesai"
}

# Function to clean everything
clean_all() {
    print_message "Membersihkan semua data dan containers..."
    
    cd "$NETWORK_DIR"
    
    # Stop containers
    docker compose down -v
    
    # Remove all fabric-related containers
    docker rm -f $(docker ps -aq --filter name=peer) 2>/dev/null || true
    docker rm -f $(docker ps -aq --filter name=orderer) 2>/dev/null || true
    docker rm -f $(docker ps -aq --filter name=ca_) 2>/dev/null || true
    docker rm -f $(docker ps -aq --filter name=cli) 2>/dev/null || true
    
    # Remove all fabric-related volumes
    docker volume rm $(docker volume ls -q --filter name=peer) 2>/dev/null || true
    docker volume rm $(docker volume ls -q --filter name=orderer) 2>/dev/null || true
    
    # Remove generated artifacts
    rm -rf organizations/peerOrganizations
    rm -rf organizations/ordererOrganizations
    rm -rf system-genesis-block
    rm -rf channel-artifacts
    rm -rf *.tar.gz
    rm -rf package_id.txt
    
    # Clean application wallet
    rm -rf "$ROOT_DIR/application/wallet"
    
    print_message "✓ Cleanup selesai"
}

# Function untuk full deployment
full_deploy() {
    print_message "Memulai full deployment sistem sertifikasi benih..."
    
    # 1. Clean previous deployment
    clean_all
    
    # 2. Setup CA structure
    "$SCRIPT_DIR/setup-ca-certificates.sh"
    
    # 3. Start network
    network_up
    
    # 4. Setup certificates
    setup_certificates
    
    # 5. Setup channel
    setup_channel
    
    # 6. Deploy chaincode
    deploy_chaincode
    
    # 7. Setup application
    setup_application
    
    # 8. Run demo
    run_demo
    
    print_message "=============================================="
    print_message "✓ FULL DEPLOYMENT SELESAI!"
    print_message "=============================================="
    print_message "Jaringan Hyperledger Fabric siap digunakan:"
    print_message ""
    print_message "Untuk menjalankan REST API server:"
    print_message "  cd application && npm start"
    print_message ""
    print_message "Untuk menjalankan contoh transaksi:"
    print_message "  ./scripts/transaction-examples.sh demo"
    print_message ""
    print_message "Untuk memeriksa status:"
    print_message "  ./network.sh status"
    print_message "=============================================="
}

# Function to show help
show_help() {
    print_message "Usage: $0 {up|down|clean|deploy|status|demo|app-setup|app-start}"
    print_message ""
    print_message "Commands:"
    print_message "  up          - Start jaringan Fabric (tanpa setup)"
    print_message "  down        - Stop jaringan Fabric"
    print_message "  clean       - Bersihkan semua data dan containers"
    print_message "  deploy      - Full deployment dari awal"
    print_message "  certificates - Setup sertifikat CA"
    print_message "  channel     - Setup channel dan genesis block"
    print_message "  chaincode   - Deploy chaincode"
    print_message "  status      - Periksa status jaringan"
    print_message "  demo        - Jalankan demo transaksi"
    print_message "  app-setup   - Setup aplikasi client"
    print_message "  app-start   - Start REST API server"
    print_message ""
    print_message "Contoh penggunaan:"
    print_message "  $0 deploy     # Full deployment dari awal"
    print_message "  $0 up         # Start jaringan yang sudah di-setup"
    print_message "  $0 demo       # Jalankan demo transaksi"
    print_message "  $0 clean      # Bersihkan semua"
}

# Main execution
main() {
    case "$1" in
        "up")
            network_up
            ;;
        "down")
            network_down
            ;;
        "clean")
            clean_all
            ;;
        "deploy")
            full_deploy
            ;;
        "certificates")
            setup_certificates
            ;;
        "channel")
            setup_channel
            ;;
        "chaincode")
            deploy_chaincode
            ;;
        "status")
            check_status
            ;;
        "demo")
            run_demo
            ;;
        "app-setup")
            setup_application
            ;;
        "app-start")
            start_application
            ;;
        *)
            show_help
            ;;
    esac
}

# Run main function
main "$@"
