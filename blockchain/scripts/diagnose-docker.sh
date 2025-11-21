#!/bin/bash

# Diagnose and fix Docker daemon issues
# Run this when Docker socket doesn't exist

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Docker Daemon Diagnostics ===${NC}"
echo ""

# 1. Check if Docker is installed
echo -e "${YELLOW}1. Checking Docker installation...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
    docker --version
else
    echo -e "${RED}✗ Docker is NOT installed${NC}"
    echo "Install Docker first:"
    echo "  Ubuntu/Debian: sudo apt-get update && sudo apt-get install docker.io"
    echo "  CentOS/RHEL: sudo yum install docker"
    exit 1
fi
echo ""

# 2. Check Docker service status
echo -e "${YELLOW}2. Checking Docker service status...${NC}"
if systemctl is-active --quiet docker 2>/dev/null; then
    echo -e "${GREEN}✓ Docker service is running${NC}"
elif systemctl status docker &>/dev/null; then
    echo -e "${RED}✗ Docker service exists but is NOT running${NC}"
    echo "Status:"
    systemctl status docker --no-pager -l
    echo ""
    echo -e "${YELLOW}Attempting to start Docker...${NC}"
    sudo systemctl start docker
    sleep 3
    if systemctl is-active --quiet docker; then
        echo -e "${GREEN}✓ Docker started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start Docker${NC}"
        echo "Check logs: sudo journalctl -u docker -n 50 --no-pager"
        exit 1
    fi
else
    echo -e "${RED}✗ Docker service not found${NC}"
    echo "Docker may not be properly installed"
    exit 1
fi
echo ""

# 3. Check Docker socket
echo -e "${YELLOW}3. Checking Docker socket...${NC}"
if [ -S /var/run/docker.sock ]; then
    echo -e "${GREEN}✓ Docker socket exists${NC}"
    ls -la /var/run/docker.sock
else
    echo -e "${RED}✗ Docker socket does NOT exist${NC}"
    echo "Possible causes:"
    echo "  1. Docker daemon just started (wait a few seconds)"
    echo "  2. Docker failed to create socket"
    echo "  3. Non-standard Docker configuration"
    
    # Wait a bit and check again
    echo ""
    echo "Waiting 5 seconds for Docker to initialize..."
    sleep 5
    
    if [ -S /var/run/docker.sock ]; then
        echo -e "${GREEN}✓ Socket appeared${NC}"
    else
        echo -e "${RED}✗ Socket still missing${NC}"
        echo ""
        echo "Trying to restart Docker daemon..."
        sudo systemctl restart docker
        sleep 5
        
        if [ -S /var/run/docker.sock ]; then
            echo -e "${GREEN}✓ Socket created after restart${NC}"
        else
            echo -e "${RED}✗ Critical error: Socket not created${NC}"
            echo ""
            echo "Check Docker logs for errors:"
            echo "  sudo journalctl -u docker -n 100 --no-pager"
            exit 1
        fi
    fi
fi
echo ""

# 4. Check Docker socket permissions
echo -e "${YELLOW}4. Checking socket permissions...${NC}"
if [ -S /var/run/docker.sock ]; then
    SOCK_PERMS=$(stat -c '%a' /var/run/docker.sock 2>/dev/null || stat -f '%A' /var/run/docker.sock 2>/dev/null)
    SOCK_OWNER=$(stat -c '%U:%G' /var/run/docker.sock 2>/dev/null || stat -f '%Su:%Sg' /var/run/docker.sock 2>/dev/null)
    
    echo "Permissions: $SOCK_PERMS"
    echo "Owner: $SOCK_OWNER"
    
    if [ "$SOCK_PERMS" != "666" ] && [ "$SOCK_PERMS" != "660" ]; then
        echo -e "${YELLOW}⚠ Fixing socket permissions...${NC}"
        sudo chmod 666 /var/run/docker.sock
        echo -e "${GREEN}✓ Permissions fixed${NC}"
    else
        echo -e "${GREEN}✓ Permissions OK${NC}"
    fi
fi
echo ""

# 5. Test Docker connectivity
echo -e "${YELLOW}5. Testing Docker connectivity...${NC}"
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Can communicate with Docker daemon${NC}"
else
    echo -e "${RED}✗ Cannot communicate with Docker daemon${NC}"
    echo ""
    echo "Error details:"
    docker info 2>&1 | head -20
    echo ""
    echo "Possible fixes:"
    echo "  1. Check if user is in docker group: groups"
    echo "  2. Add user to docker group: sudo usermod -aG docker \$USER"
    echo "  3. Activate group: newgrp docker"
    echo "  4. Fix permissions: sudo chmod 666 /var/run/docker.sock"
    exit 1
fi
echo ""

# 6. Add current user to docker group
echo -e "${YELLOW}6. Checking docker group membership...${NC}"
if groups | grep -q docker; then
    echo -e "${GREEN}✓ User is in docker group${NC}"
else
    echo -e "${YELLOW}⚠ Adding user to docker group...${NC}"
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ User added to docker group${NC}"
    echo -e "${YELLOW}⚠ You need to log out and log back in, or run: newgrp docker${NC}"
fi
echo ""

# 7. Test Docker with simple command
echo -e "${YELLOW}7. Testing Docker functionality...${NC}"
if docker ps > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is fully functional${NC}"
    echo ""
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo -e "${RED}✗ Docker test failed${NC}"
    docker ps 2>&1
    exit 1
fi
echo ""

# 8. Check Docker version and info
echo -e "${YELLOW}8. Docker information:${NC}"
echo "Version: $(docker --version)"
echo "Server Version: $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'N/A')"
echo "Storage Driver: $(docker info --format '{{.Driver}}' 2>/dev/null || echo 'N/A')"
echo ""

# 9. Final recommendations
echo -e "${GREEN}=== Diagnostics Complete ===${NC}"
echo ""
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is working correctly!${NC}"
    echo ""
    echo "You can now deploy chaincode:"
    echo "  cd blockchain"
    echo "  ./scripts/deploy-chaincode-enhanced.sh benihchannel"
else
    echo -e "${YELLOW}⚠ Docker needs attention${NC}"
    echo ""
    echo "Required actions:"
    echo "  1. Run: newgrp docker"
    echo "  2. OR log out and log back in"
    echo "  3. Then test: docker ps"
fi
