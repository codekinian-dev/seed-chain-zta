#!/bin/bash

# Monitoring Stack Management Script
# Quick commands to manage monitoring services

set -e

COMPOSE_FILE="docker-compose.yml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Start all services
start() {
    print_info "Starting monitoring stack..."
    docker-compose up -d
    
    print_info "Waiting for services to be ready..."
    sleep 5
    
    check_health
}

# Stop all services
stop() {
    print_info "Stopping monitoring stack..."
    docker-compose down
}

# Restart all services
restart() {
    print_info "Restarting monitoring stack..."
    docker-compose restart
}

# Check health of all services
check_health() {
    print_info "Checking service health..."
    
    # Prometheus
    if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
        print_info "✓ Prometheus is healthy"
    else
        print_error "✗ Prometheus is not responding"
    fi
    
    # Grafana
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        print_info "✓ Grafana is healthy"
    else
        print_error "✗ Grafana is not responding"
    fi
    
    # Loki
    if curl -s http://localhost:3100/ready > /dev/null 2>&1; then
        print_info "✓ Loki is healthy"
    else
        print_error "✗ Loki is not responding"
    fi
    
    # AlertManager
    if curl -s http://localhost:9093/-/healthy > /dev/null 2>&1; then
        print_info "✓ AlertManager is healthy"
    else
        print_error "✗ AlertManager is not responding"
    fi
}

# Show status
status() {
    print_info "Service status:"
    docker-compose ps
}

# Show logs
logs() {
    if [ -z "$1" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$1"
    fi
}

# Backup data
backup() {
    print_info "Creating backup..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup Prometheus data
    print_info "Backing up Prometheus data..."
    docker run --rm \
        -v monitoring_prometheus-data:/data \
        -v "$SCRIPT_DIR/$BACKUP_DIR":/backup \
        alpine tar czf /backup/prometheus.tar.gz /data
    
    # Backup Grafana data
    print_info "Backing up Grafana data..."
    docker run --rm \
        -v monitoring_grafana-data:/data \
        -v "$SCRIPT_DIR/$BACKUP_DIR":/backup \
        alpine tar czf /backup/grafana.tar.gz /data
    
    # Backup configurations
    print_info "Backing up configurations..."
    cp prometheus.yml "$BACKUP_DIR/"
    cp prometheus-rules.yml "$BACKUP_DIR/"
    cp loki-config.yml "$BACKUP_DIR/"
    cp promtail-config.yml "$BACKUP_DIR/"
    cp alertmanager.yml "$BACKUP_DIR/"
    
    print_info "Backup completed: $BACKUP_DIR"
}

# Restore from backup
restore() {
    if [ -z "$1" ]; then
        print_error "Please specify backup directory"
        exit 1
    fi
    
    BACKUP_DIR="$1"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    print_warn "This will restore data from: $BACKUP_DIR"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Restore cancelled"
        exit 0
    fi
    
    print_info "Stopping services..."
    docker-compose down
    
    # Restore Prometheus data
    if [ -f "$BACKUP_DIR/prometheus.tar.gz" ]; then
        print_info "Restoring Prometheus data..."
        docker run --rm \
            -v monitoring_prometheus-data:/data \
            -v "$BACKUP_DIR":/backup \
            alpine sh -c "rm -rf /data/* && tar xzf /backup/prometheus.tar.gz -C /"
    fi
    
    # Restore Grafana data
    if [ -f "$BACKUP_DIR/grafana.tar.gz" ]; then
        print_info "Restoring Grafana data..."
        docker run --rm \
            -v monitoring_grafana-data:/data \
            -v "$BACKUP_DIR":/backup \
            alpine sh -c "rm -rf /data/* && tar xzf /backup/grafana.tar.gz -C /"
    fi
    
    print_info "Starting services..."
    docker-compose up -d
    
    print_info "Restore completed"
}

# Update services
update() {
    print_info "Updating monitoring stack..."
    
    print_info "Pulling latest images..."
    docker-compose pull
    
    print_info "Recreating containers..."
    docker-compose up -d
    
    print_info "Update completed"
}

# Clean old data
clean() {
    print_warn "This will remove old data volumes"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Clean cancelled"
        exit 0
    fi
    
    print_info "Stopping services..."
    docker-compose down -v
    
    print_info "Cleanup completed"
}

# Show usage
usage() {
    cat << EOF
Monitoring Stack Management Script

Usage: $0 [command]

Commands:
    start       Start all monitoring services
    stop        Stop all monitoring services
    restart     Restart all monitoring services
    status      Show service status
    health      Check health of all services
    logs        Show logs (optionally specify service name)
    backup      Create backup of all data
    restore     Restore from backup (requires backup directory)
    update      Update all services to latest versions
    clean       Remove all data volumes (dangerous!)
    help        Show this help message

Examples:
    $0 start
    $0 logs grafana
    $0 backup
    $0 restore backups/20260120_120000

EOF
}

# Main
case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    health)
        check_health
        ;;
    logs)
        logs "$2"
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    update)
        update
        ;;
    clean)
        clean
        ;;
    help)
        usage
        ;;
    *)
        print_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
