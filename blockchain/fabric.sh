#!/bin/bash
#
# Master Script untuk Hyperledger Fabric Network
# Sistem Sertifikasi Benih Perkebunan - v2.4.7
#

set -e

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

# Function to display help
function print_help() {
    echo "Hyperledger Fabric Network Management"
    echo "====================================="
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy          - Deploy complete network (CA + artifacts + start)"
    echo "  up              - Start the network"
    echo "  down            - Stop the network"
    echo "  restart         - Restart the network"
    echo "  clean           - Clean all artifacts and containers"
    echo "  setup-ca        - Setup Certificate Authority"
    echo "  setup-appuser   - Setup single appUser with combined roles for dApp"
    echo "  generate        - Generate channel artifacts"
    echo "  create-channel  - Create and join channel"
    echo "  status          - Show network status"
    echo "  logs            - Show container logs"
    echo "  help            - Show this help"
    echo ""
    echo "Structure:"
    echo "  network/        - Docker compose and configurations"
    echo "  scripts/        - All automation scripts"
    echo "  chaincode/      - Smart contracts"
}

# Function to run script from scripts directory
run_script() {
    local script_name=$1
    shift
    if [ -f "$SCRIPT_DIR/scripts/$script_name" ]; then
        chmod +x "$SCRIPT_DIR/scripts/$script_name"
        cd "$SCRIPT_DIR"
        "$SCRIPT_DIR/scripts/$script_name" "$@"
    else
        print_error "❌ Script not found: scripts/$script_name"
        exit 1
    fi
}

# Main script logic
case $1 in
    deploy)
        print_message "🚀 Deploying complete Hyperledger Fabric network..."
        run_script "network.sh" deploy
        ;;
    up)
        print_message "🌐 Starting Hyperledger Fabric network..."
        run_script "network.sh" up
        ;;
    down)
        print_message "🛑 Stopping Hyperledger Fabric network..."
        run_script "network.sh" down
        ;;
    restart)
        print_message "🔄 Restarting Hyperledger Fabric network..."
        run_script "network.sh" restart
        ;;
    clean)
        print_message "🧹 Cleaning Hyperledger Fabric network..."
        run_script "network.sh" clean
        ;;
    setup-ca)
        print_message "🔐 Setting up Certificate Authority..."
        run_script "setup-ca-certificates.sh"
        ;;
    setup-appuser)
        print_message "👤 Setting up appUser with combined roles..."
        run_script "setup-identities.sh"
        ;;
    generate)
        print_message "🏗️ Generating channel artifacts..."
        run_script "generate-artifacts.sh"
        ;;
    create-channel)
        print_message "🔗 Creating and joining channel..."
        run_script "create-channel.sh"
        ;;
    status)
        print_message "📊 Network status..."
        run_script "network.sh" status
        ;;
    logs)
        print_message "📋 Container logs..."
        run_script "network.sh" logs
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        if [ -z "$1" ]; then
            print_help
        else
            print_error "❌ Unknown command: $1"
            print_help
            exit 1
        fi
        ;;
esac
