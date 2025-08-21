# 🔐 User Onboarding & 세션 키 시스템 개선 방안
*작성일: 2025-07-31*

## 📋 문서 개요
HyperIndex의 User Onboarding 로직 검토 및 Hyperliquid 세션 키 시스템 구현 방안을 정리한 문서

Related Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets
https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading
https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-use-the-hyperevm
https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
https://hyperliquid.gitbook.io/hyperliquid-docs/hyperevm/tools-for-hyperevm-builders

---

## 🎯 현재 User Onboarding 로직 (검증 완료)

### ✅ Type A: Email 사용자
```typescript
interface EmailUserFlow {
  step1: "이메일 6자리 인증 (Privy)";
  step2: "Privy Embedded 지갑 생성";
  step3: "Privy EVM 주소 지갑에 Hyperliquid 네트워크 추가";
  step4: "이메일은 인증 및 로그인용으로만 사용";
  step5: "사용자 확인은 세션 단위로 관리되어, 거래 시 서명 불필요";
}
```

### ✅ Type B: External Wallet 사용자
```typescript
interface ExternalWalletUserFlow {
  step1: "External Wallet Connection (MetaMask 등 EVM형태 & Phantom 등 Sol형태)";
  step2: "Privy Embedded 지갑 생성";
  step3: "Privy EVM 주소 지갑에 Hyperliquid 네트워크 추가";
  step4: "External Wallet은 인증 및 로그인용, 그리고 입금 및 브릿지용으로 사용";
  step5: "예: External Wallet의 Arbitrum 200USDC → Privy EVM주소 지갑의 Hyperliquid 네트워크로 브릿지 가능";
  step6: "사용자 확인은 세션 단위로 관리되어, 거래 시 서명 불필요";
}
```

---

## 🚨 현재 불완벽한 부분들

### 1. **세션 관리 시스템 미구현** 🔴
- **현재**: 매 거래마다 개인키 요구
- **필요**: Hyperliquid 스타일 세션 키 시스템

### 2. **Hyperliquid 네트워크 자동 추가 미구현** 🟡
- **현재**: 사용자가 수동으로 네트워크 추가 필요
- **필요**: Privy에서 자동으로 Hyperliquid 네트워크 설정

### 3. **크로스체인 브릿지 Mock 상태** 🔴
- **현재**: `cross-chain-balance-service.ts`가 모두 시뮬레이션
- **필요**: Arbitrum → Hyperliquid 실제 브릿지 연동

### 4. **External Wallet 입금 플로우 미완성** 🟡
- **현재**: 기본 구조만 있음
- **필요**: External Wallet → Privy Embedded 자동 브릿지

---

## 🔐 Hyperliquid 세션 키 시스템 분석

### **✅ 간단한 부분:**
1. **API 지갑 = 세션 키**: 별도의 개인키로 거래 서명
2. **Master → Agent 승인**: 메인 지갑이 API 지갑에게 거래 권한 부여
3. **Query vs Signing 분리**: API 지갑은 서명만, 조회는 메인 지갑

### **🔴 복잡한 부분:**
1. **Nonce 관리**: 
   - 100개 최고 nonce 저장 (sliding window 방식)
   - 새 nonce는 가장 작은 값보다 커야 함
   - 시간 윈도우: `(T-2일, T+1일)` 내에서만 유효

2. **동시성 처리**:
   - 병렬 거래 시 각각 별도 API 지갑 필요
   - Atomic counter로 nonce 충돌 방지

3. **서명 복잡성**:
   - 두 가지 서명 스키마: "sign_l1_action" vs "sign_user_signed_action"
   - msgpack 필드 순서 중요
   - 주소 소문자 변환 필요
   - SDK 사용 강력 권장 (수동 구현 시 오류 위험)

---

## 🌐 Hyperliquid 아키텍처 완전한 이해

### **🏗️ HyperCore vs HyperEVM 구조**
```typescript
interface HyperliquidArchitecture {
  // 하나의 L1 블록체인 (별도 네트워크 아님!)
  hyperliquidL1: {
    consensus: "HyperBFT";
    blockTime: "1초 (Small Block) | 1분 (Big Block)";
    
    // 두 개의 레이어 (같은 체인의 다른 기능)
    hyperCore: {
      purpose: "거래 전용 고성능 레이어";
      features: ["spot 오더북", "perp 오더북", "가스비 없음", "200k TPS"];
      assets: "Core spot (USDC, HYPE, 배포된 토큰들)";
      validation: "2/3 검증자 합의";
    };
    
    hyperEVM: {
      purpose: "스마트 컨트랙트 레이어";
      features: ["EVM 호환", "DeFi dApp", "일반 가스비"];
      assets: "EVM spot (ERC-20 형태)";
      chainId: 999;
      rpc: "https://rpc.hyperliquid.xyz/evm";
    };
  };
}
```

