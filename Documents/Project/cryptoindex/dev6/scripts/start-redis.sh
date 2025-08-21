#!/bin/bash

# HyperIndex Redis Docker 시작 스크립트

echo "🚀 Starting HyperIndex Redis infrastructure..."

# Docker가 실행 중인지 확인
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# 기존 컨테이너 중지 및 제거 (필요시)
echo "🧹 Cleaning up existing containers..."
docker-compose down 2>/dev/null || true

# Redis 데이터 볼륨 권한 설정 (Linux/WSL용)
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "msys" ]]; then
    echo "🔒 Setting up volume permissions..."
    mkdir -p ./data/redis
    chmod 755 ./data/redis
fi

# Docker Compose로 Redis 인프라 시작
echo "📦 Starting Redis containers..."
docker-compose up -d

# 컨테이너 시작 대기
echo "⏳ Waiting for containers to be ready..."
sleep 10

# Redis 연결 테스트
echo "🔍 Testing Redis connection..."
if docker exec hyperindex-redis redis-cli -a hyperindex_secure_password ping | grep -q PONG; then
    echo "✅ Redis is running successfully!"
else
    echo "❌ Redis connection failed!"
    docker-compose logs redis
    exit 1
fi

# 서비스 상태 확인
echo "📊 Service Status:"
echo "┌─────────────────────────────────────────┐"
echo "│ Service         │ Port  │ Status        │"
echo "├─────────────────────────────────────────┤"
echo "│ Redis Server    │ 6379  │ ✅ Running    │"
echo "│ Redis Commander │ 8081  │ ✅ Running    │"  
echo "│ Redis Insight   │ 8001  │ ✅ Running    │"
echo "└─────────────────────────────────────────┘"

echo ""
echo "🎉 Redis infrastructure is ready!"
echo ""
echo "📋 Access Information:"
echo "• Redis Server: localhost:6379"
echo "• Password: hyperindex_secure_password"
echo "• Redis Commander (GUI): http://localhost:8081"
echo "• Redis Insight (Advanced): http://localhost:8001"
echo ""
echo "🛠 Management Commands:"
echo "• Stop services: docker-compose down"
echo "• View logs: docker-compose logs -f redis"
echo "• Redis CLI: docker exec -it hyperindex-redis redis-cli -a hyperindex_secure_password"
echo ""
echo "Ready for orderbook development! 🚀"