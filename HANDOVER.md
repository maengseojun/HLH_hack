# CoreIndex 개발 작업 인수인계 문서

## 현재 상황
- 프로젝트 위치: `/Users/kimhyeon/Desktop/생각줄기/HLH_hack/hlh_hack/`
- 한글 폴더명(`생각줄기`) 때문에 Radix 패키지 문제 발생
- 상위폴더를 영문으로 변경 후 작업 재개 예정

## 완료된 작업 ✅

### High Priority (모두 완료)
1. **Allocation 합계=100% 유효성 검사와 경고/자동 보정** 
   - `page.tsx`에 totalAllocation, allocationWarning 로직 추가
   - Auto-fix 버튼으로 균등 분할 기능 구현
   - 경고 메시지 UI 완료

2. **Preview y축/스케일 개선 - NAV 기반 계산**
   - 기존 정규화 방식에서 NAV 기반 합성으로 변경
   - weight * amount * leverage * price_change 공식 적용
   - 실제 포트폴리오 가치 반영

3. **Confirm/Launch 모달(요약 + 체크박스)**
   - `ConfirmLaunchModal.tsx` 컴포넌트 생성
   - 2단계 모달: confirm → success
   - 위험 고지 체크박스, 요약 정보 표시
   - 빨간색 Launch 버튼으로 위험성 강조

### Medium Priority (완료)
4. **Launch 이미지 업로드 찾아보기 한국어 문제 해결**
   - `UploadModal.tsx`에서 custom label로 해결
   - "Choose file or drag and drop" 영문 텍스트 표시

5. **Index 드롭다운에 아래화살표 추가**
   - `Dropdown.tsx`에 SVG 화살표 아이콘 추가
   - 열림/닫힘 상태에 따른 회전 애니메이션

## 대기 중인 작업 🚧

### Medium Priority (진행 예정)
1. **Glassmorphism 디자인 적용**
   - 헤더: `HeaderNav.tsx` - border, bg, backdrop-blur 수정
   - 카드들: 인덱스 카드, 에셋 카드 glassmorphism 스타일
   - 드롭다운: `Dropdown.tsx` 배경 투명도 조정
   - 텍스트박스: input 요소들 glassmorphism 적용

2. **API 계산 개선**
   - `/v1/baskets/calculate` 엔드포인트로 미리보기 정확도 향상
   - 현재는 mock 데이터, 실제 API 연동 필요

## 주요 파일 구조

```
/hlh_hack/src/
├── app/
│   ├── page.tsx (Launch 페이지 - 메인 작업 완료)
│   ├── index/page.tsx (Index 허브)
│   └── layout.tsx
├── components/
│   ├── ConfirmLaunchModal.tsx (신규 생성 - 완료)
│   ├── UploadModal.tsx (수정 완료)
│   ├── HeaderNav.tsx (glassmorphism 대기)
│   ├── Dropdown.tsx (화살표 추가 완료)
│   ├── IndexDetailsModal.tsx
│   ├── RedeemModal.tsx
│   └── ShareModal.tsx
└── lib/
    └── api.ts
```

## 핵심 기능 현황

### Launch 페이지 (`/hlh_hack/src/app/page.tsx`)
- ✅ 에셋 검색 및 선택
- ✅ 할당률 조정 (슬라이더 + 입력)
- ✅ 레버리지 설정
- ✅ NAV 기반 미리보기 차트
- ✅ 할당률 100% 검증 + 자동 보정
- ✅ 런치 확인 모달 연결
- 🚧 Glassmorphism 스타일 적용 대기

### Index 허브 (`/hlh_hack/src/app/index/page.tsx`)
- ✅ 검색, 필터, 정렬 UI
- ✅ 드롭다운 화살표 아이콘
- ✅ 카드 그리드 레이아웃
- ✅ Details/Redeem/Share 모달 연결
- 🚧 Glassmorphism 스타일 적용 대기

## 다음 작업 순서

1. **폴더명 변경 후 재시작**
2. **Glassmorphism 스타일 적용**
   - `border-white/20 bg-white/10 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)]`
3. **API 연동 개선**
4. **추가 기능 구현**

## 스타일 가이드 (IA 문서 기준)

```css
/* Colors */
--color-background: #072723 (Dark Teal)
--color-primary: #98FCE4 (Soft Mint)
--color-secondary: #D7EAE8 (Light Mint-Gray)
--color-muted-foreground: #A0B5B2 (Muted Gray)

/* Glassmorphism */
border: border-white/20
background: bg-white/10
backdrop-filter: backdrop-blur-md
box-shadow: shadow-[0_8px_32px_rgba(0,0,0,0.3)]
```

## 중요 참고사항
- 모든 파일 경로는 `/hlh_hack/src/` 기준
- IA 문서: `/참고용 파일/CoreIndex_IA_Final_v4_ALL.md`
- 할당률 합계는 반드시 100%여야 함
- 미리보기는 NAV 기반 계산 방식 사용
- 런치 버튼은 빨간색으로 위험성 강조