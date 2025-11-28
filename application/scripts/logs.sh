#!/bin/bash

# Quick log viewer for troubleshooting

echo "========================================="
echo "  Seed API Gateway - Quick Logs"
echo "========================================="
echo ""

# Check if container exists
if docker ps -a | grep -q "seed-api-gateway"; then
    CONTAINER_NAME=$(docker ps -a --format '{{.Names}}' | grep "seed-api-gateway" | head -1)
    
    echo "Container: $CONTAINER_NAME"
    echo ""
    
    # Show container status
    echo "Status:"
    docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    # Check if running
    if docker ps | grep -q "$CONTAINER_NAME"; then
        echo "✓ Container is running"
        
        # Show health status
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "no healthcheck")
        echo "Health: $HEALTH"
        echo ""
    else
        echo "✗ Container is NOT running"
        echo ""
    fi
    
    # Ask what logs to show
    echo "Select logs to view:"
    echo "1) Last 50 lines"
    echo "2) Last 100 lines"
    echo "3) Last 200 lines"
    echo "4) Follow logs (real-time)"
    echo "5) Search for errors only"
    echo "6) All logs"
    read -p "Choose (1-6): " choice
    
    echo ""
    echo "========================================="
    
    case $choice in
        1)
            docker logs "$CONTAINER_NAME" --tail 50
            ;;
        2)
            docker logs "$CONTAINER_NAME" --tail 100
            ;;
        3)
            docker logs "$CONTAINER_NAME" --tail 200
            ;;
        4)
            echo "Following logs... (Ctrl+C to stop)"
            echo ""
            docker logs -f "$CONTAINER_NAME"
            ;;
        5)
            echo "Errors and warnings:"
            echo ""
            docker logs "$CONTAINER_NAME" 2>&1 | grep -i "error\|warn\|fail"
            ;;
        6)
            docker logs "$CONTAINER_NAME"
            ;;
        *)
            echo "Invalid choice, showing last 50 lines:"
            docker logs "$CONTAINER_NAME" --tail 50
            ;;
    esac
    
else
    echo "✗ No seed-api-gateway container found"
    echo ""
    echo "Available containers:"
    docker ps -a --format '{{.Names}}'
    echo ""
    echo "Try running: docker-compose -f docker-compose.prod.yml up -d"
fi
