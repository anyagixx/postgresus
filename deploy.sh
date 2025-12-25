#!/bin/bash
#
# Postgresus Quick Deploy Script
# Usage: ./deploy.sh [start|stop|restart|logs|status|update|backup]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or you don't have permissions."
        log_info "Try: sudo usermod -aG docker \$USER && newgrp docker"
        exit 1
    fi
}

start() {
    log_info "Starting Postgresus..."
    docker compose -f "$COMPOSE_FILE" up -d
    log_info "Waiting for startup..."
    sleep 5
    status
    log_info "Postgresus is available at: https://$(hostname -I | awk '{print $1}')"
}

stop() {
    log_info "Stopping Postgresus..."
    docker compose -f "$COMPOSE_FILE" down
    log_info "Stopped."
}

restart() {
    stop
    start
}

logs() {
    docker compose -f "$COMPOSE_FILE" logs -f
}

status() {
    log_info "Container status:"
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Health check:"
    if curl -sk https://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Postgresus is healthy${NC}"
    else
        echo -e "${RED}✗ Postgresus is not responding${NC}"
    fi
}

update() {
    log_info "Updating Postgresus..."
    docker compose -f "$COMPOSE_FILE" pull
    docker compose -f "$COMPOSE_FILE" up -d
    log_info "Update complete."
    status
}

backup() {
    BACKUP_FILE="postgresus-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    log_info "Creating backup: $BACKUP_FILE"
    
    docker compose -f "$COMPOSE_FILE" stop
    docker run --rm \
        -v postgresus-data:/data \
        -v "$(pwd)":/backup \
        alpine tar czvf "/backup/$BACKUP_FILE" /data
    docker compose -f "$COMPOSE_FILE" start
    
    log_info "Backup created: $(pwd)/$BACKUP_FILE"
}

check_docker

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    logs)    logs ;;
    status)  status ;;
    update)  update ;;
    backup)  backup ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|update|backup}"
        exit 1
        ;;
esac
