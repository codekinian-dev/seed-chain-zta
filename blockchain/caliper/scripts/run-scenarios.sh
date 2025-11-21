#!/bin/bash
#
# Script untuk menjalankan performance test scenarios
# 100, 500, dan 1000 requests
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALIPER_DIR="$(dirname "$SCRIPT_DIR")"
cd "$CALIPER_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_message() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Create reports directory
REPORT_DIR="$CALIPER_DIR/reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

print_header "PERFORMANCE TEST SCENARIOS"
echo ""
echo "Scenarios:"
echo "  1. 100 requests  (5 workers, 10 TPS)"
echo "  2. 500 requests  (10 workers, 20 TPS)"
echo "  3. 1000 requests (20 workers, 30 TPS)"
echo ""
echo "Reports akan disimpan di: $REPORT_DIR"
echo ""

# Scenario 1: 100 requests
print_header "SCENARIO 1: 100 REQUESTS"
print_message "Starting test with 100 requests..."
echo ""

npm run test:100

if [ $? -eq 0 ]; then
    print_message "✓ Scenario 1 (100 requests) completed successfully"
    
    # Move report files
    if [ -f "report.html" ]; then
        mv report.html "$REPORT_DIR/report_100_${TIMESTAMP}.html"
        print_message "Report saved: $REPORT_DIR/report_100_${TIMESTAMP}.html"
    fi
else
    print_error "✗ Scenario 1 (100 requests) failed"
    exit 1
fi

echo ""
print_warning "Waiting 30 seconds before next scenario..."
sleep 30

# Scenario 2: 500 requests
print_header "SCENARIO 2: 500 REQUESTS"
print_message "Starting test with 500 requests..."
echo ""

npm run test:500

if [ $? -eq 0 ]; then
    print_message "✓ Scenario 2 (500 requests) completed successfully"
    
    if [ -f "report.html" ]; then
        mv report.html "$REPORT_DIR/report_500_${TIMESTAMP}.html"
        print_message "Report saved: $REPORT_DIR/report_500_${TIMESTAMP}.html"
    fi
else
    print_error "✗ Scenario 2 (500 requests) failed"
    exit 1
fi

echo ""
print_warning "Waiting 60 seconds before next scenario..."
sleep 60

# Scenario 3: 1000 requests
print_header "SCENARIO 3: 1000 REQUESTS"
print_message "Starting test with 1000 requests..."
echo ""

npm run test:1000

if [ $? -eq 0 ]; then
    print_message "✓ Scenario 3 (1000 requests) completed successfully"
    
    if [ -f "report.html" ]; then
        mv report.html "$REPORT_DIR/report_1000_${TIMESTAMP}.html"
        print_message "Report saved: $REPORT_DIR/report_1000_${TIMESTAMP}.html"
    fi
else
    print_error "✗ Scenario 3 (1000 requests) failed"
    exit 1
fi

# Summary
echo ""
print_header "TEST SCENARIOS COMPLETED"
echo ""
print_message "All scenarios completed successfully!"
echo ""
echo "Reports location: $REPORT_DIR"
echo ""
ls -lh "$REPORT_DIR" | grep "$TIMESTAMP"
echo ""
print_message "Open reports dengan browser:"
echo "  open $REPORT_DIR/report_100_${TIMESTAMP}.html"
echo "  open $REPORT_DIR/report_500_${TIMESTAMP}.html"
echo "  open $REPORT_DIR/report_1000_${TIMESTAMP}.html"
echo ""
