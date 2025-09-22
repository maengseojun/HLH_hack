# 🚀 HyperLiquid 테스트넷 통합 가이드

이 가이드는 HyperLiquid 테스트넷에서 실제 인덱스 토큰과 바스켓 플로우를 테스트하는 방법을 설명합니다.

## 📋 준비사항

### 1. 테스트넷 지갑 준비
- 테스트넷용 지갑 생성 (MetaMask 등)
- 프라이빗 키 확보
- 테스트넷 ETH 충전 (faucet 이용)

### 2. HyperLiquid 테스트넷 정보
- **HyperEVM RPC**: `https://api.hyperliquid-testnet.xyz/evm`
- **HyperCore RPC**: `https://api.hyperliquid-testnet.xyz/evm`
- **Info API**: `https://api.hyperliquid-testnet.xyz/info`
- **Chain ID**: `998` (또는 실제 테스트넷 체인 ID)

## 🔧 환경 설정

### 1. 환경 파일 생성
```bash
# .env.testnet.example을 복사
cp .env.testnet.example .env.testnet
```

### 2. .env.testnet 파일 편집
```bash
# HyperLiquid 테스트넷 RPC
HYPERCORE_RPC_URL=https://api.hyperliquid-testnet.xyz/evm
HYPEREVM_RPC_URL=https://api.hyperliquid-testnet.xyz/evm
HYPERLIQUID_INFO_URL=https://api.hyperliquid-testnet.xyz/info

# 실제 테스트넷 지갑 정보 입력
TEST_WALLET_PRIVATE_KEY=0x여기에_실제_프라이빗키_입력
TEST_WALLET_ADDRESS=0x여기에_실제_지갑주소_입력

# 체인 설정 (실제 값으로 업데이트)
CHAIN_ID=998
GAS_LIMIT=2000000
GAS_PRICE=1000000000
```

## 🧪 테스트 실행

### 1. 종합 테스트 실행
```bash
# 모든 테스트넷 연결을 확인
npm run test:testnet
```

### 2. 개별 테스트 실행
```bash
# RPC 연결 테스트
npm run test:rpc

# 지갑 및 가스비 테스트
npm run test:wallet

# HyperCore 통합 테스트
npm run test:hypercore

# 인덱스 토큰 배포 시뮬레이션
npm run deploy:token
```

### 3. E2E 테스트와 함께 실행
```bash
# 테스트넷 + E2E 통합 테스트
npm run test:all:testnet
```

## 📊 테스트 시나리오

### 1. 기본 연결 테스트
- ✅ HyperEVM RPC 연결
- ✅ HyperCore RPC 연결
- ✅ HyperLiquid Info API 연결
- ✅ 지갑 잔고 확인
- ✅ 가스비 계산

### 2. API 통합 테스트
- ✅ metaAndAssetCtxs API 호출
- ✅ clearinghouseState API 호출
- ✅ 사용자 포지션 조회
- ✅ 자산 정보 확인

### 3. 블록체인 상호작용
- ✅ Precompile 함수 호출 (포지션 조회)
- ✅ CoreWriter 접근성 확인
- ✅ 가스 예측 및 트랜잭션 시뮬레이션

### 4. 인덱스 토큰 테스트
- ✅ ERC20 토큰 배포 준비
- ✅ 토큰 메타데이터 설정
- ✅ Mint/Burn 권한 관리

## 🔍 트러블슈팅

### 연결 문제
```bash
❌ HyperEVM connection failed: Network error
```
**해결방법**:
- RPC URL이 올바른지 확인
- 네트워크 연결 상태 확인
- 방화벽 설정 확인

### 인증 문제
```bash
❌ Wallet test failed: Invalid private key
```
**해결방법**:
- 프라이빗 키 형식 확인 (0x로 시작하는 64자)
- 지갑 주소와 프라이빗 키 일치 확인

### 잔고 부족
```bash
⚠️ Low balance - may not be sufficient for multiple transactions
```
**해결방법**:
- 테스트넷 faucet에서 ETH 요청
- Bridge를 통한 ETH 전송

### API 오류
```bash
❌ Info API connection failed: HTTP 403
```
**해결방법**:
- API URL 확인
- Rate limiting 확인
- API 키 필요 여부 확인

## 📈 성공 지표

### ✅ 모든 테스트 통과 시
```
✅ HyperEVM connected
✅ HyperCore connected
✅ HyperLiquid Info API connected
✅ Wallet test passed
✅ Gas estimation successful
✅ MetaAndAssetCtxs API working
✅ User state API working
✅ Precompile call successful
```

### 📋 다음 단계
1. **실제 거래 테스트**: 소액 테스트 거래 실행
2. **포지션 관리**: 실제 포지션 열기/닫기
3. **인덱스 토큰 배포**: 실제 컨트랙트 배포
4. **바스켓 조립**: HyperCore를 통한 바스켓 관리
5. **E2E 통합**: 프론트엔드와 백엔드 연동

## 🎯 주요 명령어 요약

```bash
# 환경 설정
cp .env.testnet.example .env.testnet
# .env.testnet 파일 편집

# 빠른 테스트
npm run test:testnet

# 상세 테스트
npm run test:rpc         # RPC 연결
npm run test:wallet      # 지갑 테스트
npm run test:hypercore   # HyperCore 테스트
npm run deploy:token     # 토큰 배포

# 전체 E2E 테스트
npm run test:all:testnet
```

## 📞 지원

문제 발생 시:
1. 각 테스트 스크립트의 상세 출력 확인
2. `.env.testnet` 설정 재검토
3. HyperLiquid 테스트넷 상태 확인
4. GitHub Issues에 문제 제보

---

🎉 **테스트넷 통합을 통해 실제 블록체인 환경에서 HyperIndex의 모든 기능을 검증할 수 있습니다!**