# 🚿 Arbitrum Sepolia ETH Faucet 링크 모음

## 🎯 지갑 주소
`0xAea84E8e49E1fF987a310e516A2add680b4A1957`

## 💧 추천 Faucet 순서

### 1. QuickNode Faucet ⭐
- **URL**: https://faucet.quicknode.com/arbitrum/sepolia
- **제공량**: 0.1 ETH
- **빈도**: 24시간마다
- **상태**: ✅ 추천

### 2. Alchemy Faucet
- **URL**: https://sepoliafaucet.com/
- **제공량**: 0.25 ETH (Sepolia ETH)
- **주의**: Ethereum Sepolia → Arbitrum Sepolia 브리지 필요

### 3. Chainlink Faucet  
- **URL**: https://faucets.chain.link/arbitrum-sepolia
- **제공량**: 0.1 ETH
- **빈도**: 24시간마다

### 4. LearnWeb3 Faucet
- **URL**: https://learnweb3.io/faucets/arbitrum_sepolia
- **제공량**: 0.025 ETH
- **빈도**: 24시간마다

### 5. GetBlock Faucet
- **URL**: https://getblock.io/faucet/arbitrum-sepolia
- **제공량**: 0.001 ETH
- **빈도**: 24시간마다

## 🌉 브리지 방법 (Ethereum Sepolia → Arbitrum Sepolia)

1. **Ethereum Sepolia ETH 확보**: https://sepoliafaucet.com/
2. **공식 Arbitrum 브리지**: https://bridge.arbitrum.io/?l2ChainId=421614
3. **최소 브리지량**: 0.01 ETH

## 🔧 수동 확인 명령어

```bash
# 잔액 확인
cast balance 0xAea84E8e49E1fF987a310e516A2add680b4A1957 --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# 또는 Hardhat으로
npx hardhat run scripts/simple-arbitrum-deploy.js --network arbitrumSepolia
```

## ⚡ 빠른 실행 스크립트

Faucet에서 토큰을 받은 후:
```bash
# 1. 잔액 확인
npx hardhat run scripts/simple-arbitrum-deploy.js --network arbitrumSepolia

# 2. TestHYPE 배포
npx hardhat run scripts/deploy-test-hype.js --network arbitrumSepolia

# 3. 전체 워크플로우 테스트
npx hardhat run scripts/test-hype-workflow.js --network arbitrumSepolia
```