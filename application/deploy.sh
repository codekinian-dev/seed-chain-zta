#!/bin/bash

# Docker Deployment Script for Seed Certification API Gateway

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_info "✓ Docker is installed"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_info "✓ Docker Compose is installed"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    print_info "✓ Docker daemon is running"
}

# Check wallet
check_wallet() {
    print_info "Checking wallet..."
    
    if [ ! -f "wallet/appUser.id" ]; then
        print_warn "Wallet not found. Running setup script..."
        
        # Check if Node.js is available
        if ! command -v node &> /dev/null; then
            print_error "Node.js is not installed. Please install Node.js to setup wallet."
            exit 1
        fi
        
        # Run Node.js wallet setup script
        if [ -f "scripts/setup-wallet.js" ]; then
            node scripts/setup-wallet.js
            if [ $? -eq 0 ]; then
                print_info "✓ Wallet setup completed"
            else
                print_error "Wallet setup failed"
                exit 1
            fi
        else
            print_error "Wallet setup script not found at scripts/setup-wallet.js"
            exit 1
        fi
    else
        print_info "✓ Wallet exists (appUser.id)"
    fi
}

# Setup environment
setup_env() {
    print_info "Setting up environment..."

    cp -r ../blockchain/network/organizations/ordererOrganizations/jabarchain.me crypto-config/ordererOrganizations/ && cp -r ../blockchain/network/organizations/peerOrganizations/chain-bpsbp.jabarchain.me crypto-config/peerOrganizations/
    
    if [ ! -f ".env.docker.local" ]; then
        if [ -f ".env.docker" ]; then
            cp .env.docker .env.docker.local
            print_warn "Created .env.docker.local from template"
            print_warn "Please edit .env.docker.local and set:"
            print_warn "  - KEYCLOAK_CLIENT_SECRET"
            print_warn "  - SESSION_SECRET"
            print_warn "  - CORS_ORIGIN"
            read -p "Press Enter after editing .env.docker.local to continue..."
        else
            print_error ".env.docker template not found"
            exit 1
        fi
    else
        print_info "✓ .env.docker.local exists"
    fi
    
    # Validate required variables
    source .env.docker.local
    
    if [ -z "$KEYCLOAK_CLIENT_SECRET" ] || [ "$KEYCLOAK_CLIENT_SECRET" = "your-keycloak-client-secret-here" ]; then
        print_error "KEYCLOAK_CLIENT_SECRET not set in .env.docker.local"
        exit 1
    fi
    
    if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "your-session-secret-here" ]; then
        print_error "SESSION_SECRET not set in .env.docker.local"
        print_info "Generate with: openssl rand -base64 32"
        exit 1
    fi
    
    print_info "✓ Environment variables validated"
}

# Create directories
create_directories() {
    print_info "Creating directories..."
    
    mkdir -p logs uploads wallet
    print_info "✓ Directories created"
}

# Build Docker image
build_image() {
    print_info "Building Docker image..."
    
    if [ "$1" = "--no-cache" ]; then
        docker-compose build --no-cache
    else
        docker-compose build
    fi
    
    if [ $? -eq 0 ]; then
        print_info "✓ Docker image built successfully"
    else
        print_error "Docker image build failed"
        exit 1
    fi
}

# Start services
start_services() {
    print_info "Starting services..."
    
    docker-compose --env-file .env.docker.local up -d
    
    if [ $? -eq 0 ]; then
        print_info "✓ Services started"
    else
        print_error "Failed to start services"
        exit 1
    fi
}

# Check health
check_health() {
    print_info "Waiting for services to be healthy..."
    
    # Wait for API Gateway to start
    sleep 10
    
    # Check Redis
    print_info "Checking Redis..."
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        print_info "✓ Redis is healthy"
    else
        print_warn "Redis health check failed"
    fi
    
    # Check API Gateway
    print_info "Checking API Gateway..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s http://localhost:3001/api/health/liveness &> /dev/null; then
            print_info "✓ API Gateway is healthy"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "API Gateway health check timeout"
        print_info "Check logs with: docker-compose logs api-gateway"
        exit 1
    fi
    
    # Full health check
    print_info "Running full health check..."
    response=$(curl -s http://localhost:3001/api/health)
    echo "$response" | jq .
    
    if echo "$response" | jq -e '.status == "healthy"' &> /dev/null; then
        print_info "✓ All services are healthy"
    else
        print_warn "Some services may be degraded. Check health status above."
    fi
}

# Show status
show_status() {
    print_info "Services status:"
    docker-compose ps
    
    print_info "\nView logs with:"
    echo "  docker-compose logs -f api-gateway"
    echo "  docker-compose logs -f redis"
    
    print_info "\nAccess API:"
    echo "  Health: http://localhost:3001/api/health"
    echo "  API: http://localhost:3001/api/seed-batches"
}

# Stop services
stop_services() {
    print_info "Stopping services..."
    docker-compose down
    print_info "✓ Services stopped"
}

# Clean everything
clean_all() {
    print_warn "This will remove all containers, volumes, and images"
    read -p "Are you sure? (y/N): " confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        print_info "Cleaning up..."
        docker-compose down -v
        docker system prune -f
        print_info "✓ Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Main script
main() {
    echo "=========================================="
    echo "  Seed Certification API Gateway"
    echo "  Docker Deployment Script"
    echo "=========================================="
    echo ""
    
    case "$1" in
        setup)
            check_prerequisites
            check_wallet
            setup_env
            create_directories
            print_info "\n✓ Setup completed. Run './deploy.sh start' to build and start services."
            ;;
        build)
            check_prerequisites
            build_image "$2"
            ;;
        start)
            check_prerequisites
            check_wallet
            setup_env
            create_directories
            build_image
            start_services
            check_health
            show_status
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            start_services
            check_health
            ;;
        status)
            show_status
            ;;
        logs)
            if [ -n "$2" ]; then
                docker-compose logs -f "$2"
            else
                docker-compose logs -f api-gateway
            fi
            ;;
        health)
            check_health
            ;;
        clean)
            clean_all
            ;;
        *)
            echo "Usage: $0 {setup|build|start|stop|restart|status|logs|health|clean}"
            echo ""
            echo "Commands:"
            echo "  setup     - Setup environment and wallet"
            echo "  build     - Build Docker image (use --no-cache for full rebuild)"
            echo "  start     - Build and start all services"
            echo "  stop      - Stop all services"
            echo "  restart   - Restart all services"
            echo "  status    - Show services status"
            echo "  logs      - Show logs (default: api-gateway, or specify service)"
            echo "  health    - Check health of all services"
            echo "  clean     - Stop and remove all containers, volumes, and images"
            echo ""
            echo "Examples:"
            echo "  $0 setup"
            echo "  $0 build --no-cache"
            echo "  $0 start"
            echo "  $0 logs redis"
            exit 1
            ;;
    esac
}

main "$@"
