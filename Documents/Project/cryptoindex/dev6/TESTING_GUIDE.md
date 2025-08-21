# 🧪 HyperEVM 테스트넷 완전 테스트 가이드

## 📋 개요
이 가이드는 HyperIndex 플랫폼을 HyperEVM 테스트넷에서 완전히 테스트하는 방법을 제공합니다.

## 🏗️ 아키텍처 요약

```
┌─────────────────┐    ┌───────────────────┐    ┌─────────────────────┐
│  IndexToken     │    │  Factory          │    │  RedemptionManager  │
│  (ERC20)        │◄───┤  (Token Creator)  │──► │  (AMM + Vault)      │
└─────────────────┘    └───────────────────┘    └─────────────────────┘
         │                        │                         │
         ▼                        ▼                         ▼
┌─────────────────┐    ┌───────────────────┐    ┌─────────────────────┐
│  NAV Calculator │    │  Multi-Chain      │    │  LayerZero          │
│  (Price Feeds)  │    │  Aggregator       │    │  Cross-Chain        │
└─────────────────┘    └───────────────────┘    └─────────────────────┘
```

## 🛠️ 사전 준비사항

### 1. 환경 설정
```bash
# .env 파일 설정
PRIVATE_KEY=your_actual_private_key_here
HYPEREVM_RPC=https://api.hyperliquid-testnet.xyz/evm
SEPOLIA_RPC=https://rpc.sepolia.org
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
```

### 2. 테스트넷 토큰 확보
- **HyperEVM Testnet**: [HyperEVM Faucet 링크 필요]
- **Ethereum Sepolia**: https://sepoliafaucet.com/
- **Arbitrum Sepolia**: https://faucet.quicknode.com/arbitrum/sepolia
- **Polygon Amoy**: https://faucet.polygon.technology/

## 🧪 단계별 테스트 프로세스

### 1️⃣ 컴파일 및 기본 확인
```bash
# 컨트랙트 컴파일
npm run compile

# LayerZero 네트워크 연결 확인
node scripts/test-layerzero-crosschain.js
```

### 2️⃣ 로컬 환경 테스트
```bash
# 로컬 전체 워크플로우 테스트
node scripts/full-testnet-demo.js
```

**예상 출력:**
```
🚀 HyperEVM 테스트넷 완전 데모 시작...
✅ IndexTokenFactory: 0x...
✅ MockMultiChainAggregator: 0x...
✅ 발행 완료! 사용자 잔액: 100.0 KTOP4
📈 현재 NAV: 1.0 USDC per token
```

### 3️⃣ HyperEVM 테스트넷 배포
```bash
# HyperEVM 테스트넷에 배포
npm run deploy:testnet

# 또는 직접 실행
npx hardhat run scripts/deploy-vault-system.js --network hyperevmTestnet
```

### 4️⃣ 크로스체인 기능 테스트
```bash
# Arbitrum Sepolia에 배포 (LayerZero 테스트용)
npx hardhat run scripts/deploy-layerzero-oapp.js --network arbitrumSepolia

# Polygon Amoy에 배포
npx hardhat run scripts/deploy-layerzero-oapp.js --network polygonAmoy
```

## 🔍 테스트 시나리오

### 시나리오 1: 기본 토큰 발행/상환
1. **인덱스 펀드 생성** (`K-Crypto Top 4 Index`)
2. **컴포넌트 토큰 설정** (TETH 25%, TBTC 25%, TSOL 25%, TUSDC 25%)
3. **토큰 발행** (100 KTOP4 토큰)
4. **NAV 계산** 확인
5. **토큰 상환** (10 KTOP4 토큰)

### 시나리오 2: 리밸런싱 테스트
```javascript
// 리밸런싱 필요성 확인
const needsRebalancing = await rebalancingEngine.checkRebalanceNeeded(vaultAddress);

// 실제 리밸런싱 실행
if (needsRebalancing) {
    await rebalancingEngine.executeRebalancing(vaultAddress);
}
```

