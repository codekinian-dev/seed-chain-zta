#!/bin/bash

# VPS Deployment Helper Script
# This script helps diagnose and fix common Docker deployment issues on VPS

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "  Seed API Gateway - VPS Diagnosis Tool"
echo "========================================="
echo ""

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_warning "Running as root. Consider using a non-root user with docker permissions."
fi

# 1. Check Docker installation
echo "1. Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker installed: $DOCKER_VERSION"
else
    print_error "Docker is not installed"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_success "Docker Compose installed: $COMPOSE_VERSION"
else
    print_error "Docker Compose is not installed"
    exit 1
fi

echo ""

# 2. Check required files
echo "2. Checking required files..."
FILES=(
    ".env.docker.local"
    "docker-compose.prod.yml"
    "Dockerfile"
    "wallet"
    "config/connection-profile.json"
)

for file in "${FILES[@]}"; do
    if [ -e "$file" ]; then
        print_success "Found: $file"
    else
        print_error "Missing: $file"
        if [ "$file" == ".env.docker.local" ]; then
            echo "   Run: cp .env.docker.template .env.docker.local"
            echo "   Then edit .env.docker.local with your values"
        fi
    fi
done

echo ""

# 3. Check directory permissions
echo "3. Checking directory permissions..."
DIRS=("wallet" "logs" "uploads" "crypto-config")

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        PERMS=$(stat -c "%a %U:%G" "$dir" 2>/dev/null || stat -f "%Lp %Su:%Sg" "$dir" 2>/dev/null)
        print_success "$dir: $PERMS"
    else
        print_warning "$dir: directory does not exist"
        mkdir -p "$dir"
        print_success "Created: $dir"
    fi
done

echo ""

# 4. Check port availability
echo "4. Checking port availability..."
PORTS=(3001 6379)

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        PID=$(lsof -Pi :$port -sTCP:LISTEN -t)
        PROCESS=$(ps -p $PID -o comm=)
        print_warning "Port $port is in use by PID $PID ($PROCESS)"
    else
        print_success "Port $port is available"
    fi
done

echo ""

# 5. Check environment variables
echo "5. Checking environment variables in .env.docker.local..."
if [ -f ".env.docker.local" ]; then
    REQUIRED_VARS=(
        "KEYCLOAK_URL"
        "KEYCLOAK_CLIENT_SECRET"
        "SESSION_SECRET"
        "FABRIC_CHANNEL"
        "IPFS_HOST"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env.docker.local && ! grep -q "^${var}=.*YOUR_VPS_IP" .env.docker.local && ! grep -q "^${var}=.*REPLACE" .env.docker.local; then
            print_success "$var is set"
        else
            print_error "$var is not configured properly"
        fi
    done
else
    print_error ".env.docker.local not found"
fi

echo ""

# 6. Check Docker containers status
echo "6. Checking Docker containers..."
if docker ps -a | grep -q "seed"; then
    echo ""
    docker ps -a --filter "name=seed" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
else
    print_warning "No seed containers found"
fi

echo ""

# 7. Check container logs if exists
echo "7. Recent container logs..."
if docker ps -a | grep -q "seed-api-gateway"; then
    echo ""
    echo "Last 20 lines of api-gateway logs:"
    echo "-----------------------------------"
    docker logs seed-api-gateway-prod --tail 20 2>&1 || docker logs seed-api-gateway --tail 20 2>&1
    echo ""
else
    print_warning "API Gateway container not found"
fi

echo ""

# 8. Check disk space
echo "8. Checking disk space..."
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    print_success "Disk usage: ${DISK_USAGE}%"
else
    print_error "Disk usage is high: ${DISK_USAGE}%"
fi

echo ""

# 9. Check memory
echo "9. Checking memory..."
if [ -f /proc/meminfo ]; then
    TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    AVAIL_MEM=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    TOTAL_MB=$((TOTAL_MEM / 1024))
    AVAIL_MB=$((AVAIL_MEM / 1024))
    
    if [ "$AVAIL_MB" -gt 500 ]; then
        print_success "Available memory: ${AVAIL_MB}MB / ${TOTAL_MB}MB"
    else
        print_warning "Low memory: ${AVAIL_MB}MB available"
    fi
fi

echo ""

# 10. Network connectivity check
echo "10. Checking network connectivity..."

# Check if host.docker.internal works
if docker run --rm alpine ping -c 1 host.docker.internal &> /dev/null; then
    print_success "host.docker.internal is reachable from containers"
else
    print_warning "host.docker.internal may not work (this is normal on Linux)"
fi

echo ""

# Diagnostic Summary
echo "========================================="
echo "  Diagnostic Complete"
echo "========================================="
echo ""

# Offer quick actions
echo "Quick Actions:"
echo "1. View full logs:          docker-compose -f docker-compose.prod.yml logs -f"
echo "2. Restart containers:      docker-compose -f docker-compose.prod.yml restart"
echo "3. Rebuild and restart:     docker-compose -f docker-compose.prod.yml up -d --build"
echo "4. Stop all:                docker-compose -f docker-compose.prod.yml down"
echo "5. Check health:            docker inspect seed-api-gateway-prod | grep -A 10 Health"
echo ""

# Save diagnostic report
REPORT_FILE="diagnostic-report-$(date +%Y%m%d-%H%M%S).txt"
echo "Saving full diagnostic report to: $REPORT_FILE"
{
    echo "Diagnostic Report - $(date)"
    echo "=========================================="
    echo ""
    echo "System Info:"
    uname -a
    echo ""
    echo "Docker Info:"
    docker info
    echo ""
    echo "Docker Compose Config:"
    docker-compose -f docker-compose.prod.yml config
    echo ""
    echo "Container Status:"
    docker ps -a
    echo ""
    echo "Container Logs (last 100 lines):"
    docker logs seed-api-gateway-prod --tail 100 2>&1 || docker logs seed-api-gateway --tail 100 2>&1 || echo "No logs available"
} > "$REPORT_FILE"

print_success "Report saved to: $REPORT_FILE"
echo ""
