# CoreIndex 개발 작업 인수인계 문서

## 현재 상황
- 프로젝트 위치: `/Users/kimhyeon/Desktop/PROJECTS/HLH_hack`
- **개발 완료**: 모든 주요 기능 구현 완료 ✅

## 프로젝트 개요
- **프로젝트 위치**: `/Users/kimhyeon/Desktop/PROJECTS/HLH_hack`
- **현재 브랜치**: `front2`
- **메인 브랜치**: `main`
- **패키지 매니저**: pnpm (모든 의존성 pnpm으로 관리됨)

## 📋 최근 대화에서 완료된 작업

### 1. Portfolio Composition UX 재설계 ✅
**문제**: 기존 AssetCard에 개별 amount/allocation 입력이 있어서 계산 충돌 발생
**해결**:
- AssetCard에서 amount/allocation 제거
- 새로운 Portfolio Composition 섹션 생성
- 플로우: 자산 선택 → 퍼센트 할당 → 총 투자 금액 설정
- 파일: `/src/app/page.tsx` (라인 527-640)

### 2. State Management 구조 개편 ✅
```typescript
type PortfolioComposition = {
  totalAmount: number;
  allocations: { [symbol: string]: number }; // percentage 0-100
};
```
- 개별 asset 속성에서 중앙집중식 composition으로 변경
- Auto-balance 기능: 33.3% × 3 = 99.9% 문제 해결 (마지막 asset이 나머지 받도록)

### 3. Footer 단위 수정 ✅
- 모든 USD/$ 표시를 HYPE로 변경
- 파일: `/src/app/page.tsx` 라인 708-720

