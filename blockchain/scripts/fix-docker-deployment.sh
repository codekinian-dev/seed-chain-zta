#!/bin/bash

# Fix Docker issues for Fabric chaincode deployment on server
# Run this script before deploying chaincode

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Fixing Docker for Chaincode Deployment ===${NC}"
echo ""

# 1. Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then 
    echo -e "${YELLOW}Running as root${NC}"
    SUDO=""
else
    echo -e "${YELLOW}Running with sudo${NC}"
    SUDO="sudo"
fi

# 2. Stop Docker daemon
echo "1. Stopping Docker daemon..."
$SUDO systemctl stop docker || true
sleep 2

# 3. Clean up Docker socket
echo "2. Cleaning up Docker socket..."
if [ -S /var/run/docker.sock ]; then
    $SUDO rm -f /var/run/docker.sock
    $SUDO rm -rf /var/lib/docker/network/files/* 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ Docker socket doesn't exist (Docker may not be running)${NC}"
fi

# 4. Start Docker daemon
echo "3. Starting Docker daemon..."
$SUDO systemctl start docker
sleep 5

# 5. Verify Docker is running
echo "4. Verifying Docker status..."
if $SUDO systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓ Docker is running${NC}"
else
    echo -e "${RED}✗ Docker failed to start${NC}"
    $SUDO journalctl -u docker -n 50 --no-pager
    exit 1
fi

# 6. Fix Docker socket permissions
echo "5. Fixing Docker socket permissions..."
if [ -S /var/run/docker.sock ]; then
    $SUDO chmod 666 /var/run/docker.sock
    echo -e "${GREEN}✓ Socket permissions fixed${NC}"
else
    echo -e "${RED}✗ Socket still doesn't exist after Docker start${NC}"
    echo -e "${YELLOW}Checking Docker status...${NC}"
    $SUDO systemctl status docker --no-pager -l | head -20
    echo ""
    echo -e "${YELLOW}Checking Docker logs...${NC}"
    $SUDO journalctl -u docker -n 50 --no-pager
    exit 1
fi

# 7. Add current user to docker group
if [ "$EUID" -ne 0 ]; then
    echo "6. Adding user to docker group..."
    $SUDO usermod -aG docker $USER || true
    echo -e "${GREEN}✓ User added to docker group${NC}"
fi

# 8. Test Docker without sudo
echo "7. Testing Docker access..."
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is accessible${NC}"
else
    echo -e "${YELLOW}⚠ Docker requires newgrp or re-login${NC}"
    echo "Run: newgrp docker"
fi

# 9. Clean up old chaincode containers and images
echo "8. Cleaning up old chaincode containers..."
docker ps -aq --filter "name=dev-peer" | xargs -r docker rm -f 2>/dev/null || true
docker images -q --filter "reference=dev-peer*" | xargs -r docker rmi -f 2>/dev/null || true
echo -e "${GREEN}✓ Old chaincode containers cleaned${NC}"

# 10. Increase Docker build timeout
echo "9. Configuring Docker daemon..."
cat > /tmp/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    }
  }
}
EOF

$SUDO mkdir -p /etc/docker
$SUDO cp /tmp/daemon.json /etc/docker/daemon.json
$SUDO rm /tmp/daemon.json

# 11. Restart Docker with new config
echo "10. Restarting Docker with new configuration..."
$SUDO systemctl restart docker
sleep 5

# 12. Verify Docker build capability
echo "11. Testing Docker build..."
cat > /tmp/test-dockerfile <<EOF
FROM node:18-alpine
RUN echo "Build test successful"
EOF

if docker build -t test-chaincode-build -f /tmp/test-dockerfile /tmp > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker build works${NC}"
    docker rmi test-chaincode-build > /dev/null 2>&1 || true
else
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi
rm /tmp/test-dockerfile

# 13. Show Docker info
echo ""
echo -e "${GREEN}=== Docker Information ===${NC}"
docker version | head -20
echo ""
docker info | grep -E "Server Version|Storage Driver|Docker Root Dir|Runtimes"

echo ""
echo -e "${GREEN}=== Fix Complete ===${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} If you still get permission errors, run:"
echo "  newgrp docker"
echo "  OR"
echo "  Log out and log back in"
echo ""
echo "Then run chaincode deployment again."
