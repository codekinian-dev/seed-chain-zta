#!/bin/bash

# Fix Docker socket activation issue
# When Docker uses systemd socket activation instead of creating /var/run/docker.sock directly

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Fixing Docker Socket Activation Issue ===${NC}"
echo ""

# 1. Stop Docker service
echo "1. Stopping Docker service..."
sudo systemctl stop docker.service
sleep 2

# 2. Stop and disable docker.socket
echo "2. Stopping docker.socket..."
sudo systemctl stop docker.socket
sleep 1

# 3. Start docker.socket
echo "3. Starting docker.socket..."
sudo systemctl start docker.socket
sleep 2

# 4. Check if socket exists
if [ -S /var/run/docker.sock ]; then
    echo -e "${GREEN}✓ Socket created by docker.socket${NC}"
    ls -la /var/run/docker.sock
else
    echo -e "${YELLOW}Socket not created yet, starting docker.service...${NC}"
fi

# 5. Start Docker service
echo "4. Starting docker.service..."
sudo systemctl start docker.service
sleep 3

# 6. Verify socket exists
echo "5. Verifying socket..."
if [ -S /var/run/docker.sock ]; then
    echo -e "${GREEN}✓ Docker socket exists${NC}"
    ls -la /var/run/docker.sock
    
    # Fix permissions
    echo "6. Fixing socket permissions..."
    sudo chmod 666 /var/run/docker.sock
    echo -e "${GREEN}✓ Permissions fixed${NC}"
else
    echo -e "${RED}✗ Socket still doesn't exist${NC}"
    echo ""
    echo "Checking systemd socket unit..."
    sudo systemctl status docker.socket --no-pager
    echo ""
    echo "Trying alternative: disable socket activation..."
    
    # Disable socket activation, use direct mode
    sudo systemctl stop docker.socket
    sudo systemctl disable docker.socket
    
    # Edit Docker service to not use socket activation
    echo "Creating Docker service override..."
    sudo mkdir -p /etc/systemd/system/docker.service.d
    
    cat << 'EOF' | sudo tee /etc/systemd/system/docker.service.d/override.conf
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd
EOF
    
    # Reload and restart
    sudo systemctl daemon-reload
    sudo systemctl restart docker.service
    sleep 5
    
    if [ -S /var/run/docker.sock ]; then
        echo -e "${GREEN}✓ Socket created in direct mode${NC}"
        sudo chmod 666 /var/run/docker.sock
    else
        echo -e "${RED}✗ Failed to create socket${NC}"
        echo "Please check: sudo journalctl -u docker -n 100"
        exit 1
    fi
fi

# 7. Test Docker
echo "7. Testing Docker..."
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is working${NC}"
    echo ""
    docker version | head -15
else
    echo -e "${RED}✗ Docker is not accessible${NC}"
    docker info 2>&1 | head -20
    exit 1
fi

# 8. Add user to docker group
echo ""
echo "8. Ensuring user is in docker group..."
if groups | grep -q docker; then
    echo -e "${GREEN}✓ User already in docker group${NC}"
else
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ User added to docker group${NC}"
    echo -e "${YELLOW}⚠ Run: newgrp docker${NC}"
fi

echo ""
echo -e "${GREEN}=== Docker Socket Fixed ===${NC}"
echo ""
echo "Socket location: /var/run/docker.sock"
echo "Permissions: $(stat -c '%a' /var/run/docker.sock 2>/dev/null || stat -f '%Lp' /var/run/docker.sock 2>/dev/null)"
echo ""
echo "Next steps:"
echo "  1. Run: newgrp docker"
echo "  2. Test: docker ps"
echo "  3. Deploy: ./scripts/deploy-chaincode-enhanced.sh benihchannel"