### **💰 USDC 플로우와 거래 위치**
```typescript
interface USDCFlowAndTrading {
  // 입금된 USDC는 HyperCore에 저장됩니다!
  depositLocation: "HyperCore (Core spot USDC)";
  
  // HyperCore에서 spot 거래가 지원됩니다!
  spotTrading: {
    location: "HyperCore spot 오더북";
    features: ["즉시 체결", "가스비 없음", "CEX 수준 성능"];
    assets: "Core spot (USDC, HYPE, 배포된 HIP-1 토큰들)";
  };
  
  // 검증자 합의 메커니즘
  validatorConsensus: {
    location: "Hyperliquid L1 (HyperCore)";
    deposit: "Arbitrum 이벤트 감지 → 2/3 검증자 서명 → 1분 내 크레딧";
    withdrawal: "HyperCore 즉시 차감 → 2/3 검증자 서명 → 3-4분 Arbitrum 전송";
    fee: "출금 시 1 USDC (Arbitrum 가스비 커버)";
  };
  
  // 선택적 자산 이동 (DeFi 사용 시만)
  optionalTransfer: {
    coreToEVM: "spotSend 액션으로 HyperEVM으로 이동";
    evmToCore: "ERC-20 전송으로 HyperCore로 복귀";
    purpose: "DeFi dApp, 스마트 컨트랙트 상호작용용";
  };
}
```

### **🔐 두 가지 서명 스키마 완전 이해**
```typescript
interface HyperliquidSigningSchemes {
  sign_l1_action: {
    purpose: "거래 관련 액션 (주문, 레버리지 변경 등)";
    chainId: 1337; // 항상 고정
    structure: "phantom agent 구조";
    usage: ["placeOrder", "changeLeverage", "cancelOrder"];
    msgpack: "필드 순서 중요! JSON과 달리 순서 바뀌면 서명 달라짐";
  };
  
  sign_user_signed_action: {
    purpose: "자산 이동 액션 (출금, 전송 등)";
    chainId: "42161 (mainnet) | 421614 (testnet)"; // 실제 체인 ID
    structure: "hyperliquidChain, signatureChainId 포함";
    usage: ["withdraw", "spotTransfer", "usdTransfer"];
    requirements: ["주소 소문자 변환 필수", "trailing zero 처리"];
  };
  
  commonIssues: {
    fieldOrder: "msgpack 필드 순서가 달라지면 서명 실패";
    caseSensitive: "주소 대문자 포함 시 서명 에러";
    sdkRecommended: "Hyperliquid 공식: 수동 구현 말고 SDK 사용 강력 권장";
  };
}
```

---

## 🏪 실제 사용자 플로우 예시

### **Alice (Email 사용자) 완전한 플로우:**

#### 1. 최초 로그인
```
Alice: alice@gmail.com 입력
시스템: OTP 6자리 전송 → Alice 인증 ✅
시스템: Privy Embedded 지갑 생성 (0x1234...abcd)
```

#### 2. 거래 세션 시작 (카페 탭 결제와 유사)
```
Alice: "DOGE 코인 100개 사고싶어"
시스템: "거래 세션을 시작할게요. 1회만 서명해주세요"

[내부 작업]
- 임시 API 지갑 생성: 0x5678...efgh  
- Alice 메인 지갑(0x1234)이 API 지갑(0x5678) 승인
- API 지갑 정보를 Redis에 7일간 저장

Alice: 서명 1회 ✅ (세션 활성화)
```

#### 3. 실제 거래들 (서명 불필요)
```
Alice: "DOGE 100개 매수" → 즉시 체결 (서명 없음) ✅
Alice: "PEPE 50개 매수" → 즉시 체결 (서명 없음) ✅  
Alice: "DOGE 30개 매도" → 즉시 체결 (서명 없음) ✅
```

### **Bob (MetaMask 사용자) 완전한 플로우:**

#### 1. MetaMask 연결
```
Bob: MetaMask 연결 (0x9999...zzzz)
시스템: 
- Bob의 MetaMask 주소 확인 ✅
- 추가로 Privy Embedded 지갑도 생성 (0x8888...yyyy)  
- Bob은 2개 지갑을 가지게 됨
```

