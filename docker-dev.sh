#!/bin/bash
# ==============================================================================
# Postgresus - Build & Run Script for Docker Desktop
# ==============================================================================
# This script helps you build and run Postgresus locally on your Ubuntu machine
# using Docker Desktop.
#
# Usage:
#   ./docker-dev.sh build      - Build the Docker image
#   ./docker-dev.sh run        - Run the container (build first if needed)
#   ./docker-dev.sh start      - Start with optional test databases
#   ./docker-dev.sh stop       - Stop all containers
#   ./docker-dev.sh logs       - View logs
#   ./docker-dev.sh shell      - Open shell in the container
#   ./docker-dev.sh clean      - Remove containers, volumes, and images
#   ./docker-dev.sh help       - Show this help message
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="postgresus"
IMAGE_NAME="postgresus:dev"
CONTAINER_NAME="postgresus"

# Helper functions
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                    🐘 POSTGRESUS DEV TOOLS 🐘                    ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker Desktop and try again."
    fi
}

# Build the Docker image
build() {
    print_banner
    check_docker
    info "Building Postgresus Docker image..."
    
    docker build \
        --tag "$IMAGE_NAME" \
        --build-arg APP_VERSION=dev-$(date +%Y%m%d-%H%M%S) \
        --progress=plain \
        .
    
    success "Docker image built successfully: $IMAGE_NAME"
}

# Run a single container
run() {
    print_banner
    check_docker
    
    # Check if image exists, build if not
    if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
        warn "Image not found. Building first..."
        build
    fi
    
    # Stop existing container if running
    if docker ps -q -f "name=$CONTAINER_NAME" | grep -q .; then
        info "Stopping existing container..."
        docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
        docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
    
    info "Starting Postgresus container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p 443:443 \
        -p 4005:4005 \
        -v postgresus-data:/postgresus-data \
        --restart unless-stopped \
        "$IMAGE_NAME"
    
    success "Postgresus is running with HTTPS!"
    echo ""
    echo -e "🔒 HTTPS: ${GREEN}https://localhost${NC} (self-signed certificate)"
    echo -e "🔓 HTTP:  ${GREEN}http://localhost:4005${NC} (redirects to HTTPS)"
    echo ""
    echo -e "${YELLOW}Note: Your browser may show a security warning for the self-signed certificate.${NC}"
    echo -e "${YELLOW}Click 'Advanced' -> 'Proceed to localhost' to continue.${NC}"
    echo ""
}

# Start with docker compose (includes optional test databases)
start() {
    print_banner
    check_docker
    
    info "Setting up Docker Compose configuration..."
    
    # Create docker-compose.yml from template if not exists
    if [ ! -f "docker-compose.yml" ]; then
        create_compose_file
    fi
    
    # Check for test databases flag
    if [ "$1" == "--with-tests" ] || [ "$1" == "-t" ]; then
        info "Starting Postgresus with test databases..."
        docker compose --profile testing up -d --build
    else
        info "Starting Postgresus..."
        docker compose up -d --build
    fi
    
    success "Postgresus is running with HTTPS!"
    echo ""
    echo -e "🔒 HTTPS: ${GREEN}https://localhost${NC} (self-signed certificate)"
    echo -e "🔓 HTTP:  ${GREEN}http://localhost:4005${NC} (redirects to HTTPS)"
    echo ""
}

# Stop containers
stop() {
    print_banner
    check_docker
    info "Stopping Postgresus..."
    
    if [ -f "docker-compose.yml" ]; then
        docker compose --profile testing down
    else
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
    fi
    
    success "Postgresus stopped."
}

# View logs
logs() {
    check_docker
    if [ -f "docker-compose.yml" ]; then
        docker compose logs -f postgresus
    else
        docker logs -f "$CONTAINER_NAME"
    fi
}

# Open shell in container
shell() {
    check_docker
    info "Opening shell in Postgresus container..."
    docker exec -it "$CONTAINER_NAME" /bin/bash
}

# Clean everything
clean() {
    print_banner
    check_docker
    warn "This will remove ALL Postgresus containers, volumes, and images!"
    read -p "Are you sure? (y/N): " confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        info "Aborted."
        exit 0
    fi
    
    info "Stopping and removing containers..."
    if [ -f "docker-compose.yml" ]; then
        docker compose --profile testing down -v --rmi local
    fi
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    
    info "Removing volumes..."
    docker volume rm postgresus-data 2>/dev/null || true
    docker volume rm test-postgres-data 2>/dev/null || true
    docker volume rm test-mysql-data 2>/dev/null || true
    docker volume rm test-mongodb-data 2>/dev/null || true
    
    info "Removing images..."
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
    
    success "Cleanup complete."
}

