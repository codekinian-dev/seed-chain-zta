#!/bin/bash
#
# K6 Load Test Runner Script
# Seed Certification API - Load Testing
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}K6 Query Test - Seed Certification${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}ERROR: K6 is not installed${NC}"
    echo "Please install K6:"
    echo "  macOS: brew install k6"
    echo "  Linux: See https://k6.io/docs/getting-started/installation/"
    exit 1
fi

echo -e "${GREEN}✓ K6 installed${NC}"

# Create reports directory if it doesn't exist
if [ ! -d "reports" ]; then
    mkdir -p reports
    echo -e "${GREEN}✓ Reports directory created${NC}"
fi

# Check if services are running
echo ""
echo "Checking services..."

# Check Keycloak
if curl -s https://auth.jabarchain.me/health/ready > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Keycloak is running${NC}"
else
    echo -e "${YELLOW}⚠ Keycloak may not be running on port 6080${NC}"
fi

# Check API Gateway
if curl -s https://gateway.jabarchain.me/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API Gateway is running${NC}"
else
    echo -e "${YELLOW}⚠ API Gateway may not be running on port 3001${NC}"
fi

echo ""
echo "Select query test scenario:"
echo "  1) Smoke Test (1 VU, 1 min) - Quick validation"
echo "  2) Query Test (50 VUs, ~5.5 min) - Standard query load with gradual ramp"
echo "  3) Heavy Query (100 VUs, ~7 min) - High query load"
echo "  4) Light Query (10 VUs, 3 min) - Light continuous query"
echo "  5) Custom - Enter your own parameters"
echo ""

read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo -e "${GREEN}Running Smoke Test...${NC}"
        k6 run --vus 1 --duration 1m querytest.js
        ;;
    2)
        echo -e "${GREEN}Running Query Test (gradual ramp to 50 VUs)...${NC}"
        k6 run querytest.js
        ;;
    3)
        echo -e "${GREEN}Running Heavy Query Test (100 VUs)...${NC}"
        k6 run --stages '30s:20,1m:20,30s:50,1m:50,30s:100,1m:100,30s:0' querytest.js
        ;;
    4)
        echo -e "${GREEN}Running Light Query Test (10 VUs)...${NC}"
        k6 run --vus 10 --duration 3m querytest.js
        ;;
    5)
        read -p "Enter number of VUs: " vus
        read -p "Enter duration (e.g., 30s, 1m): " duration
        echo -e "${GREEN}Running Custom Query Test (${vus} VUs, ${duration})...${NC}"
        k6 run --vus "$vus" --duration "$duration" querytest.js
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Query test completed!${NC}"
echo ""
echo -e "${YELLOW}HTML Report saved in: ${NC}reports/query-report-*.html"
echo -e "${YELLOW}Open the latest report with: ${NC}open \$(ls -t reports/query-report-*.html | head -1)"
