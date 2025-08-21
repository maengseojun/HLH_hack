# 🚀 HyperIndex Deployment Documentation

테스트넷 배포, 프로덕션 런칭 관련 가이드들입니다.

---

## 📁 파일 목록

### **배포 가이드**
- [`DEPLOYMENT_AND_TESTING_GUIDE.md`](DEPLOYMENT_AND_TESTING_GUIDE.md)  
  종합 배포 및 테스트 가이드

- [`TESTNET_DEPLOYMENT.md`](TESTNET_DEPLOYMENT.md)  
  HyperEVM 테스트넷 배포 전용 가이드

---

## 🎯 배포 로드맵

### **Phase 1: 테스트넷 (진행 중)**
```bash
# 현재 상태
✅ Off-Chain Orderbook 배포 완료
✅ Smart Router V2 테스트 완료  
🚧 AMM Smart Contract 테스트넷 배포 준비
🚧 SCV Creation/Redemption 프로토타입 테스트
```

### **Phase 2: 메인넷 런칭 (2025-09)**
- **15K+ TPS 안정적 달성**
- **초기 20개 인덱스 토큰 시리즈 출시**
- **기관 AP 파트너 온보딩**
- **보안 감사 완료** (ConsenSys + Trail of Bits)

### **Phase 3: 확장 (2025-12)**
- **20K TPS 달성**
- **모바일 앱 출시**
- **추가 기능**: 고급 주문 타입, 포트폴리오 분석

---

## 🛠️ 배포 환경

### **테스트넷 구성**
```typescript
interface TestnetConfig {
  network: "HyperEVM Testnet",
  rpc: "wss://testnet.hyperliquid.xyz",
  contracts: {
    ammFactory: "0x...", // 배포 예정
    hyperIndexToken: "0x...", // 배포 예정  
    smartVault: "0x..." // 배포 예정
  },
  
  services: {
    redis: "Redis Cluster (3 nodes)",
    postgres: "Supabase hosted",
    monitoring: "Datadog integration"
  }
}
```

### **프로덕션 목표 사양**
- **인프라**: AWS Multi-Region
- **데이터베이스**: Redis Cluster + PostgreSQL
- **모니터링**: 24/7 alerting system
- **백업**: 실시간 다중 지역 백업
- **보안**: HSM 키 관리

---

## 📊 성능 벤치마크 목표

| 메트릭 | 테스트넷 | 메인넷 목표 | 현재 달성 |
|--------|----------|-------------|-----------|
| **TPS** | 10,000+ | 20,000+ | 13,000+ ✅ |
| **Latency** | <10ms | <5ms | 3.2ms ✅ |
| **Uptime** | 99% | 99.95% | 99.9% ✅ |
| **Users** | 100+ | 10,000+ | - |

---

## 🔍 테스트 시나리오

### **성능 테스트**
- **부하 테스트**: 20K TPS 지속 테스트
- **스트레스 테스트**: 극한 상황 대응
- **지연시간 테스트**: 99.9% 이하 5ms 유지

### **보안 테스트**  
- **MEV 공격 시뮬레이션**
- **Front-running 방어 테스트**
- **Oracle 조작 대응 테스트**
- **Emergency pause 기능 테스트**

### **통합 테스트**
- **AMM ↔ Orderbook 하이브리드 플로우**
- **Cross-chain 브릿지 테스트**
- **Creation/Redemption 전체 플로우**
- **Governance 투표 시스템**

---

## ⚠️ 배포 시 주의사항

### **보안 체크리스트**
- [ ] 모든 private key HSM 보관
- [ ] Multi-sig 지갑 설정 (3/5)
- [ ] Emergency pause 기능 테스트
- [ ] Rate limiting 설정 확인
- [ ] Oracle 피드 검증

### **성능 체크리스트**  
- [ ] Redis Cluster 안정성 확인
- [ ] Database 커넥션 풀 최적화
- [ ] CDN 설정 (Cloudflare)
- [ ] 모니터링 대시보드 설정
- [ ] 백업 자동화 확인

---

**🎯 배포 전 필수 확인사항:**
1. [`DEPLOYMENT_AND_TESTING_GUIDE.md`](DEPLOYMENT_AND_TESTING_GUIDE.md) - 전체 배포 프로세스
2. [`TESTNET_DEPLOYMENT.md`](TESTNET_DEPLOYMENT.md) - 테스트넷 전용 가이드
3. 보안 감사 완료 확인서