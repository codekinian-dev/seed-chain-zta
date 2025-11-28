#!/bin/bash

# Quick VPS Setup Script
# This script helps you quickly deploy the Seed API Gateway on VPS

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "========================================="
echo "  Seed API Gateway - VPS Quick Setup"
echo "========================================="
echo -e "${NC}"

# Check if .env.docker.local exists
if [ -f ".env.docker.local" ]; then
    echo -e "${YELLOW}Warning: .env.docker.local already exists${NC}"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing .env.docker.local"
        USE_EXISTING=true
    fi
fi

if [ "$USE_EXISTING" != true ]; then
    echo -e "${BLUE}Step 1: Generating environment file...${NC}"
    
    # Get VPS IP
    echo "Detecting VPS IP address..."
    VPS_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}' || echo "")
    
    if [ -z "$VPS_IP" ]; then
        echo -e "${YELLOW}Could not auto-detect VPS IP${NC}"
        read -p "Enter your VPS IP or domain: " VPS_IP
    else
        echo "Detected VPS IP: $VPS_IP"
        read -p "Is this correct? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            read -p "Enter your VPS IP or domain: " VPS_IP
        fi
    fi
    
    # Generate secrets
    echo "Generating secure secrets..."
    # KEYCLOAK_SECRET=$(openssl rand -hex 32)
    KEYCLOAK_SECRET="E9BYWOE5NW6TSgT2XvJG7wzfJbA2kK15"
    SESSION_SECRET=$(openssl rand -base64 32)
    
    echo -e "${GREEN}✓ Secrets generated${NC}"
    
    # Create .env.docker.local
    echo "Creating .env.docker.local..."
    cp .env.docker.template .env.docker.local
    
    # Replace placeholders
    sed -i.bak "s|KEYCLOAK_URL=http://YOUR_VPS_IP:8080|KEYCLOAK_URL=http://${VPS_IP}:8080|g" .env.docker.local
    sed -i.bak "s|IPFS_HOST=YOUR_VPS_IP|IPFS_HOST=${VPS_IP}|g" .env.docker.local
    sed -i.bak "s|KEYCLOAK_CLIENT_SECRET=REPLACE_WITH_YOUR_KEYCLOAK_CLIENT_SECRET|KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_SECRET}|g" .env.docker.local
    sed -i.bak "s|SESSION_SECRET=REPLACE_WITH_YOUR_SESSION_SECRET|SESSION_SECRET=${SESSION_SECRET}|g" .env.docker.local
    
    rm -f .env.docker.local.bak
    
    echo -e "${GREEN}✓ Environment file created${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Save these credentials securely!${NC}"
    echo "KEYCLOAK_CLIENT_SECRET: $KEYCLOAK_SECRET"
    echo "SESSION_SECRET: $SESSION_SECRET"
    echo ""
    echo "These have been saved to .env.docker.local"
    echo ""
fi

# Check prerequisites
echo -e "${BLUE}Step 2: Checking prerequisites...${NC}"

MISSING=false

if [ ! -d "wallet" ] || [ -z "$(ls -A wallet)" ]; then
    echo -e "${RED}✗ Wallet directory is empty or missing${NC}"
    echo "  You need to setup Fabric wallet first"
    MISSING=true
else
    echo -e "${GREEN}✓ Wallet found${NC}"
fi

if [ ! -f "config/connection-profile.json" ]; then
    echo -e "${RED}✗ Connection profile missing${NC}"
    echo "  You need config/connection-profile.json"
    MISSING=true
else
    echo -e "${GREEN}✓ Connection profile found${NC}"
fi

if [ ! -d "crypto-config" ]; then
    echo -e "${YELLOW}⚠ crypto-config directory missing${NC}"
    echo "  Creating empty directory (you may need to add TLS certificates)"
    mkdir -p crypto-config
else
    echo -e "${GREEN}✓ crypto-config found${NC}"
fi

if [ "$MISSING" = true ]; then
    echo ""
    echo -e "${RED}Cannot proceed: Missing required files${NC}"
    echo "Please setup Fabric wallet and connection profile first"
    exit 1
fi

# Create necessary directories
echo -e "${BLUE}Step 3: Creating directories...${NC}"
mkdir -p logs uploads
echo -e "${GREEN}✓ Directories created${NC}"

# Build and start
echo ""
echo -e "${BLUE}Step 4: Building Docker images...${NC}"
docker compose -f docker-compose.prod.yml build

echo ""
echo -e "${BLUE}Step 5: Starting services...${NC}"
docker compose -f docker-compose.prod.yml up -d
echo ""
echo -e "${BLUE}Step 6: Waiting for services to be healthy...${NC}"
sleep 10

# Check status
echo ""
docker compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}========================================="
echo "  Deployment Complete!"
echo "=========================================${NC}"
echo ""
echo "Service Status:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""
echo "Next steps:"
echo "1. Check logs:        docker compose -f docker-compose.prod.yml logs -f"
echo "2. Test health:       curl http://localhost:3001/api/health/liveness"
echo "3. View API docs:     http://${VPS_IP}:3001/api-docs"
echo "4. Run diagnostics:   ./scripts/vps-diagnose.sh"
echo ""
echo "If the container keeps restarting, check:"
echo "- docker logs seed-api-gateway-prod"
echo "- Make sure Keycloak is running at http://${VPS_IP}:8080"
echo "- Make sure Fabric network is accessible"
echo "- Make sure IPFS is running at http://${VPS_IP}:9094"
echo ""

# Show initial logs
echo "Recent logs from API Gateway:"
echo "-----------------------------------"
docker logs seed-api-gateway-prod --tail 30 2>&1 || true
echo ""
