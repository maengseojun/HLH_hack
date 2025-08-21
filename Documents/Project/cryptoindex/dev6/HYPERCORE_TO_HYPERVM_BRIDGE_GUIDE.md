# HyperCore → HyperEVM Mock USDC 브릿지 가이드

## 현재 상황
- HyperCore에 Mock USDC 1000개 보유
- HyperEVM 테스트넷 MetaMask 연결 완료
- 목표: Mock USDC → HyperEVM으로 이동

## 🌉 방법 1: HyperLiquid 공식 브릿지 (권장)

### 1.1 HyperLiquid 앱 접속
```
https://app.hyperliquid.xyz/
```

### 1.2 브릿지 메뉴 이용
1. **"Bridge"** 메뉴 클릭
2. **From**: HyperCore
3. **To**: HyperEVM
4. **Asset**: Mock USDC 선택
5. **Amount**: 1000 USDC 입력
6. **Destination**: 본인 HyperEVM 주소 입력

### 1.3 트랜잭션 실행
- HyperCore에서 승인 트랜잭션
- 자동으로 HyperEVM으로 도착 (보통 1-2분)

## 🌉 방법 2: HYPE → HyperEVM 직접 이동 (대안)

### 2.1 HyperCore에서 Mock USDC → HYPE 스왑
```javascript
// HyperCore에서 실행
const swapToHYPE = await hyperCore.swap({
  from: 'Mock USDC',
  to: 'HYPE',
  amount: 1000
});
```

### 2.2 HYPE → HyperEVM 브릿지
```javascript
// HYPE를 HyperEVM으로 브릿지
const bridgeHYPE = await hyperBridge.transfer({
  from: 'HyperCore',
  to: 'HyperEVM',
  asset: 'HYPE',
  amount: swapToHYPE.outputAmount,
  destination: '0x[YOUR_HYPERVM_ADDRESS]'
});
```

## 🔧 브릿지 후 다음 단계

### 3.1 HyperEVM에서 확인
```typescript
// HyperEVM 테스트넷에서 잔고 확인
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://api.hyperliquid-testnet.xyz/evm');
const balance = await provider.getBalance('YOUR_ADDRESS');
console.log('HYPE Balance:', ethers.formatEther(balance));
```

### 3.2 HyperIndex 토큰 배포 및 페어 생성

#### A) HyperIndex 토큰 배포
```solidity
// 이미 준비된 HyperIndexToken.SECURE.sol 사용
const hyperIndexToken = await deploy('HyperIndexToken');
```

#### B) AMM Factory & Router 배포
```solidity
// 1. Factory 배포
const factory = await deploy('HyperIndexFactory', [feeToSetter]);

// 2. Router 배포 (WHYPE 주소 필요)
const router = await deploy('HyperIndexRouter', [factory.address, WHYPE_ADDRESS]);
```

#### C) HYPERINDEX-HYPE 페어 생성
```typescript
// 페어 생성
const createPairTx = await factory.createPair(
  hyperIndexToken.address,
  HYPE_ADDRESS // 또는 WHYPE_ADDRESS
);
```

### 3.3 초기 유동성 제공
```typescript
// 초기 유동성 추가 (예: 1:1 비율)
const addLiquidityTx = await router.addLiquidityHYPE(
  hyperIndexToken.address,
  ethers.parseEther('500'), // 500 HYPERINDEX
  ethers.parseEther('450'), // 최소 450 HYPERINDEX
  ethers.parseEther('450'), // 최소 450 HYPE
  YOUR_ADDRESS,
  Math.floor(Date.now() / 1000) + 1200, // 20분 데드라인
  { value: ethers.parseEther('500') } // 500 HYPE
);
```

## 🎯 완료 후 테스트

### 4.1 스왑 테스트
```typescript
// HYPE → HYPERINDEX 스왑 테스트
const swapTx = await router.swapExactHYPEForTokens(
  ethers.parseEther('0'), // 최소 출력값 (슬리피지 보호)
  [WHYPE_ADDRESS, hyperIndexToken.address], // 스왑 경로
  YOUR_ADDRESS,
  Math.floor(Date.now() / 1000) + 1200,
  { value: ethers.parseEther('10') } // 10 HYPE로 스왑
);
```

### 4.2 HyperVMAMM 연동 테스트
```typescript
// HyperVMAMM으로 스왑 테스트
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';

const amm = new HyperVMAMM(
  'https://api.hyperliquid-testnet.xyz/evm',
  {
    router: router.address,
    factory: factory.address,
    hyperIndex: hyperIndexToken.address,
    usdc: HYPE_ADDRESS, // HYPE를 "USDC" 역할로 사용
    pair: pairAddress
  }
);

// 스왑 실행
const result = await amm.executeSwap({
  tokenIn: HYPE_ADDRESS,
  tokenOut: hyperIndexToken.address,
  amountIn: ethers.parseEther('5').toString(),
  slippageTolerance: 100, // 1%
  recipient: YOUR_ADDRESS
});
```

## 🚨 중요 주의사항

### 보안 고려사항
1. **Private Key 보안**: 테스트넷이어도 안전하게 관리
2. **Gas 한도**: HyperEVM은 가스비가 저렴하지만 충분한 HYPE 보유
3. **슬리피지**: 초기에는 유동성이 적어 높은 슬리피지 발생 가능

### 성능 최적화
1. **배치 거래**: 여러 거래를 배치로 처리
2. **가스 최적화**: HyperEVM 특성에 맞게 조정
3. **MEV 보호**: SecureTPSEngine과 연동

## ✅ 최종 체크리스트

배포 완료 후 확인사항:
- [ ] HyperCore → HyperEVM 자산 이동 완료
- [ ] HyperIndex 토큰 배포 완료
- [ ] AMM Factory & Router 배포 완료
- [ ] 초기 페어 생성 및 유동성 제공 완료
- [ ] HyperVMAMM 연동 테스트 완료
- [ ] SmartRouterV2 통합 테스트 완료
- [ ] 보안 검토 완료

이 과정을 완료하면 **실제 HyperEVM에서 작동하는 AMM**을 테스트할 수 있습니다!