#### 2. 입금 (크로스체인 브릿지)
```
Bob: "Arbitrum에 있는 USDC 1000개를 거래소로 옮기고 싶어"
시스템: "MetaMask로 브릿지 서명 1회 해주세요"
Bob: MetaMask에서 서명 1회 ✅
시스템: Arbitrum USDC → Hyperliquid USDC 자동 전송
```

#### 3. 거래 세션 (Alice와 동일)
```
Bob: "이제 거래하고 싶어"  
시스템: "거래 세션 시작할게요. Privy 지갑으로 1회 서명"
Bob: 서명 1회 ✅ (Alice와 동일한 세션 시스템)

이후 모든 거래는 Alice와 똑같이 서명 없이 진행 ✅
```

---

## 💰 입금과 잔액 관리 시스템

### **Master-Agent 잔액 구조:**
```typescript
interface HyperliquidAccount {
  masterWallet: "0x1234...abcd";     // Privy Embedded (잔액 보유)
  apiWallet: "0x5678...efgh";        // API 지갑 (서명 전용)
  
  // HyperCore 내부 잔액
  hypercoreBalance: {
    "0x1234...abcd": { USDC: "1000.0" };  // Master 주소로 관리
    "0x5678...efgh": { USDC: "0.0" };     // API 지갑은 빈 상태
  };
}
```

### **입금 플로우:**
```typescript
async deposit() {
  // 1. Alice의 Arbitrum → Hyperliquid 브릿지
  const bridgeTx = await hyperliquidBridge.deposit({
    from: "arbitrum",
    to: "hyperliquid", 
    recipient: "0x1234...abcd",  // ✅ Master 지갑 주소로 입금!
    amount: "1000 USDC"
  });
  
  // 2. HyperCore에서 Alice 계정 확인
  const balance = await hypercore.getBalance("0x1234...abcd");
  console.log(balance); // { USDC: "1000.0" }
}
```

### **거래 시 작동 방식:**
```typescript
async placeOrder() {
  // 1. API 지갑이 Master 대신 서명
  const order = {
    user: "0x1234...abcd",           // ✅ Master 주소 (잔액 차감될 계정)
    signer: "0x5678...efgh",         // ✅ API 지갑 (서명만 담당)
    amount: "100 USDC",
    nonce: 5
  };
  
  // 2. API 지갑으로 서명
  const signature = await apiWallet.signTransaction(order);
  
  // 3. HyperCore에서 처리
  // - 서명: API 지갑이 유효한지 확인
  // - 잔액: Master 지갑에서 차감
  await hypercore.executeOrder(order, signature);
}
```

---

## 🔢 Nonce 시스템 완전 이해

### **Nonce = "Number used ONCE" (한 번만 사용되는 숫자)**
```typescript
// 목적: replay attack 방지
interface NonceExample {
  // 😈 Nonce가 없다면?
  maliciousAttack: {
    step1: "Alice가 DOGE 100개 매수 주문";
    step2: "해커가 같은 주문을 복사해서 재전송";
    step3: "Alice 계정에서 DOGE 200개 매수됨 😱";
  };
  
  // ✅ Nonce가 있다면?
  withNonce: {
    step1: "Alice 주문 (nonce: 5) → 성공";
    step2: "해커가 같은 주문 재전송 (nonce: 5)";
    step3: "HyperCore: '이미 사용된 nonce!' → 거절 ✅";
  };
}
```

### **"같은 주문"의 의미:**
```typescript
// ❌ 이건 "같은 주문"이 아니에요 (정상 처리)
order1: { amount: "100 DOGE", nonce: 1001 }  // 첫 번째 주문
order2: { amount: "100 DOGE", nonce: 1002 }  // 두 번째 주문 ✅

// 🚨 이게 "같은 주문" (replay attack - 차단됨)
order1: { amount: "100 DOGE", nonce: 1001 }  // 원본
hacker: { amount: "100 DOGE", nonce: 1001 }  // 복사본 ❌
```

### **Nonce 100개 제한 = Sliding Window 방식:**
```typescript
// 🎯 "주문 100개 제한"이 아님!
interface NonceWindow {
  // Alice가 현재까지 1050개 주문을 냈다면
  storedNonces: [951, 952, 953, ..., 1049, 1050]; // 최신 100개만 저장
  droppedNonces: [1, 2, 3, ..., 949, 950];        // 옛날 것들은 삭제
  
  validation: {
    newNonce: "951보다 커야 함 (가장 작은 저장된 값)";
    unlimited: "주문 개수는 무제한 가능!";
  };
}
```

