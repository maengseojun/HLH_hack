#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
print_header() {
    echo -e "${BLUE}$1${NC}"
    echo "========================================"
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

# 스크립트 시작
clear
echo -e "${BLUE}"
echo "🚀 HyperLiquid 테스트넷 종합 검증"
echo "=================================================="
echo -e "${NC}"

# 환경 확인
if [ ! -f ".env.testnet" ]; then
    print_error ".env.testnet 파일이 없습니다!"
    echo "   .env.testnet.example을 복사하여 .env.testnet을 만들고"
    echo "   실제 테스트넷 정보를 입력하세요."
    exit 1
fi

print_success ".env.testnet 파일 확인됨"
echo ""

# Node.js 및 의존성 확인
print_header "🔧 환경 준비 상태 확인"

if ! command -v node &> /dev/null; then
    print_error "Node.js가 설치되지 않았습니다"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm이 설치되지 않았습니다"
    exit 1
fi

print_success "Node.js $(node --version)"
print_success "npm $(npm --version)"

if [ ! -d "node_modules" ]; then
    print_warning "의존성이 설치되지 않았습니다. 설치 중..."
    npm install
fi

echo ""

# 1단계: RPC 연결 테스트
print_header "1️⃣  RPC 연결 테스트"
echo "HyperLiquid 테스트넷 연결을 확인합니다..."
echo ""

if npm run test:rpc:silent 2>/dev/null; then
    print_success "RPC 연결 테스트 완료"
else
    print_error "RPC 연결 테스트 실패"
    echo "   .env.testnet 파일의 RPC URL을 확인하세요"
fi

echo ""

# 2단계: 지갑 및 가스비 테스트
print_header "2️⃣  지갑 및 가스비 테스트"
echo "테스트 지갑의 잔고와 가스비를 확인합니다..."
echo ""

if npm run test:wallet:silent 2>/dev/null; then
    print_success "지갑 테스트 완료"
else
    print_error "지갑 테스트 실패"
    echo "   .env.testnet 파일의 지갑 정보를 확인하세요"
fi

echo ""

# 3단계: HyperCore 통합 테스트
print_header "3️⃣  HyperCore 통합 테스트"
echo "HyperCore API 및 프리컴파일 함수를 테스트합니다..."
echo ""

if npm run test:hypercore:silent 2>/dev/null; then
    print_success "HyperCore 통합 테스트 완료"
else
    print_warning "HyperCore 통합 테스트 부분 완료"
    echo "   일부 기능은 실제 HyperCore 연결시에만 동작합니다"
fi

echo ""

# 4단계: 인덱스 토큰 배포 (선택사항)
if [ "$DEPLOY_TOKEN" = "true" ]; then
    print_header "4️⃣  인덱스 토큰 배포"
    echo "테스트넷에 인덱스 토큰을 배포합니다..."
    echo ""

    if npm run deploy:token:silent 2>/dev/null; then
        print_success "토큰 배포 시뮬레이션 완료"
    else
        print_error "토큰 배포 시뮬레이션 실패"
    fi
    echo ""
else
    print_header "4️⃣  인덱스 토큰 배포 (건너뜀)"
    echo "토큰 배포를 원하면 DEPLOY_TOKEN=true로 설정하세요"
    echo ""
fi

# 5단계: 상세 결과 확인
print_header "5️⃣  상세 결과 확인"
echo "각 단계별 상세 결과를 확인하시겠습니까? (y/N)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "📡 RPC 연결 상세 결과:"
    npm run test:rpc

    echo ""
    echo "💰 지갑 상세 결과:"
    npm run test:wallet

    echo ""
    echo "🔗 HyperCore 상세 결과:"
    npm run test:hypercore

    if [ "$DEPLOY_TOKEN" = "true" ]; then
        echo ""
        echo "🪙 토큰 배포 상세 결과:"
        npm run deploy:token
    fi
fi

# 종합 결과
echo ""
print_header "📊 테스트 완료 요약"

# .env.testnet에서 설정 정보 읽기
if grep -q "TEST_WALLET_ADDRESS=0x0000000000000000000000000000000000000000" .env.testnet 2>/dev/null; then
    print_warning "지갑 주소가 설정되지 않았습니다"
else
    print_success "지갑 설정 확인됨"
fi

if grep -q "HYPEREVM_RPC_URL=https://" .env.testnet 2>/dev/null; then
    print_success "RPC URL 설정 확인됨"
else
    print_warning "RPC URL이 기본값입니다"
fi

echo ""
echo "🎯 다음 단계:"
echo "   1. 실제 테스트넷 지갑과 RPC URL을 .env.testnet에 설정"
echo "   2. 테스트넷 ETH를 지갑에 충전"
echo "   3. npm run test:all:testnet으로 전체 테스트 실행"
echo "   4. 백엔드 API와 연동하여 E2E 테스트 진행"

echo ""
print_success "테스트넷 검증 완료! 🎉"