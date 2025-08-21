# 🪙 HyperEVM 테스트넷 토큰 확보 가이드

## ⚠️ 중요 사항
- **테스트넷 토큰은 실제 가치가 없는 "가짜" 토큰입니다**
- **메인넷 자산(USDT, ETH 등)과는 완전히 별개입니다**
- **절대 실제 돈을 잃을 위험이 없습니다**

## 🎯 현재 상황
- HyperEVM 테스트넷 RPC: ✅ 작동 중 (`https://rpc.hyperliquid-testnet.xyz/evm`)
- 테스트 주소 잔액: 0 HYPE (토큰 필요)

## 🔍 HyperEVM 테스트넷 토큰 확보 방법

### 방법 1: Hyperliquid 공식 채널
1. **Discord 서버 접속**
   - Hyperliquid Discord 서버 찾기
   - `#testnet-faucet` 또는 `#faucet` 채널 이용
   - 지갑 주소 요청: `0x81Bf724a8101EC81540fA841fD1E68076A8101cd`

2. **Telegram 채널**
   - Hyperliquid Telegram 그룹 접속
   - 테스트넷 관련 채널에서 토큰 요청

3. **공식 문서 확인**
   - https://hyperliquid.gitbook.io/ 에서 faucet 정보 찾기

### 방법 2: 다른 테스트넷에서 브릿지 (가능한 경우)
```bash
# 1. Ethereum Sepolia ETH 확보
# https://sepoliafaucet.com/ 접속
# 주소 입력: 0x81Bf724a8101EC81540fA841fD1E68076A8101cd

# 2. Arbitrum Sepolia ETH 확보  
# https://faucet.quicknode.com/arbitrum/sepolia 접속

# 3. 확보된 토큰으로 브릿지 시도 (LayerZero 이용)
```

## 🛠️ 현재 가능한 테스트

### 1. 다른 테스트넷에서 LayerZero 테스트
```bash
# Arbitrum Sepolia에서 테스트 (작동 확인됨)
npx hardhat run scripts/deploy-layerzero-oapp.js --network arbitrumSepolia

# Polygon Amoy에서 테스트 (작동 확인됨)  
npx hardhat run scripts/deploy-layerzero-oapp.js --network polygonAmoy
```

### 2. 로컬 환경에서 완전 테스트
```bash
# 로컬 Hardhat 네트워크에서 전체 워크플로우 테스트
npx hardhat node  # 터미널 1
node scripts/full-testnet-demo.js  # 터미널 2
```

## 📱 MetaMask 설정

### HyperEVM 테스트넷 추가
```javascript
// MetaMask 개발자 콘솔에서 실행
ethereum.request({
  method: "wallet_addEthereumChain",
  params: [{
    chainId: "0x3E6", // 998 in hex
    chainName: "HyperEVM Testnet",
    rpcUrls: ["https://rpc.hyperliquid-testnet.xyz/evm"],
    nativeCurrency: {
      name: "HYPE",
      symbol: "HYPE", 
      decimals: 18
    },
    blockExplorerUrls: ["https://explorer.hyperliquid.xyz"] // 추정
  }]
});
```

## 🔄 토큰 확보 후 실행 순서

### 1. 잔액 확인
```bash
cast balance 0x81Bf724a8101EC81540fA841fD1E68076A8101cd --rpc-url https://rpc.hyperliquid-testnet.xyz/evm
```

### 2. .env 파일 설정
```env
PRIVATE_KEY=your_actual_private_key_here
HYPEREVM_RPC=https://rpc.hyperliquid-testnet.xyz/evm
```

### 3. 컨트랙트 배포
```bash
npm run deploy:testnet
```

### 4. 전체 워크플로우 테스트
```bash
# 1. Factory로 인덱스 토큰 생성
# 2. 테스트 토큰으로 입금
# 3. NAV 계산 확인
# 4. 리밸런싱 테스트
# 5. 토큰 상환 테스트
```

## 🎯 대체 테스트 방안

### HyperEVM 토큰을 못 받는 경우:
1. **Arbitrum Sepolia에서 완전 테스트**
   - Arbitrum Sepolia ETH 확보 (faucet 작동 확인)
   - 전체 시스템 Arbitrum에 배포
   - LayerZero로 다른 체인과 연결 테스트

2. **로컬 환경에서 시뮬레이션**  
   - Hardhat 로컬 네트워크 사용
   - 모든 기능 완전 테스트
   - 가스 비용 및 성능 측정

3. **멀티체인 테스트**
   - Sepolia ↔ Arbitrum Sepolia ↔ Polygon Amoy
   - LayerZero 크로스체인 메시징 실제 테스트
   - HyperEVM 없이도 전체 아키텍처 검증

## 📞 도움 요청 채널

1. **Hyperliquid 공식 채널**
   - Discord: https://discord.gg/hyperliquid (추정)
   - Twitter: @hyperliquid_xyz
   - Docs: https://hyperliquid.gitbook.io/

2. **LayerZero 도움**
   - Discord: https://discord.gg/layerzero
   - Docs: https://layerzero.gitbook.io/

## ✅ 체크리스트

현재 준비 상황:
- [x] 컨트랙트 컴파일 완료 (48개)
- [x] LayerZero 통합 완료  
- [x] 테스트 스크립트 준비
- [x] 멀티체인 설정 완료
- [x] Arbitrum Sepolia/Polygon Amoy 연결 확인
- [ ] HyperEVM 테스트넷 토큰 확보
- [ ] 실제 HyperEVM 배포 및 테스트

**💡 HyperEVM 토큰을 받지 못해도 Arbitrum Sepolia에서 완전한 테스트가 가능합니다!**