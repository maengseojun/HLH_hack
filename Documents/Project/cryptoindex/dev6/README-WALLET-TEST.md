# 지갑 시스템 로컬 테스트 가이드

## 개요

이 가이드는 Privy와 Hyperliquid를 통합한 지갑 시스템의 로컬 테스트 방법을 설명합니다.

## 현재 구현된 지갑 구조

### 1. 인증 시스템 (Privy 기반)
- **이메일 로그인**: OTP 인증으로 임베디드 지갑 자동 생성
- **외부 지갑 연결**: MetaMask 등 EVM 지갑 직접 연결
- **다중 인증**: MFA 지원으로 보안 강화

### 2. 네트워크 지원
- **Arbitrum**: USDC 입금용 (메인넷/Sepolia 테스트넷)
- **Hyperliquid**: 거래 실행용 (메인넷/테스트넷)
- **EVM 호환**: 모든 지갑이 EVM 형식으로 통일

### 3. 권한 분리 시스템 (Hyperliquid Agent Wallet)
- **Master Wallet**: 사용자의 실제 지갑 (서명 전용)
- **Agent Wallet**: 거래 실행용 별도 지갑 (제한된 권한)
- **권한 제어**: 거래 크기, 일일 볼륨, 허용 코인 제한

### 4. 브릿지 시스템
- **Arbitrum → Hyperliquid**: USDC 자동 브릿지
- **최소 입금액**: 5 USDC (미만 시 자금 손실)
- **처리 시간**: 1-3분 (평균 1분)
- **모니터링**: 실시간 상태 추적

## 로컬 테스트 환경 설정

### 1. 환경 변수 설정

`.env.local` 파일이 생성되었습니다. 다음 정보를 실제 값으로 업데이트하세요:

```bash
# Privy 설정 (Privy 대시보드에서 확인)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
PRIVY_VERIFICATION_KEY=your_privy_verification_key

# Supabase 설정 (Supabase 대시보드에서 확인)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. 의존성 설치 및 서버 실행

```bash
# 의존성 설치 (frontend-package.json 참조)
npm install

# 개발 서버 시작
npm run dev

# 또는 테스트 스크립트 실행
node scripts/test-wallet-system.js
```

### 3. 테스트 페이지 접속

브라우저에서 다음 URL로 접속:
- **메인 페이지**: http://localhost:3000
- **지갑 테스트 페이지**: http://localhost:3000/test-wallet-system
- **로그인 페이지**: http://localhost:3000/privy-login

## 테스트 시나리오

### 시나리오 1: 이메일 로그인 및 임베디드 지갑 테스트

1. **이메일 로그인**:
   - 임의의 이메일 주소로 로그인 시도
   - OTP 코드는 개발 환경에서 브라우저 콘솔에 표시
   - 인증 완료 후 임베디드 지갑 자동 생성 확인

2. **지갑 정보 확인**:
   - 생성된 지갑 주소가 EVM 형식인지 확인 (0x로 시작)
   - Privy에서 관리하는 개인키가 안전하게 저장되는지 확인

### 시나리오 2: 외부 지갑 연결 테스트

1. **MetaMask 연결**:
   - MetaMask 확장 프로그램 설치
   - 지갑 연결 버튼 클릭하여 MetaMask 연결

2. **네트워크 추가**:
   - Hyperliquid 테스트넷을 MetaMask에 추가:
     - 네트워크 이름: Hyperliquid Testnet
     - RPC URL: https://rpc.hyperliquid-testnet.xyz/evm
     - 체인 ID: 998
     - 통화 기호: HYPE

### 시나리오 3: 브릿지 기능 테스트

1. **테스트 토큰 준비**:
   - Arbitrum Sepolia 테스트넷에서 테스트 USDC 획득
   - [Arbitrum Sepolia Faucet](https://faucet.quicknode.com/arbitrum/sepolia) 사용

2. **브릿지 테스트**:
   - 최소 5 USDC 이상으로 브릿지 테스트
   - 브릿지 상태 모니터링 확인
   - Hyperliquid에서 잔액 확인

### 시나리오 4: 권한 분리 시스템 테스트

1. **Agent 지갑 생성**:
   - Master 지갑에서 Agent 지갑 승인 요청
   - Agent 지갑 권한 설정 (거래 크기, 허용 코인 등)

2. **제한된 권한으로 거래 테스트**:
   - Agent 지갑으로 허용된 크기 내에서 거래 실행
   - 제한 초과 시 거래 차단 확인

## 테스트 도구 활용

### 1. 자동 테스트 실행

지갑 시스템 테스트 페이지에서 "전체 테스트 실행" 버튼을 클릭하여 다음 항목들을 자동으로 테스트:

- ✅ Privy 클라이언트 연결
- ✅ 사용자 인증 상태
- ✅ 지갑 연결 상태
- ✅ Arbitrum Sepolia 네트워크 연결
- ✅ Hyperliquid 테스트넷 연결
- ✅ Hyperliquid API 응답
- ✅ 브릿지 상태 확인

### 2. 개발자 도구 활용

브라우저 개발자 도구에서 다음 정보 확인:

```javascript
// 콘솔에서 Privy 상태 확인
console.log('Privy ready:', window.privy?.ready);
console.log('User authenticated:', window.privy?.authenticated);
console.log('User info:', window.privy?.user);