### 시나리오 3: 크로스체인 메시징
```javascript
// HyperEVM → Arbitrum Sepolia 메시지
await layerZeroMessaging.sendMessage(
    40231, // Arbitrum Sepolia EID
    payload,
    { value: ethers.parseEther("0.005") }
);
```

## 📊 모니터링 및 검증

### 핵심 메트릭스
- **가스 사용량**: 각 트랜잭션별 가스 소모량
- **슬리피지**: 토큰 교환 시 가격 영향
- **NAV 정확도**: 실시간 가격 반영 정확성
- **크로스체인 지연시간**: LayerZero 메시지 전달 속도

### 검증 포인트
```javascript
// NAV 검증
const nav = await indexToken.getNavPerToken();
assert(nav > 0, "NAV must be positive");

// 총 공급량 검증
const totalSupply = await indexToken.totalSupply();
const totalValue = await indexToken.getTotalFundValue();
assert(totalValue > 0, "Total value must be positive");

// 컴포넌트 비율 검증
const components = await indexToken.getComponents();
let totalWeight = 0;
components.forEach(comp => totalWeight += comp.weight);
assert(totalWeight === 10000, "Total weight must be 100%");
```

## 🚨 알려진 이슈 및 해결방법

### 이슈 1: HyperEVM RPC 연결 실패
**증상**: `404 Not Found` 에러
**해결**: 
- RPC URL 확인: `https://rpc.hyperliquid-testnet.xyz/evm`
- 또는 `https://api.hyperliquid-testnet.xyz/evm` 시도

### 이슈 2: LayerZero Endpoint 호출 실패
**증상**: `execution reverted` 에러
**원인**: OApp 컨트랙트 없이는 직접 호출 불가
**해결**: 정상적인 동작, OApp 배포 후 재시도

### 이슈 3: 가스 부족
**증상**: `insufficient funds for gas`
**해결**: 각 테스트넷에서 토큰 확보

## 🎯 성공 기준

### ✅ 기본 기능
- [ ] 컨트랙트 컴파일 성공 (48개 파일)
- [ ] IndexToken 생성 및 발행
- [ ] NAV 계산 정확성
- [ ] 토큰 상환 기능

### ✅ 고급 기능  
- [ ] 리밸런싱 엔진 작동
- [ ] 크로스체인 메시지 전송
- [ ] 수수료 관리 시스템
- [ ] 모니터링 및 알람

### ✅ 성능 기준
- 토큰 발행: < 30초
- NAV 계산: < 5초
- 크로스체인 메시지: < 10분
- 가스 효율성: < 500,000 gas per tx

## 🔧 디버깅 도구

### 로그 확인
```bash
# Hardhat 네트워크 로그
npx hardhat node --verbose

# 트랜잭션 추적
npx hardhat trace <tx_hash> --network hyperevmTestnet
```

### 상태 확인
```bash
# 배포된 컨트랙트 확인
npx hardhat verify <contract_address> --network hyperevmTestnet

# 잔액 확인
npx hardhat run scripts/check-balances.js --network hyperevmTestnet
```

## 📞 지원 및 연락처

- **HyperEVM 문서**: [링크 필요]
- **LayerZero 문서**: https://layerzero.gitbook.io/
- **이슈 리포트**: GitHub Issues

---

## 🎉 최종 체크리스트

실제 배포 전 다음 항목들을 확인하세요:

- [ ] 모든 테스트 통과
- [ ] 보안 감사 완료
- [ ] 가스 최적화 확인
- [ ] 크로스체인 연결 안정성
- [ ] 모니터링 시스템 준비
- [ ] 긴급상황 대응 계획

**💡 준비가 완료되면 실제 HyperEVM 테스트넷에서 전체 워크플로우를 테스트할 수 있습니다!**