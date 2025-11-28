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
echo -e "${GREEN}K6 Load Test - Seed Certification${NC}"
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
echo "Select test scenario:"
echo "  1) Smoke Test (1 VU, 1 min) - Quick validation"
echo "  2) Load Test (20 VUs, ~6.5 min) - Standard load with gradual ramp"
echo "  3) Stress Test (30 VUs, ~8 min) - High load test"
echo "  4) Light Test (5 VUs, 3 min) - Light continuous load"
echo "  5) Custom - Enter your own parameters"
echo ""

read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo -e "${GREEN}Running Smoke Test...${NC}"
        k6 run --vus 1 --duration 1m loadtest.js
        ;;
    2)
        echo -e "${GREEN}Running Load Test (gradual ramp to 20 VUs)...${NC}"
        k6 run loadtest.js
        ;;
    3)
        echo -e "${GREEN}Running Stress Test (30 VUs)...${NC}"
        k6 run --stages '1m:10,2m:10,1m:20,2m:20,1m:30,2m:30,30s:0' loadtest.js
        ;;
    4)
        echo -e "${GREEN}Running Light Test (5 VUs)...${NC}"
        k6 run --vus 5 --duration 3m loadtest.js
        ;;
    5)
        read -p "Enter number of VUs: " vus
        read -p "Enter duration (e.g., 30s, 1m): " duration
        echo -e "${GREEN}Running Custom Test (${vus} VUs, ${duration})...${NC}"
        k6 run --vus "$vus" --duration "$duration" loadtest.js
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Test completed!${NC}"
echo ""
echo -e "${YELLOW}HTML Report saved in: ${NC}reports/report-*.html"
echo -e "${YELLOW}Open the latest report with: ${NC}open \$(ls -t reports/*.html | head -1)"
