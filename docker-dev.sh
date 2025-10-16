#!/bin/bash

# HyperIndex Docker Development Script
# Usage: ./docker-dev.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    print_success "Docker is running"
}

# Setup environment
setup_env() {
    if [ ! -f .env ]; then
        print_info "Creating .env file from .env.docker template..."
        cp .env.docker .env
        print_warning "Please edit .env file with your actual credentials before starting services"
    else
        print_info ".env file already exists"
    fi
}

# Development mode
dev() {
    check_docker
    setup_env

    print_info "Starting HyperIndex in development mode..."
    docker compose -f docker-compose.yml up --build -d

    print_success "Services started! Available at:"
    echo "  🌐 Frontend: http://localhost:3000"
    echo "  🔧 Backend API: http://localhost:3001"
    echo "  🗄️  Redis: localhost:6379"
    echo ""
    echo "To view logs:"
    echo "  📊 All logs: docker compose logs -f"
    echo "  🔧 Backend: docker compose logs -f backend"
    echo "  🌐 Frontend: docker compose logs -f frontend"
}

# Production mode
prod() {
    check_docker
    setup_env

    print_info "Starting HyperIndex in production mode..."
    docker compose -f docker-compose.yml up --build -d --target production

    print_success "Production services started!"
}

# Stop services
stop() {
    print_info "Stopping all services..."
    docker compose down
    print_success "All services stopped"
}

# Clean up
clean() {
    print_warning "This will remove all containers, volumes, and images!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleaning up..."
        docker compose down -v --rmi all
        docker system prune -f
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Show logs
logs() {
    if [ -z "$2" ]; then
        docker compose logs -f
    else
        docker compose logs -f "$2"
    fi
}

# Show status
status() {
    print_info "Service Status:"
    docker compose ps
    echo ""
    print_info "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

# Test services
test() {
    print_info "Testing services..."

    # Test backend health
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Backend health check passed"
    else
        print_error "Backend health check failed"
    fi

    # Test frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend is accessible"
    else
        print_error "Frontend is not accessible"
    fi

    # Test Redis
    if docker compose exec redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is responding"
    else
        print_error "Redis is not responding"
    fi
}

# Shell access
shell() {
    service=${2:-backend}
    print_info "Opening shell in $service container..."
    docker compose exec "$service" sh
}

# Show help
help() {
    echo "HyperIndex Docker Development Tool"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  dev     Start development environment"
    echo "  prod    Start production environment"
    echo "  stop    Stop all services"
    echo "  clean   Remove all containers, volumes, and images"
    echo "  logs    Show logs (optionally specify service: logs backend)"
    echo "  status  Show service status and resource usage"
    echo "  test    Test all services"
    echo "  shell   Access shell (optionally specify service: shell backend)"
    echo "  help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev          # Start development environment"
    echo "  $0 logs backend # Show backend logs"
    echo "  $0 shell redis  # Access Redis shell"
}

# Main command handler
case "${1:-help}" in
    dev)
        dev
        ;;
    prod)
        prod
        ;;
    stop)
        stop
        ;;
    clean)
        clean
        ;;
    logs)
        logs "$@"
        ;;
    status)
        status
        ;;
    test)
        test
        ;;
    shell)
        shell "$@"
        ;;
    help|*)
        help
        ;;
esac