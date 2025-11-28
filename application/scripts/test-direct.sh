#!/bin/bash

# Direct Docker Run Test (bypass docker-compose)
# This helps identify if the issue is with docker-compose config or the app itself

echo "========================================="
echo "  Direct Docker Test"
echo "========================================="
echo ""

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null

# Build image
echo "Building image..."
docker build -t seed-api-test .

echo ""
echo "Starting Redis..."
docker run -d --name test-redis \
  --network bridge \
  redis:7-alpine

sleep 3

echo ""
echo "========================================="
echo "Running API Gateway with verbose output"
echo "========================================="
echo ""

# Run container interactively with full environment
docker run --rm -it \
  --name test-api-gateway \
  --network bridge \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e KEYCLOAK_URL=http://host.docker.internal:6080 \
  -e KEYCLOAK_REALM=SeedCertificationRealm \
  -e KEYCLOAK_CLIENT_ID=seed-cert-frontend \
  -e KEYCLOAK_CLIENT_SECRET=unUALbPfKb1CuP8QVjePHABdiI8mjAYS \
  -e SESSION_SECRET=MIm5M5xj9pdP2zTd6e4HJRD1ugRxks+slrhikQrva6o= \
  -e REDIS_HOST=test-redis \
  -e REDIS_PORT=6379 \
  -e FABRIC_CHANNEL=benihchannel \
  -e FABRIC_CONTRACT=benih-certification \
  -e FABRIC_WALLET_PATH=/app/wallet \
  -e FABRIC_USER_ID=appUser \
  -e FABRIC_MSP_ID=BPSBPBenihMSP \
  -e IPFS_API_URL=http://host.docker.internal:9094 \
  -e LOG_LEVEL=debug \
  -v $(pwd)/wallet:/app/wallet:ro \
  -v $(pwd)/config/connection-profile.json:/app/config/connection-profile.json:ro \
  -v $(pwd)/logs:/app/logs \
  seed-api-test

# Cleanup
echo ""
echo "Cleaning up..."
docker stop test-redis
docker rm test-redis