### **Alice의 장기간 거래 예시:**
```typescript
// Alice는 평생 무제한 거래 가능
async infiniteTrading() {
  // 1년차: nonce 1~365 ✅
  // 2년차: nonce 366~730 ✅
  // 3년차: nonce 731~1095 ✅
  // ...
  // 10년차: nonce 3286~3650 ✅
  
  // 매번 최신 100개만 저장됨
  // 주문 개수는 완전 무제한!
}
```

---

## 🛠️ 기술적 구현 방안

### **현재 구현 (문제):**
```typescript
// 😤 매 거래마다 개인키 요구
async placeOrder() {
  const privateKey = request.walletPrivateKey; // 위험!
  const wallet = new ethers.Wallet(privateKey);
  const signature = await wallet.signTransaction(tx);
}
```

### **목표 구현 (세션 기반):**
```typescript
// ✅ 세션으로 간편하게
async placeOrder(userId: string) {
  const session = await redis.get(`session:${userId}`);
  if (!session) throw new Error('세션 만료됨');
  
  const apiWallet = new ethers.Wallet(session.apiPrivateKey);
  const signature = await apiWallet.signTransaction({
    ...orderData,
    nonce: session.nonce++
  });
  
  // 사용자는 아무것도 할 필요 없음!
}
```

### **세션 초기화 시스템:**
```typescript
interface HyperliquidSessionSystem {
  masterWallet: string;    // Privy Embedded 지갑 주소
  apiWallet: string;       // 세션용 임시 지갑 주소
  apiPrivateKey: string;   // 세션용 개인키 (Redis 저장)
  nonce: number;          // Atomic counter
  expiresAt: number;      // 세션 만료 시간 (7일)
}

async initializeSession(userId: string) {
  // 1. 새 API 지갑 생성
  const apiWallet = ethers.Wallet.createRandom();
  
  // 2. Master에서 API 지갑 승인
  await masterWallet.approveAgent(apiWallet.address);
  
  // 3. Redis에 세션 저장
  await redis.setex(`session:${userId}`, 604800, {
    apiPrivateKey: apiWallet.privateKey,
    nonce: 0
  });
}
```

---

## 📈 구현 우선순위 및 일정

### **🚨 Priority 1: 세션 키 시스템 (1-2주)**
- API 지갑 생성/승인 시스템
- Redis 기반 세션 관리
- Nonce 관리 시스템
- 동시성 처리

### **📋 Priority 2: 크로스체인 브릿지 (2-3주)**
- Arbitrum → Hyperliquid 실제 브릿지 연동
- External Wallet 입금 플로우 완성
- 브릿지 상태 모니터링

### **🎯 Priority 3: HyperEVM 네트워크 연동 (1주)**
- HyperEVM 네트워크 자동 추가 (Chain ID: 999, RPC: https://rpc.hyperliquid.xyz/evm)
- HyperCore ↔ HyperEVM 자산 이동 기능
- 세션 만료 처리 및 에러 핸들링

### **🔧 Priority 4: 테스트넷 준비 (3일)**
- Testnet 환경 설정 (https://app.hyperliquid-testnet.xyz)
- 이메일 지갑 Export/Import 플로우 구현
- Mock USDC 1000개 테스트 시나리오

---

## 💡 핵심 장점

1. **사용자 경험**: 매번 서명 → 세션 중 자동 처리
2. **보안**: 개인키 전송 없음 → API 지갑으로 분리  
3. **속도**: 즉시 거래 체결 가능
4. **편의성**: CEX(중앙거래소) 수준의 UX

---

## 🏁 결론

**User Onboarding 로직은 개념적으로 완벽**하며, **세션 키 시스템 구현**만 완성하면 Hyperliquid 수준의 UX 달성 가능합니다.

**핵심 요약:**
- 💰 **잔액**: Master 지갑(Privy)에 보관
- ✍️ **서명**: API 지갑이 대신 서명  
- 🔢 **Nonce**: 중복 거래 방지용 고유 번호 (무제한 주문 가능)
- 🎯 **입금**: 항상 Master 주소로!
- 🔐 **세션**: 최초 1회 서명 후 자동 처리

**예상 개발 기간**: 약 **4-6주**로 완전한 시스템 구축 가능