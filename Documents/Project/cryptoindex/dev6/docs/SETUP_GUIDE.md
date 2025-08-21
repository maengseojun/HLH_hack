# 🚀 Hyperliquid Index Platform - Setup Guide

이 가이드는 Hyperliquid Index Platform의 보안 강화 시스템을 설정하는 방법을 안내합니다.

## 📋 사전 준비사항

### 1. 개발 환경 요구사항
- Node.js 18.0+ 
- npm 또는 yarn
- Hardhat 개발 환경
- Hyperliquid 테스트넷 계정 및 자금

### 2. 필요한 API 키 및 서비스
- Hyperliquid API Key
- Chainlink Node Access (백업 오라클용)
- Band Protocol API Key (백업 오라클용)
- Immunefi Account (버그 바운티용)

## ⚙️ 기본 설정

### 1. 환경 변수 설정
```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 열고 실제 값으로 수정
vim .env  # 또는 원하는 에디터 사용
```

### 2. 의존성 설치
```bash
npm install
# 또는
yarn install
```

### 3. Hardhat 네트워크 설정
```bash
# hardhat.config.js에서 Hyperliquid 네트워크 설정 확인
npx hardhat network
```

## 🔐 보안 시스템 배포

### 1. 스마트 컨트랙트 배포
```bash
# 보안 시스템 전체 배포
npx hardhat run scripts/deploy-security-suite.js --network hyperevm_testnet

# 배포 결과 확인
ls deployments/
```

### 2. 초기 설정
```bash
# 통합 스크립트 실행
npx hardhat run deployments/integration-hyperevm_testnet.js --network hyperevm_testnet
```

## 🎯 외부 서비스 통합 가이드

### 1. Oracle 서비스 설정

#### Hyperliquid 오라클 (Primary)
```javascript
// 이미 통합됨 - API 키만 .env에 설정
HYPERLIQUID_API_KEY=your_api_key_here
```

#### Chainlink 오라클 (Backup)
1. **Chainlink 노드 접근 권한 획득**
   - [Chainlink 공식 사이트](https://chain.link/) 방문
   - 개발자 계정 생성 및 API 키 발급

2. **환경 변수 설정**
   ```bash
   CHAINLINK_RPC_URL=your_chainlink_node_url
   CHAINLINK_API_KEY=your_chainlink_api_key
   ```

3. **오라클 추가**
   ```bash
   # 오라클 소스 추가 스크립트 실행
   npx hardhat run scripts/add-oracle-sources.js --network hyperevm_testnet
   ```

#### Band Protocol 오라클 (Backup)
1. **Band Protocol API 키 획득**
   - [Band Protocol](https://bandchain.org/) 방문
   - API 접근 권한 요청

2. **환경 변수 설정**
   ```bash
   BAND_PROTOCOL_API_URL=https://laozi1.bandchain.org/api/oracle/v1/request_prices
   BAND_PROTOCOL_API_KEY=your_band_protocol_key
   ```

### 2. 보안 모니터링 설정

#### 실시간 모니터링 시작
```bash
# 보안 대시보드 시작
npm run start:monitoring
# 또는
node monitoring/SecurityDashboard.js
```

#### 알림 설정
1. **Slack 알림**
   ```bash
   # Slack에서 웹훅 URL 생성
   # .env에 URL 추가
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
   ```

2. **Discord 알림**
   ```bash
   # Discord에서 웹훅 URL 생성
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK
   ```

### 3. 보안 감사 및 버그 바운티

#### 외부 감사 의뢰
1. **OpenZeppelin 감사**
   - [OpenZeppelin Defender](https://defender.openzeppelin.com/) 방문
   - 감사 서비스 신청

2. **ConsenSys Diligence**
   - [ConsenSys Diligence](https://consensys.net/diligence/) 연락
   - 보안 감사 견적 요청

#### Immunefi 버그 바운티 설정
1. **Immunefi 계정 생성**
   - [Immunefi](https://immunefi.com/) 방문
   - 프로젝트 등록

2. **바운티 프로그램 설정**
   ```bash
   # .env에 Immunefi API 키 설정
   IMMUNEFI_API_KEY=your_immunefi_api_key
   BUG_BOUNTY_ENABLED=true
   ```

## 🧪 테스팅 및 검증

### 1. 종합 보안 테스트 실행
```bash
# 전체 보안 테스트 스위트 실행
npx hardhat test test/security/ComprehensiveSecurityTest.js --network hyperevm_testnet

# 가스 최적화 분석
npx hardhat run scripts/gas-optimization-analysis.js --network hyperevm_testnet
```

### 2. 배포 검증
```bash
# 배포된 컨트랙트 검증 스크립트 실행
npx hardhat run scripts/verify-deployment.js --network hyperevm_testnet
```

## 📊 모니터링 및 운영

### 1. 대시보드 접근
- 실시간 보안 메트릭 확인
- 알림 설정 및 관리
- 시스템 상태 모니터링

### 2. 정기 점검 항목
- [ ] 일일 보안 보고서 확인
- [ ] 오라클 신뢰도 점검
- [ ] 유동성 비율 모니터링
- [ ] 가스 사용량 최적화 검토

### 3. 비상 대응 절차
1. **Circuit Breaker 작동 시**
   - 즉시 시장 상황 분석
   - 수동 개입 여부 결정
   - 쿨다운 기간 후 시스템 재개

2. **Oracle 조작 감지 시**
   - 자동 백업 오라클로 전환
   - 가격 편차 분석
   - 필요 시 수동 가격 설정

3. **Bank Run 시나리오**
   - 점진적 상환 메커니즘 활성화
   - 유동성 주입 검토
   - 커뮤니케이션 계획 실행

## 🎯 체크리스트

### 배포 전 확인사항
- [ ] 모든 환경 변수 설정 완료
- [ ] 보안 컨트랙트 배포 완료
- [ ] 다중 오라클 설정 완료
- [ ] 모니터링 시스템 작동 확인
- [ ] 테스트 스위트 전체 통과

### 운영 중 주기적 점검
- [ ] 보안 메트릭 정상 범위 유지
- [ ] 알림 시스템 정상 작동
- [ ] 백업 시스템 정상 작동
- [ ] API 키 및 인증 정보 유효성

## 🆘 지원 및 문의

### 기술 지원
- GitHub Issues: 프로젝트 저장소 이슈 페이지
- 개발팀 연락처: [연락처 정보]

### 보안 이슈 신고
- 보안 취약점은 비공개 채널을 통해 신고
- 이메일: security@yourproject.com

---

**마지막 업데이트**: 2025-01-19  
**다음 업데이트 예정**: 주요 기능 추가 시