# Create docker-compose.yml
create_compose_file() {
    cat > docker-compose.yml << 'EOF'
version: "3.8"

# Docker Compose for local development and testing with Docker Desktop
# Run: docker compose up -d --build

services:
  # Main Postgresus application (build from source)
  postgresus:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - APP_VERSION=dev
    image: postgresus:dev
    container_name: postgresus
    ports:
      - "443:443"
      - "4005:4005"
    volumes:
      - postgresus-data:/postgresus-data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-kf", "https://localhost/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - postgresus-network

  # Optional: Test PostgreSQL database for backup testing
  test-postgres:
    image: postgres:17
    container_name: test-postgres
    environment:
      - POSTGRES_DB=testdb
      - POSTGRES_USER=testuser
      - POSTGRES_PASSWORD=testpassword
    ports:
      - "5432:5432"
    volumes:
      - test-postgres-data:/var/lib/postgresql/data
    networks:
      - postgresus-network
    profiles:
      - testing

  # Optional: Test MySQL database for backup testing
  test-mysql:
    image: mysql:8.0
    container_name: test-mysql
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=testdb
      - MYSQL_USER=testuser
      - MYSQL_PASSWORD=testpassword
    ports:
      - "3306:3306"
    volumes:
      - test-mysql-data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password
    networks:
      - postgresus-network
    profiles:
      - testing

  # Optional: Test MongoDB for backup testing
  test-mongodb:
    image: mongo:7.0
    container_name: test-mongodb
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=rootpassword
      - MONGO_INITDB_DATABASE=testdb
    ports:
      - "27017:27017"
    volumes:
      - test-mongodb-data:/data/db
    command: mongod --auth
    networks:
      - postgresus-network
    profiles:
      - testing

volumes:
  postgresus-data:
    name: postgresus-data
  test-postgres-data:
    name: test-postgres-data
  test-mysql-data:
    name: test-mysql-data
  test-mongodb-data:
    name: test-mongodb-data

networks:
  postgresus-network:
    name: postgresus-network
    driver: bridge
EOF
    success "Created docker-compose.yml"
}

# Show status
status() {
    print_banner
    check_docker
    
    echo "Container status:"
    docker ps -a --filter "name=postgresus" --filter "name=test-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    echo "Volumes:"
    docker volume ls --filter "name=postgresus" --filter "name=test-"
    echo ""
    
    echo "Images:"
    docker images --filter "reference=postgresus*"
}

# Show help
show_help() {
    print_banner
    echo "Commands:"
    echo "  build         Build the Docker image from source"
    echo "  run           Run a single container (simple mode)"
    echo "  start         Start with Docker Compose"
    echo "  start -t      Start with test databases (PostgreSQL, MySQL, MongoDB)"
    echo "  stop          Stop all containers"
    echo "  logs          View container logs"
    echo "  shell         Open bash shell in the container"
    echo "  status        Show container and volume status"
    echo "  clean         Remove containers, volumes, and images"
    echo "  help          Show this help message"
    echo ""
    echo "Quick start:"
    echo "  1. ./docker-dev.sh build    # Build the image"
    echo "  2. ./docker-dev.sh run      # Start the container"
    echo "  3. Open https://localhost (accept the self-signed certificate)"
    echo ""
    echo "With test databases for backup testing:"
    echo "  ./docker-dev.sh start -t"
    echo ""
    echo "Test database connection details:"
    echo "  PostgreSQL: localhost:5432, user=testuser, password=testpassword, db=testdb"
    echo "  MySQL:      localhost:3306, user=testuser, password=testpassword, db=testdb"
    echo "  MongoDB:    localhost:27017, user=root, password=rootpassword"
}

# Main
case "${1:-help}" in
    build)
        build
        ;;
    run)
        run
        ;;
    start)
        start "$2"
        ;;
    stop)
        stop
        ;;
    logs)
        logs
        ;;
    shell)
        shell
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1. Use './docker-dev.sh help' for usage."
        ;;
esac
