#!/bin/bash

# Test Docker Build and Run Script
# This script helps diagnose Docker startup issues

set -e

echo "========================================="
echo "  Docker Build & Test Script"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Check .env.docker.local
echo "Step 1: Checking .env.docker.local..."
if [ ! -f ".env.docker.local" ]; then
    echo -e "${RED}✗ .env.docker.local not found${NC}"
    exit 1
fi

# Check for critical variables
REQUIRED_VARS=(
    "NODE_ENV"
    "PORT"
    "KEYCLOAK_URL"
    "REDIS_HOST"
    "FABRIC_CHANNEL"
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env.docker.local; then
        echo -e "${RED}✗ Missing: $var${NC}"
        MISSING=1
    else
        VALUE=$(grep "^${var}=" .env.docker.local | cut -d'=' -f2)
        echo -e "${GREEN}✓ $var=$VALUE${NC}"
    fi
done

if [ $MISSING -eq 1 ]; then
    echo -e "${RED}Please fix .env.docker.local${NC}"
    exit 1
fi

echo ""

# Step 2: Stop existing containers
echo "Step 2: Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Step 3: Build image
echo "Step 3: Building Docker image..."
docker-compose -f docker-compose.prod.yml build api-gateway
echo -e "${GREEN}✓ Image built${NC}"
echo ""

# Step 4: Start Redis first
echo "Step 4: Starting Redis..."
docker-compose -f docker-compose.prod.yml up -d redis
echo "Waiting for Redis to be healthy..."
sleep 5

if docker ps | grep -q "seed-redis-prod"; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis failed to start${NC}"
    docker logs seed-redis-prod
    exit 1
fi
echo ""

# Step 5: Test run API Gateway (not detached)
echo "Step 5: Starting API Gateway (showing logs)..."
echo "Press Ctrl+C to stop"
echo "========================================="
echo ""

# Run container and capture output
docker-compose -f docker-compose.prod.yml up api-gateway

# If we get here, container exited
echo ""
echo "========================================="
echo -e "${RED}Container exited${NC}"
echo ""
echo "Last 50 lines of logs:"
docker logs seed-api-gateway-prod --tail 50
