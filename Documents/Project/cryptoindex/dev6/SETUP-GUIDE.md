# 🚀 HyperEVM SCV 시스템 배포 가이드

## 📋 배포 전 필수 체크리스트

### 1. **API 키 설정** ⚠️ 필수
다음 API 키들을 획득하여 `.env.local`에 설정해야 합니다:

```bash
# Jupiter API (Solana 거래용) - 무료 lite API 사용 (API 키 불필요)
# https://lite-api.jup.ag 무료로 사용 가능

# Alchemy API (Ethereum/Polygon 용)
# https://dashboard.alchemy.com/ 에서 발급  
ALCHEMY_API_KEY=your_actual_alchemy_api_key

# Infura (백업 RPC용)
# https://infura.io/dashboard 에서 발급
INFURA_PROJECT_ID=your_actual_infura_project_id
```

### 2. **지갑 설정** ⚠️ 보안 중요
```bash
# 현재 테스트 키 - 프로덕션에서 반드시 변경!
PRIVATE_KEY=GENERATE_NEW_SECURE_PRIVATE_KEY

# 권장: 멀티시그 지갑 사용
TREASURY_MULTISIG_ADDRESS=your_multisig_address
OPERATIONS_WALLET_ADDRESS=your_operations_address
```

### 3. **네트워크 설정 검증**
```bash
# HyperEVM 연결 테스트
npm run test-hypervm-connection

# 외부 체인 RPC 테스트  
npm run test-external-rpcs
```

### 4. **LayerZero 계약 배포**
LayerZero 메시징을 위한 계약들을 각 체인에 배포해야 합니다:

```bash
# HyperEVM에 메인 계약 배포
npx hardhat deploy --network hypervm-testnet

# 각 외부 체인에 LayerZero 메신저 배포
npx hardhat deploy --network ethereum --tags LayerZero  
npx hardhat deploy --network bsc --tags LayerZero
npx hardhat deploy --network polygon --tags LayerZero
```

## 🔧 단계별 배포 프로세스

### Step 1: 환경 설정
```bash
# 프로덕션 템플릿을 복사하여 실제 값으로 채우기
cp .env.production.template .env.local

# 필수 의존성 설치
npm install

# 환경 설정 검증
npm run verify-env
```

### Step 2: 데이터베이스 설정
```bash
# Supabase 마이그레이션 실행
npm run db-migrate

# 초기 인덱스 데이터 시드
npm run seed-indices
```

### Step 3: 스마트 계약 배포
```bash
# HyperEVM 테스트넷에 배포 (테스트용)
npm run deploy:testnet

# HyperEVM 메인넷에 배포 (프로덕션용)
npm run deploy:mainnet
```

### Step 4: 통합 테스트
```bash
# 전체 시스템 통합 테스트
npm run test:integration

# 실제 자금으로 소액 테스트 (권장: 10 USDC)
npm run test:real-funds
```

### Step 5: 프로덕션 배포
```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm start
```

## ⚠️ 중요한 보안 고려사항

### 1. **Private Key 관리**
- 절대로 실제 private key를 코드에 하드코딩하지 마세요
- AWS Secrets Manager, Azure Key Vault 등 사용 권장
- 멀티시그 지갑 사용 강력 권장

### 2. **API 키 보호**  
- 환경 변수로만 관리
- 프론트엔드에 노출되지 않도록 주의
- 정기적으로 API 키 로테이션

### 3. **네트워크 보안**
- VPC/Private subnet 사용
- WAF (Web Application Firewall) 설정
- Rate limiting 적용

## 📊 모니터링 설정

### 1. **헬스 체크 엔드포인트**
```bash
# 시스템 상태 확인
curl https://yourdomain.com/api/health

# SCV 시스템 상태 확인  
curl https://yourdomain.com/api/scv/health
```

### 2. **알림 설정**
```bash
# Discord/Slack 웹훅 설정
ERROR_WEBHOOK_URL=your_webhook_url

# 이메일 알림
ADMIN_EMAILS=admin@yourdomain.com
```

### 3. **로깅 및 모니터링**
- Sentry: 에러 추적
- Datadog/New Relic: 성능 모니터링  
- CloudWatch: AWS 환경에서 로그 관리

## 🔄 운영 체크리스트

### 일일 점검
- [ ] 시스템 헬스 체크 확인
- [ ] 거래 실패율 모니터링 (<1%)
- [ ] 가스비 및 수수료 모니터링
- [ ] LayerZero 메시지 큐 상태 확인

### 주간 점검  
- [ ] 포지션 리밸런싱 실행 결과 검토
- [ ] API 키 사용량 모니터링
- [ ] 보안 로그 검토
- [ ] 백업 상태 확인

### 월간 점검
- [ ] 의존성 업데이트 검토
- [ ] 보안 패치 적용
- [ ] 성능 메트릭 분석
- [ ] 비용 최적화 검토

## 🆘 장애 대응 가이드

### Emergency Pause 시스템
```bash
# 긴급 시스템 일시 정지
npm run emergency-pause

# 특정 체인만 일시 정지
npm run pause-chain --chain=ethereum
```

### 일반적인 문제 해결

1. **Jupiter API 401 에러**
   - API 키 확인 및 재발급
   - 사용량 한도 확인

2. **LayerZero 메시지 실패**
   - 가스비 부족 확인
   - 네트워크 혼잡 상태 확인
   - 재시도 메커니즘 작동 여부 확인

3. **RPC 연결 실패**
   - 백업 RPC 엔드포인트 확인
   - API 키 유효성 검증
   - 네트워크 연결 상태 점검

## 📞 지원 연락처

- **기술 지원**: tech-support@yourdomain.com
- **보안 이슈**: security@yourdomain.com  
- **긴급 상황**: emergency@yourdomain.com (24/7)

---

이 가이드에 따라 단계별로 진행하면 HyperEVM SCV 시스템을 안전하게 프로덕션 환경에 배포할 수 있습니다. 궁금한 사항이 있으면 언제든 문의해 주세요!