// 네트워크 요청 모니터링 (Network 탭)
// - Privy API 호출 상태
// - Hyperliquid API 응답
// - Supabase 데이터베이스 연결

// 로컬 스토리지 확인 (Application 탭)
// - Privy 토큰 저장 상태
// - 지갑 연결 정보
```

### 3. 수동 테스트 체크리스트

**기본 기능**:
- [ ] 이메일 로그인 → 임베디드 지갑 자동 생성
- [ ] 외부 지갑 연결 → 네트워크 자동 추가
- [ ] 지갑 전환 및 다중 지갑 관리
- [ ] 로그아웃 후 재로그인

**네트워크 기능**:
- [ ] Arbitrum Sepolia 연결 및 블록 정보 조회
- [ ] Hyperliquid 테스트넷 연결 및 API 응답
- [ ] 네트워크 전환 시 자동 처리

**브릿지 기능**:
- [ ] 5 USDC 이상 입금 → 1분 내 Hyperliquid 반영
- [ ] 브릿지 상태 실시간 모니터링
- [ ] 실패한 브릿지 거래 복구

**보안 기능**:
- [ ] MFA 인증 (이메일 사용자)
- [ ] JWT 토큰 만료 시 자동 갱신
- [ ] Rate Limiting 테스트

## 알려진 제한사항

### 테스트넷 한계
- **실제 자금 없음**: 테스트넷에서는 실제 자금 이동 없음
- **기능 제한**: 일부 Hyperliquid 기능은 메인넷 전용
- **네트워크 불안정**: 테스트넷은 때때로 불안정할 수 있음

### 개발 환경 제한
- **환경 변수**: 실제 API 키 없이는 일부 기능 제한
- **로컬 데이터베이스**: Supabase 연결 없이는 사용자 데이터 저장 불가
- **브라우저 호환성**: 일부 지갑은 특정 브라우저에서만 동작

## 트러블슈팅

### 자주 발생하는 문제

1. **"Privy client not configured"**:
   - `.env.local`에서 Privy 환경 변수 확인
   - Privy 대시보드에서 앱 ID가 정확한지 확인

2. **네트워크 연결 실패**:
   - 인터넷 연결 확인
   - VPN이 테스트넷 RPC에 영향을 주는지 확인

3. **지갑 연결 실패**:
   - MetaMask가 최신 버전인지 확인
   - 브라우저에서 팝업 차단 해제

4. **브릿지 처리 지연**:
   - 최소 5 USDC 이상인지 확인
   - 테스트넷 트래픽 상황 고려 (최대 3분 대기)

### 로그 확인

개발자 도구 콘솔에서 다음 로그 확인:
- `🚀 지갑 시스템 종합 테스트 시작...`
- `✅ Privy 설정 완료`
- `🌉 브릿지 상태 모니터링 중...`
- `❌ 오류 발생 시 상세 정보`

## 다음 단계

테스트가 완료되면:

1. **메인넷 배포 준비**:
   - 환경 변수를 프로덕션 값으로 업데이트
   - 보안 검토 및 감사

2. **사용자 문서 작성**:
   - 최종 사용자를 위한 지갑 연결 가이드
   - 브릿지 사용법 문서

3. **모니터링 설정**:
   - 브릿지 상태 대시보드
   - 오류 알림 시스템

## 지원

테스트 중 문제가 발생하면:
- 개발자 도구 콘솔 로그 확인
- `test-wallet-system.js` 스크립트 실행
- GitHub Issues에 문제 보고