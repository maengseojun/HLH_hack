# 🚀 Frontend Vercel 배포 가이드

## 🎯 문제 해결: pnpm lockfile 동기화 오류

**근본 원인:** 여러 폴더에 package.json과 pnpm-lock.yaml이 있어서 Vercel이 혼란스러워함

```
hlh/                 <- 루트 (통합 버전)
├── package.json
├── pnpm-lock.yaml
├── frontend/        <- 원래 hlh_hack 프론트엔드
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── vercel.json
└── backend/
```

## ✅ 즉시 해결 방법

### 1. Vercel 프로젝트 설정 변경

Vercel 대시보드에서:

1. **Settings → General → Root Directory**
   ```
   frontend
   ```

2. **Settings → Build & Development Settings**
   - **Build Command:** `pnpm build`
   - **Install Command:** `pnpm install --no-frozen-lockfile` (임시)
   - **Output Directory:** `.next`

### 2. 환경 변수 설정

Vercel 대시보드 → **Settings → Environment Variables**:

```bash
# 프로덕션용
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com

# 데모/테스트용
DEMO_BEARER_TOKEN=production_demo_token_replace_me

# 외부 API
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
INFO_API_URL=https://api.hyperliquid.xyz/info

# 성능/보안
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
REQUEST_TIMEOUT_MS=30000
```

### 3. 재배포

이제 Vercel에서 재배포하면 `frontend/` 폴더의 Next.js 앱이 정상적으로 빌드됩니다.

---

## 🔧 장기 해결책 (옵션)

### A) frontend/ lockfile 동기화 (권장)

```bash
cd frontend
rm -rf node_modules pnpm-lock.yaml

# package.json 수정 (이미 완료됨)
# - engines.node: "22.x"
# - packageManager: "pnpm@9.12.2"

# 새 lockfile 생성
pnpm install --no-frozen-lockfile

# 커밋
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "fix: sync frontend lockfile for Vercel deployment"
git push
```

그 후 Vercel Install Command를 `pnpm install --frozen-lockfile`로 되돌림.

### B) 모노레포로 정리

```bash
# 루트에 workspace 설정
echo "packages:\n  - 'frontend'\n  - 'backend'" > pnpm-workspace.yaml

# 프로젝트 정리
rm package.json pnpm-lock.yaml  # 루트의 통합 버전 제거

# Vercel Root Directory: "frontend" 유지
```

---

## 🚨 현재 상태 체크

**작동 중인 설정:**
- ✅ `frontend/vercel.json` 생성됨
- ✅ `frontend/package.json`에 engines 추가됨
- ⚠️ `frontend/pnpm-lock.yaml` 동기화 필요 (위 단계 참조)

**Vercel에서 설정할 것:**
1. Root Directory: `frontend`
2. Install Command: `pnpm install --no-frozen-lockfile` (임시)
3. Build Command: `pnpm build`

이 설정으로 즉시 배포 가능합니다! 🚀

---

## 📞 트러블슈팅

### 빌드 실패 시:
1. Vercel 로그에서 어떤 디렉터리를 빌드하는지 확인
2. `ls -la` 출력을 보고 올바른 파일들이 있는지 확인
3. Node.js/pnpm 버전이 맞는지 확인

### 의존성 에러 시:
- `@radix-ui: link:@radix-ui` 같은 잘못된 의존성은 이미 제거됨
- 추가 의존성 문제 시 `frontend/package.json` 확인

이제 바로 배포하실 수 있습니다!