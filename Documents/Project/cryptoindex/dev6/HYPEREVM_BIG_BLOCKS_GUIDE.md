# HyperEVM Big Blocks 배포 가이드

## 📌 문제 원인
HyperEVM은 듀얼 블록 아키텍처를 사용합니다:
- **Small Blocks**: 2M gas limit (일반 트랜잭션용)
- **Big Blocks**: 30M gas limit (컨트랙트 배포용)

우리가 계속 실패했던 이유는 Small Block에서 배포를 시도했기 때문입니다!

## 🚀 배포 방법

### 방법 1: LayerZero Hyperliquid Composer 사용
```bash
# Big Block으로 전환
npx @layerzerolabs/hyperliquid-composer set-block --size big --network testnet --private-key $PRIVATE_KEY

# 배포 실행
pnpx hardhat run scripts/deploy-with-big-blocks.js --network hypervm-testnet

# 배포 후 Small Block으로 복귀
npx @layerzerolabs/hyperliquid-composer set-block --size small --network testnet --private-key $PRIVATE_KEY
```

### 방법 2: UI 사용
1. HyperEVM Block Toggle UI 접속
2. 지갑 연결
3. "Big Blocks" 모드로 전환
4. 배포 스크립트 실행
5. 배포 완료 후 "Small Blocks"로 복귀

## ⚠️ 중요 사항

### Big Block 특징
- Gas Limit: 30M (일반 이더리움과 동일)
- Block Time: ~1분 (느림)
- 용도: 컨트랙트 배포, 대규모 트랜잭션

### Small Block 특징  
- Gas Limit: 2M (제한적)
- Block Time: ~1초 (빠름)
- 용도: 일반 트랜잭션, 스왑, 전송

### 배포 순서
1. Big Block으로 전환
2. Factory 배포
3. Router 배포
4. 필요시 추가 컨트랙트 배포
5. **반드시 Small Block으로 복귀**

## 🔧 트러블슈팅

### "exceeds block gas limit" 에러
- 원인: Small Block에서 배포 시도
- 해결: Big Block으로 전환

### "Unexpected error (code=10007)"
- 원인: 컨트랙트 크기 또는 블록 타입 문제
- 해결: Big Block 확인 및 가스 한도 조정

### 배포 후 컨트랙트가 작동하지 않음
- 원인: Big Block 상태에서 일반 트랜잭션 시도
- 해결: Small Block으로 복귀

## 📝 체크리스트

배포 전:
- [ ] PRIVATE_KEY 설정 확인
- [ ] RPC URL 확인
- [ ] Big Block으로 전환
- [ ] 충분한 HYPE 잔액 확인

배포 후:
- [ ] 컨트랙트 주소 저장
- [ ] Small Block으로 복귀
- [ ] 기본 기능 테스트
- [ ] 배포 정보 문서화