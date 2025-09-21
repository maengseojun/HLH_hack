# 🎯 **CoreWriter와 Precompile 정보 정리**

## 📍 **주요 주소들**

### **CoreWriter 시스템 컨트랙트**
```
주소: 0x3333333333333333333333333333333333333333
함수: sendRawAction(bytes data)
가스 비용: ~47,000 gas per call
```

### **Precompile 주소들 (읽기 전용)**
```
0x0000000000000000000000000000000000000800 - 포지션 조회
0x0000000000000000000000000000000000000801 - 스팟 잔액
0x0000000000000000000000000000000000000802 - 볼트 정보
0x0000000000000000000000000000000000000803 - 스테이킹 위임
0x0000000000000000000000000000000000000804 - 오라클 가격
0x0000000000000000000000000000000000000805 - L1 블록 번호
0x0000000000000000000000000000000000000807 - 퍼프 오라클 가격
0x0000000000000000000000000000000000000808 - 스팟 가격
```

## 🛠 **Action IDs와 파라미터**

| Action ID | 액션 | 파라미터 |
|-----------|------|----------|
| 1 | Limit Order | `(uint32 asset, bool isBuy, uint64 limitPx, uint64 sz, bool reduceOnly, uint8 encodedTif, uint128 cloid)` |
| 2 | Vault Transfer | `(address vault, bool isDeposit, uint64 usd)` |
| 3 | Token Delegate | `(address validator, uint64 wei, bool isUndelegate)` |
| 4 | Staking Deposit | `uint64 wei` |
| 5 | Staking Withdraw | `uint64 wei` |
| 6 | Spot Send | `(address destination, uint64 token, uint64 wei)` |
| 7 | USD Class Transfer | `(uint64 ntl, bool toPerp)` |
| 8 | Finalize EVM Contract | `(uint64 token, uint8 encodedFinalizeEvmContractVariant, uint64 createNonce)` |
| 9 | Add API Wallet | `(address wallet, string name)` |
| 10 | Cancel Order by OID | `(uint32 asset, uint64 oid)` |
| 11 | Cancel Order by CLOID | `(uint32 asset, uint128 cloid)` |

## 📝 **사용 예시**

### **TypeScript에서 CoreWriter 사용**
```typescript
import { coreWriterService, TIF } from './services/coreWriter.js';
import { ethers } from 'ethers';

// BTC 롱 포지션 오픈 (1 BTC, $50,000 limit price)
await coreWriterService.placeLimitOrder({
  asset: 0, // BTC asset ID
  isBuy: true,
  limitPx: ethers.BigNumber.from("5000000000000"), // $50,000 * 10^8
  sz: ethers.BigNumber.from("100000000"), // 1 BTC * 10^8
  reduceOnly: false,
  tif: TIF.GTC, // Good Till Cancelled
  cloid: ethers.BigNumber.from(0) // No client order ID
});

// Perp-Spot 간 USD 이동
await coreWriterService.usdClassTransfer({
  ntl: ethers.BigNumber.from("1000000000"), // $1000 * 10^6
  toPerp: true // Spot → Perp
});

// 포지션 조회
const position = await coreWriterService.readPerpPosition(
  "0x1234567890123456789012345678901234567890", // user address
  0 // BTC asset ID
);
console.log(`Position size: ${position.szi.toString()}`);
```

### **Solidity에서 CoreWriter 사용**
```solidity
// HyperCoreActions 컨트랙트 배포 후
HyperCoreActions actions = HyperCoreActions(deployedAddress);

// BTC 매수 주문
actions.placeLimitOrder(
    0,                    // BTC asset
    true,                 // isBuy
    5000000000000,        // $50,000 limit price
    100000000,            // 1 BTC size
    false,                // not reduce only
    2,                    // GTC
    0                     // no cloid
);
```

## 🔧 **데이터 변환**

### **가격 변환 공식**
- **Perp**: `가격 / 10^(6 - szDecimals)`
- **Spot**: `가격 / 10^(8 - baseAssetDecimals)`

### **일반적인 값들**
- **USD 값**: `실제값 * 10^6` (예: $1000 → 1000000000)
- **BTC 크기**: `실제값 * 10^8` (예: 1 BTC → 100000000)
- **가격**: `실제가격 * 10^8` (예: $50,000 → 5000000000000)

## ⚠️ **중요사항**

1. **Non-atomic Operations**: CoreWriter 작업은 원자성을 보장하지 않습니다
2. **Delayed Execution**: 주문과 볼트 전송은 몇 초간 지연됩니다
3. **Gas Cost**: 기본 호출당 ~47,000 gas 소모
4. **Precompile 오류**: 잘못된 입력 시 모든 가스를 소모합니다

## 🧪 **테스트 명령어**

```bash
# Precompile 테스트 (BTC 오라클 가격 조회)
cast call 0x0000000000000000000000000000000000000807 \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  --rpc-url https://rpc.hyperliquid-testnet.xyz/evm

# CoreWriter 테스트는 실제 트랜잭션이 필요하므로 
# TypeScript 서비스를 통해 테스트하세요
```

이제 CoreWriter와 Precompile을 완전히 활용할 수 있습니다! 🚀
