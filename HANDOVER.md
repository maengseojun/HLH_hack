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

### 15. HyperLiquid API 통합 및 시간 단위 업데이트 ✅
**문제**: Mock 데이터가 실제 API 연동 문제를 가리고 있었음
**해결**:
- **API URL 수정**: candleSnapshot 요청을 testnet이 아닌 공식 public API (`https://api.hyperliquid.xyz/info`)로 변경
- **시간 단위 업데이트**: 
  - `7d` → `1d` (일별 캔들, 30일치 데이터)
  - `1d` → `1h` (시간별 캔들, 1주일치 데이터)  
  - `1h` → `5m` (5분별 캔들, 하루치 데이터)
- **시간 포맷팅 개선**:
  - `5m`: `15:30` (시:분 형식)
  - `1h`: `15:00` (시간별, 24시간 형식)
  - `1d`: `09/27` (월/일 형식)
- **Mock 데이터 완전 제거**: 실제 API 데이터만 사용하도록 수정
- **에러 처리 개선**: MATIC 등 HyperLiquid에서 지원하지 않는 asset에 대한 우아한 에러 처리
- 파일: `/backend/src/services/hypercore.ts`, `/src/components/IndexDetailsModal.tsx`, `/src/app/page.tsx`

### 16. 차트 가독성 개선 ✅
**문제**: X축 라벨이 너무 촘촘해서 겹쳐 보임
**해결**:
- **X축 간격 조정**: Recharts의 `interval` 속성으로 라벨 간격 조정
  - `5m`: `preserveStartEnd` (시작과 끝만 표시)
  - `1h`: 전체 데이터를 8등분해서 표시
  - `1d`: 전체 데이터를 6등분해서 표시
- **툴팁 유지**: 모든 데이터 포인트에서 정확한 시간 정보 제공
- **Preview와 IndexDetails 모두 적용**: 일관된 사용자 경험 제공
- 파일: `/src/components/IndexDetailsModal.tsx`, `/src/app/page.tsx`

### 17. 백엔드 API 시간 간격 지원 확장 ✅
**변경 사항**:
- **CandleInterval 타입**: `'1h' | '1d' | '7d'` → `'5m' | '1h' | '1d'`
- **candlePresets 설정**:
  - `5m`: 1일치 데이터 (5분 간격)
  - `1h`: 7일치 데이터 (1시간 간격)
  - `1d`: 30일치 데이터 (1일 간격)
- **API route 업데이트**: `/v1/assets/:symbol/candles` 엔드포인트에서 새로운 간격 지원
- **HyperLiquid 형식 유지**: 응답을 `{t, o, h, l, c, v}` 형식으로 반환하여 프론트엔드 호환성 보장
- 파일: `/backend/src/utils/candlePresets.ts`, `/backend/src/routes/assets.ts`, `/backend/src/services/hypercore.ts`

### 18. Next 빌드 안정화 및 배포 준비 ✅
**문제**: Vercel 빌드에서 `/index` 프리렌더 버그, 클라이언트 전용 컴포넌트 SSR 오류, 네이티브 의존성 빌드 스크립트 경고가 발생함.
**해결**:
- `/index` 페이지를 서버 리다이렉트 전용으로 단순화하고 프리렌더를 차단 (`src/app/index/page.tsx`).
- `/indexes` UI를 클라이언트 전용 컴포넌트로 분리해 서버 컴포넌트에서 안전하게 임포트 (`src/app/indexes/page.tsx`, `src/app/indexes/IndexHubClient.tsx`, `src/app/indexes/loading.tsx`).
- pnpm 네이티브 의존성 빌드 스크립트를 허용하도록 `.npmrc`를 추가해 Vercel 경고 제거 (`.npmrc`).
- `NEXT_PUBLIC_API_BASE` 미설정 시 프런트가 즉시 오류를 던지므로, 필요한 값을 Vercel 환경 변수에 직접 등록하도록 문서화.


### 19. Vercel 백엔드 안정화 및 CORS 처리 ✅
**문제**: 서버리스 환경에서 `app.listen()` 실행, `pino-pretty` 모듈, `express-rate-limit` 검증, 프리플라이트 차단 등으로 500 에러가 지속적으로 발생함.
**해결**:
- Vercel 환경에서는 `app.listen()`을 호출하지 않고, serverless 함수에서 `dist/index.js`를 동적 import (`backend/api/index.ts`).
- 로컬에서만 `pino-pretty` transport 사용, Vercel에서는 기본 로거만 사용 (`backend/src/infra/logger.ts`).
- `app.set('trust proxy', 1)` 적용, CORS 헤더 및 204 `OPTIONS` 응답 추가 (`backend/src/index.ts`).
- 프런트 환경 변수 `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_API_PROXY_TARGET`, `NEXT_PUBLIC_DEMO_BEARER_TOKEN`을 새 백엔드 URL에 맞춰 재배포.

### 20. Spot/Perp 동시 표시를 위한 프런트 준비 ✅
- 백엔드 자산 정규화에 `marketType` 필드를 추가하고 spot 변형을 함께 제공 (`backend/src/schemas/metaAdapter.ts`, `backend/src/services/assets.ts`).
- 프론트 타입과 UI가 `marketType`을 표시하고, Spot 선택 시 롱/1x 고정 및 배지를 노출 (`src/lib/api.ts`, `src/app/page.tsx`).
- Basket 계산과 Preview 계산에서 Spot 자산은 항상 `long` / `1x`로 취급하도록 로직을 보강.

