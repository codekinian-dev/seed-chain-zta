#!/bin/bash

# Container Health Monitor for VPS
# This script continuously monitors container health and auto-restarts if needed

CONTAINER_NAME="seed-api-gateway-prod"
CHECK_INTERVAL=30  # Check every 30 seconds
LOG_FILE="logs/monitor.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    # Try alternative name
    CONTAINER_NAME="seed-api-gateway"
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${RED}Error: Container not found${NC}"
        echo "Available containers:"
        docker ps -a --format '{{.Names}}'
        exit 1
    fi
fi

log "Starting health monitor for container: $CONTAINER_NAME"
log "Check interval: ${CHECK_INTERVAL}s"
echo ""

RESTART_COUNT=0
CONSECUTIVE_FAILURES=0
MAX_CONSECUTIVE_FAILURES=3

while true; do
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${RED}✗ Container is not running${NC}"
        log "ERROR: Container $CONTAINER_NAME is not running"
        
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        
        if [ $CONSECUTIVE_FAILURES -ge $MAX_CONSECUTIVE_FAILURES ]; then
            log "WARNING: Container failed $CONSECUTIVE_FAILURES times consecutively"
            log "Attempting restart..."
            
            docker compose -f docker-compose.prod.yml up -d api-gateway
            RESTART_COUNT=$((RESTART_COUNT + 1))
            
            log "Restart attempt #$RESTART_COUNT completed"
            
            # Wait for container to start
            sleep 20
            
            # Check logs
            log "Recent logs after restart:"
            docker logs "$CONTAINER_NAME" --tail 20 >> "$LOG_FILE"
            
            CONSECUTIVE_FAILURES=0
        fi
    else
        # Container is running, check health
        HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "none")
        
        if [ "$HEALTH_STATUS" = "healthy" ]; then
            echo -e "${GREEN}✓ Container is healthy${NC}"
            CONSECUTIVE_FAILURES=0
        elif [ "$HEALTH_STATUS" = "unhealthy" ]; then
            echo -e "${RED}✗ Container is unhealthy${NC}"
            log "WARNING: Container health check failed"
            
            # Show recent logs
            docker logs "$CONTAINER_NAME" --tail 10 | tee -a "$LOG_FILE"
            
            CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        elif [ "$HEALTH_STATUS" = "starting" ]; then
            echo -e "${YELLOW}⏳ Container is starting...${NC}"
        else
            # No health check configured
            echo -e "${GREEN}✓ Container is running${NC}"
            CONSECUTIVE_FAILURES=0
        fi
        
        # Check container restart count
        RESTARTS=$(docker inspect --format='{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null || echo "0")
        if [ "$RESTARTS" -gt 0 ]; then
            log "INFO: Container has restarted $RESTARTS times"
        fi
    fi
    
    # Show stats
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        STATS=$(docker stats --no-stream --format "CPU: {{.CPUPerc}} | MEM: {{.MemUsage}}" "$CONTAINER_NAME")
        echo "  $STATS"
    fi
    
    echo "  Next check in ${CHECK_INTERVAL}s... (Ctrl+C to stop)"
    echo ""
    
    sleep "$CHECK_INTERVAL"
done
