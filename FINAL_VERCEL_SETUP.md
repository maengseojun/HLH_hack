# 🚀 최종 Vercel 배포 가이드 - hlh_hack 프론트엔드

## ✅ 프로젝트 구조 정리 완료

```
hlh/
├── frontend/                 <- 🎯 메인 프론트엔드 (hlh_hack)
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vercel.json
│   ├── .env.production
│   └── src/
├── backend/                 <- 백엔드
├── backup_root_integration/ <- 이전 통합 파일들 백업
└── README.md
```

## 🎯 Vercel 설정 방법

### 1. Vercel 프로젝트 설정

**Vercel 대시보드 → Settings → General:**

```
Root Directory: frontend
Framework Preset: Next.js
Build Command: pnpm build
Install Command: pnpm install
Output Directory: .next
```

### 2. 환경 변수 설정

**Vercel 대시보드 → Settings → Environment Variables:**

```bash
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
DEMO_BEARER_TOKEN=production_demo_token_replace_me
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
INFO_API_URL=https://api.hyperliquid.xyz/info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
REQUEST_TIMEOUT_MS=30000
```

### 3. 배포

이제 git push하면 자동으로 `frontend/` 폴더가 배포됩니다!

## ✨ 주요 개선사항

### 프론트엔드 기능 (frontend/)
- ✅ **실제 API 통합** (`getAssets`, `postBasketCalculate`)
- ✅ **실시간 자산 검색 및 필터링**
- ✅ **실제 백엔드 데이터 기반 차트**
- ✅ **레버리지/할당 비율 실시간 계산**
- ✅ **파일 업로드 기능**
- ✅ **글래스모피즘 UI 디자인**
- ✅ **모바일 반응형**

### Vercel 최적화
- ✅ **보안 헤더 설정** (vercel.json)
- ✅ **환경별 설정 분리**
- ✅ **성능 최적화된 빌드 설정**

## 🔧 로컬 개발

```bash
cd frontend
pnpm install
pnpm dev
```

## 🚨 주의사항

1. **Backend URL 업데이트**: `NEXT_PUBLIC_API_BASE_URL`을 실제 백엔드 URL로 변경
2. **Demo Token 교체**: `DEMO_BEARER_TOKEN`을 실제 토큰으로 교체
3. **Root Directory**: Vercel에서 반드시 `frontend`로 설정

## 🎉 배포 성공 확인

배포 후 다음 항목들을 확인하세요:

- [ ] 메인 페이지 로딩
- [ ] 자산 검색 기능
- [ ] 차트 표시
- [ ] API 연동 (브라우저 Network 탭 확인)
- [ ] 모바일 반응형

**이제 실제 제품 수준의 hlh_hack 프론트엔드가 Vercel에 배포됩니다!** 🚀