### 4. Leverage 슬라이더 UI 개선 ✅
- 입력칸 왼쪽 정렬 (Leverage 글자 바로 아래)
- 스피너 색상을 사이트 테마에 맞게 변경 (#A0B5B2 → #98FCE4)
- 파일: `/src/app/page.tsx` 라인 486-518

### 5. API 구조 분석 및 Backend Candles Endpoint 추가 ✅
**문제**: Frontend가 호출하는 `/v1/assets/{symbol}/candles` 엔드포인트 없음
**해결**:
- Backend 분석: `assets.ts`에 candles endpoint 추가
- `getCandles` 함수를 `hypercore.ts`에서 임포트
- 파일: `/backend/src/routes/assets.ts` (라인 32-75)

### 6. API 클라이언트 구조 개선 ✅
- Public/Protected 엔드포인트 분리
- `fetchJson` (인증 없음) vs `fetchJsonWithAuth` (Bearer token)
- 포괄적인 에러 처리 및 디버그 로깅 추가
- 파일: `/src/lib/api.ts`

### 7. Preview 데이터 연동 및 백엔드 API 안정화 ✅
**문제**: Preview 차트 데이터 로딩이 여러 단계의 문제로 인해 실패함.
**해결**:
- **`.env` 환경 변수 수정**: 프론트엔드가 백엔드 API(`localhost:3001/v1`)를 올바르게 호출하도록 `NEXT_PUBLIC_API_BASE` 설정 수정.
- **백엔드 스키마 수정**: Hyperliquid API의 실제 응답(객체 배열)과 일치하도록 `CandleSnapshotSchema`를 튜플 기반에서 객체 기반으로 변경 (`/backend/src/schemas/rpc.ts`).
- **백엔드 파서 수정**: 새로운 스키마에 맞춰 `parseCandles` 함수 로직 수정 (`/backend/src/services/hypercore.ts`).
- **API 클라이언트 수정**: `postBasketCalculate` 함수가 인증 없이 호출될 수 있도록 수정하여, Preview 기능이 기본 API 경로를 사용하도록 개선 (`/src/lib/api.ts`).

### 8. Mock Launch System 구현 ✅
**문제**: 실제 가스비 사용 없이 전체 플로우 테스트 필요
**해결**:
- localStorage 기반 mock index 데이터 저장 및 로드
- Launch 페이지에서 mock 인덱스 생성 기능
- 실시간 성과 데이터 생성 (Hyperliquid API 기반)
- 파일: `/src/app/page.tsx` (mock launch 로직)

### 9. Index 관리 페이지 구현 ✅
**기능**:
- 생성된 인덱스 목록 표시 (Active/Redeemed 상태)
- 실시간 데이터 업데이트 (localStorage 이벤트 기반)
- 검색 및 필터링 (이름, 심볼, 상태별)
- 정렬 기능 (날짜, 수익률, 이름순 등)
- 파일: `/src/app/index/page.tsx`

### 10. IndexDetailsModal 실제 데이터 연동 ✅
**기능**:
- Hyperliquid API를 통한 실시간 가격 데이터 조회
- Rate limiting 방지를 위한 순차적 API 호출
- 포트폴리오 NAV 계산 (레버리지, 포지션 고려)
- 차트 호버 상호작용 및 툴팁
- MM/DD/YYYY 날짜 형식 표시
- 파일: `/src/components/IndexDetailsModal.tsx`

### 11. Chart Hover Interactions 구현 ✅
**기능**:
- 차트 위 마우스 호버 시 점 표시
- 커스텀 툴팁으로 날짜, 가격, 수익률 표시
- Launch Preview와 Index Details 모두 지원
- MM/DD/YYYY 날짜 형식 적용
- 파일: `/src/app/page.tsx`, `/src/components/IndexDetailsModal.tsx`

### 12. Redeem 기능 구현 ✅
**기능**:
- 부분/전체 상환 선택
- 실제 localStorage 데이터 업데이트
- 상환 수수료 계산 (0.5%)
- 인덱스 상태를 Active → Redeemed 변경
- 자산별 상환 내역 생성
- 파일: `/src/components/RedeemModal.tsx`

### 13. Filter & Search 시스템 구현 ✅
**기능**:
- Active/Redeemed 상태 필터링
- 인덱스 이름/심볼 검색
- 다양한 정렬 옵션 (날짜, 수익률, 이름순, MDD)
- useMemo 최적화로 성능 향상
- 파일: `/src/app/index/page.tsx`

### 14. UI/UX 정리 및 최적화 ✅
**완료 사항**:
- 테스트 페이지 제거
- 헤더 네비게이션 정리
- IndexDetailsModal 레이아웃 개선 (컬럼 비율 조정)
- 툴팁 날짜 형식 통일 (MM/DD/YYYY)
- 파일: `/src/components/HeaderNav.tsx`, `/src/components/IndexDetailsModal.tsx`

## 📦 의존성 및 호환성 정보

### 패키지 매니저
- **반드시 pnpm 사용**: `npm` 또는 `yarn` 사용하면 충돌 발생
- 설치: `pnpm install`
- 실행: Frontend `pnpm dev`, Backend `pnpm run dev`

### 주요 기술 스택
- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Backend**: Express + TypeScript + tsx (dev 실행)
- **API 호출**: fetch API (axios 아님)
- **차트**: Recharts (ResponsiveContainer, AreaChart, LineChart, PieChart)
- **상태 관리**: React useState + localStorage (Redux/Zustand 없음)
- **스타일링**: Tailwind CSS + CSS 변수

### 환경 변수
```bash
NEXT_PUBLIC_API_BASE=http://localhost:3001/v1
```

### 포트 구성
- **Frontend**: 포트 3000
- **Backend**: 포트 3001
- **충돌 주의**: Backend 재시작시 EADDRINUSE 에러 나면 기존 프로세스 종료 후 재실행

## 📁 핵심 파일 구조

````
/HLH_hack/
├── src/app/
│   ├── page.tsx                     # 메인 Launch 페이지 (Mock Launch 기능 포함)
│   └── index/page.tsx               # Index 관리 페이지 (필터링, 검색, 정렬)
├── src/lib/api.ts                   # API 클라이언트
├── src/components/
│   ├── IndexDetailsModal.tsx        # 인덱스 상세보기 (실시간 데이터, 차트)
│   ├── RedeemModal.tsx              # 상환 기능
│   ├── ShareModal.tsx               # 공유 기능
│   ├── HeaderNav.tsx                # 네비게이션 (정리됨)
│   └── ...
├── backend/src/
│   ├── routes/assets.ts             # Candles endpoint
│   ├── services/hypercore.ts        # getCandles 함수 및 파서
│   ├── schemas/rpc.ts               # API 데이터 스키마
│   └── index.ts
└── API_INTEGRATION.md
````

## 🎯 현재 상태: 모든 기능 구현 완료 ✅

### 완료된 주요 기능들:
1. **Mock Launch System**: 가스비 없이 전체 플로우 테스트 가능
2. **실시간 데이터 연동**: Hyperliquid API를 통한 실제 가격 데이터
3. **Index 관리**: 생성, 조회, 검색, 필터링, 정렬, 상환 기능
4. **차트 인터랙션**: 호버 툴팁, 실시간 성과 추적
5. **완전한 UI/UX**: 반응형 디자인, 상태 관리, 에러 처리

## ⚠️ 주요 주의사항

### 패키지 관리
- **절대 npm/yarn 사용 금지**: pnpm으로만 의존성 관리
- 새 패키지 설치시: `pnpm add [package]`
- 개발 의존성: `pnpm add -D [package]`

### API 호출 패턴
- Public endpoints: `fetchJson` 사용
- Protected endpoints: `fetchJsonWithAuth` 사용
- Rate limiting 방지: 순차적 API 호출 (300ms 딜레이)

### Mock 데이터 시스템
- localStorage 기반 영구 저장
- 실시간 업데이트 (storage events)
- 여러 탭/창 간 동기화 지원

### 서버 관리
- Frontend/Backend 별도 터미널에서 실행
- Backend 포트 충돌시 기존 프로세스 종료 후 재실행
- tsx watch 모드로 개발 중 자동 재시작

## 🔍 디버깅 정보

### 로그 확인 위치
- **Frontend**: 브라우저 DevTools Console
- **Backend**: 터미널 출력
- **API 호출**: Network 탭에서 실제 요청/응답 확인
- **localStorage**: Application 탭에서 mock-indexes 키 확인

### 자주 발생하는 문제
1. **API 호출 실패**:
   - `.env` 파일의 `NEXT_PUBLIC_API_BASE` 확인
   - 프론트엔드/백엔드 서버 모두 실행 중인지 확인
   - Rate limiting (429 에러) 시 순차적 호출 로직 확인
2. **Mock 데이터 미표시**:
   - localStorage에 'mock-indexes' 키 존재 여부 확인
   - storage 이벤트 리스너 동작 확인

## 📞 최종 상태 요약
- **Portfolio UX**: 완전히 새로 설계됨 ✅
- **Backend API**: Candles endpoint 추가 완료 ✅
- **Mock Launch System**: 완전 구현됨 ✅
- **Index 관리**: 모든 CRUD 기능 완료 ✅
- **실시간 데이터**: Hyperliquid API 연동 완료 ✅
- **차트 인터랙션**: 호버, 툴팁 구현 완료 ✅
- **필터링 시스템**: 검색, 정렬, 상태 필터 완료 ✅
- **UI/UX 정리**: 모든 개선사항 적용 완료 ✅

**🎉 프로젝트 개발 완료: 모든 주요 기능이 구현되어 사용 준비 완료**