# 🔐 HyperIndex Security Documentation

HyperIndex의 보안 아키텍처 및 취약점 분석 문서들입니다.

---

## 📁 파일 목록

### **⭐ 핵심 문서**
- **[`ORDERBOOK_SECURITY_ARCHITECTURE.md`](ORDERBOOK_SECURITY_ARCHITECTURE.md)**  
  **dYdX v4 vs Vertex Protocol 보안 분석 및 HyperIndex 진화 전략**
  - Phase 1: Vertex 모델 (중앙화 Sequencer)
  - Phase 2: 하이브리드 검증 
  - Phase 3: dYdX 모델 (완전 분산화)

### **종합 분석**
- [`HYPERINDEX_SECURITY_ANALYSIS_REVISED.md`](HYPERINDEX_SECURITY_ANALYSIS_REVISED.md)  
  HyperEVM 컨텍스트에서의 종합 보안 분석

- [`SECURITY_VULNERABILITY_ANALYSIS_DYDX_VERTEX.md`](SECURITY_VULNERABILITY_ANALYSIS_DYDX_VERTEX.md)  
  dYdX와 Vertex 기반 취약점 분석

- [`SMART_CONTRACT_SECURITY_AUDIT.md`](SMART_CONTRACT_SECURITY_AUDIT.md)  
  스마트 컨트랙트 보안 감사 가이드

---

## 🎯 보안 전략 요약

### **단계별 진화**
```
Phase 1 (론칭) → Vertex 모델
• 단일 Sequencer (15-20K TPS)  
• 외부 보안 감사 (ConsenSys, Trail of Bits)
• AMM 백업 시스템

Phase 2 (확장) → 하이브리드  
• 3-5개 검증 파트너
• Chainlink Node Operator 스타일

Phase 3 (탈중앙화) → dYdX 모델
• 10-20개 검증자 네트워크
• Byzantine Fault Tolerance
```

### **핵심 보안 원칙**
- ❌ **자산 보관권 없음** (온체인 스마트컨트랙트)
- 🔒 **MEV 보호** (Commit-Reveal + Batch Auction)  
- 🛡️ **검열 저항성** (강제 온체인 포함 가능)
- 🔄 **다중 백업** (AMM + 비상 메커니즘)

---

## 📊 보안 벤치마크

| 보안 측면 | dYdX v4 | Vertex | HyperIndex |
|-----------|---------|---------|------------|
| **탈중앙화** | 60 검증자 | 단일 운영자 | 단계적 진화 |
| **성능** | 1K orders/sec | 15K TPS | 15-20K TPS |
| **지연시간** | ~500ms | 5-30ms | <15ms |
| **백업** | 합의 중단 | AMM 모드 | AMM 모드 |

---

**💡 개발 시 참조 우선순위:**
1. [`ORDERBOOK_SECURITY_ARCHITECTURE.md`](ORDERBOOK_SECURITY_ARCHITECTURE.md) - 전체 보안 설계
2. [`HYPERINDEX_SECURITY_ANALYSIS_REVISED.md`](HYPERINDEX_SECURITY_ANALYSIS_REVISED.md) - 구현 세부사항
3. [`SMART_CONTRACT_SECURITY_AUDIT.md`](SMART_CONTRACT_SECURITY_AUDIT.md) - 컨트랙트 보안