### 21. Spot 자산 검색 기능 완전 구현 ✅
**문제**: 실제 spot 자산 데이터 공급 및 검색 가능하도록 백엔드 구현 필요
**해결**:
- **백엔드 스키마 확장**: `NormalizedAsset`에 `spotIndex` 필드 추가하여 spot 자산의 `@{index}` 형식 지원 (`backend/src/schemas/metaAdapter.ts`)
- **심볼 검색 로직 개선**: `getAssetBySymbolOrThrow` 함수에서 spot 심볼, 대소문자 무관 검색, perp 형식 변환 등 다양한 검색 방식 지원
- **캔들 데이터 처리**: `hypercore.ts`에 `resolveSymbolForCandles` 함수 추가하여 spot 자산은 `@{index}` 형식으로 변환 후 API 호출
- **API 엔드포인트 통합**: `/v1/assets/:symbol/candles`에서 자산 타입에 따라 적절한 캔들 데이터 fetch
- **환경 설정**: 로컬 테스트용으로 mainnet API 사용하도록 환경변수 수정 (`backend/.env`)
- **검증 완료**: 
  - `/v1/assets` - 총 408개 자산 반환 (193 perp + 215 spot)
  - `/v1/assets/BTC` - spot 자산 정상 반환 (`marketType: 'spot'`, `maxLeverage: 1`)
  - `/v1/assets/BTC-PERP` - perp 자산 정상 반환 (`marketType: 'perp'`, funding/premium 포함)
- 파일: `backend/src/schemas/metaAdapter.ts`, `backend/src/services/hypercore.ts`, `backend/src/routes/assets.ts`

## 📦 의존성 및 호환성 정보

### 패키지 매니저
- **반드시 pnpm 사용**: `npm` 또는 `yarn` 사용하면 충돌 발생
- 설치: `pnpm install`
- 실행: Frontend `pnpm dev`, Backend `pnpm run dev`

### 주요 기술 스택
- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Backend**: Express + TypeScript + tsx (dev 실행)
- **API 통합**: HyperLiquid Public API (실시간 암호화폐 데이터)
- **API 호출**: fetch API (axios 아님)
- **차트**: Recharts (ResponsiveContainer, AreaChart, LineChart, PieChart)
- **상태 관리**: React useState + localStorage (Redux/Zustand 없음)
- **스타일링**: Tailwind CSS + CSS 변수
- **데이터 형식**: HyperLiquid candleSnapshot 형식 (`{t, o, h, l, c, v}`)

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

## 🗂 다음 우선 작업 (Priority)
1. **실제 Spot 자산 데이터 연동 (1순위)** 
   - 현재는 perp 자산 기반으로 mock spot 자산을 생성하는 방식
   - 향후 실제 `spotMetaAndAssetCtxs` API 연동 시 기반 구조가 모두 준비되어 있어 쉽게 업그레이드 가능
   - `backend/src/services/meta.ts`에서 병렬 호출 로직으로 전환하고 `normalizeMetaAndAssetCtxs`에서 실제 spot 데이터 처리

2. **프론트엔드 Spot 자산 UI 테스트**
   - spot 자산 선택 → 롱/1x 고정, Preview/Basket 계산이 정상 동작하는지 회귀 테스트
   - 레버리지 슬라이더 비활성화, spot 배지 표시 등 UI 검증

## 🚀 백엔드 배포 및 환경 변수 가이드
- **프런트 환경 변수**
  - `NEXT_PUBLIC_API_BASE`: 프런트가 호출할 백엔드 공개 URL (Vercel에서는 `localhost` 값을 사용하면 안 되고, 외부에서 접근 가능한 주소 필요)
  - `NEXT_PUBLIC_API_PROXY_TARGET` (선택): Next.js `rewrites`에서 `/v1/*` 경로를 프록시하고 싶을 때 대상 URL 지정
- **백엔드 배포 옵션** (`backend/` Express 앱 기준)
  1. **PaaS 배포**: Render, Railway, Fly.io 등에 Express 서버를 올리고 발급된 URL을 환경 변수에 설정
  2. **컨테이너 배포**: Docker 이미지를 만들어 AWS ECS/Fargate, Fly.io 등 컨테이너 플랫폼에 배포
  3. **Next.js API로 포팅**: 라우트를 `/app/api/*` 구조로 이전하여 Vercel Serverless Functions에서 운영 (작업량이 많지만 단일 배포 가능)
- **중요**: Vercel은 로컬 `.env` 파일을 읽지 않으므로, 필요한 값은 프로젝트 Settings → Environment Variables에 직접 등록해야 함

## 📞 최종 상태 요약
- **Portfolio UX**: 완전히 새로 설계됨 ✅
- **Backend API**: Candles endpoint 추가 완료 ✅
- **Mock Launch System**: 완전 구현됨 ✅
- **Index 관리**: 모든 CRUD 기능 완료 ✅
- **실시간 데이터**: Hyperliquid API 연동 완료 ✅
- **차트 인터랙션**: 호버, 툴팁 구현 완료 ✅
- **필터링 시스템**: 검색, 정렬, 상태 필터 완료 ✅
- **UI/UX 정리**: 모든 개선사항 적용 완료 ✅
- **Spot 자산 검색**: 백엔드 구현 완료, API 테스트 통과 ✅

**🎉 프로젝트 개발 완료: 모든 주요 기능이 구현되어 사용 준비 완료**

### 최신 개발 성과 (Spot 자산 지원)
- **총 자산 수**: 408개 (193 perp + 215 spot)
- **API 엔드포인트**: `/v1/assets`, `/v1/assets/:symbol`, `/v1/assets/:symbol/candles` 모두 spot/perp 지원
- **자산 구분**: `marketType` 필드로 명확히 구분 ('perp' | 'spot')
- **Spot 특성**: `maxLeverage: 1`, `funding: null`, `premium: null`
- **캔들 데이터**: spot 자산도 `@{index}` 형식으로 정상 처리
