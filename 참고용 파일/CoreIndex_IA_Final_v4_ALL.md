# CoreIndex Information Architecture (v4)

_This file is a merged, text-friendly export of the IA for use with code assistants (e.g., Codex). Each section corresponds to a sheet from the master spreadsheet._



---

## Header

| 계층1 | 계층2 | 계층3 | 계층4 | 계층5 | 계층6 | 계층7 | 계층8 | 설명 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Header |  |  |  |  |  |  |  |  |
|  | 가운데 노치 |  |  |  |  |  |  | 우리 들어갈 사이트가 두개밖에 없으니까 아이폰 노치처럼, 천장 다 막는 답답한 헤더 말고 노치 형태의 탭 두개가 부드럽게 전환되는 ux 구현. 첨엔 런치에 있다가 Index 누르면 탭 강조하는 네모가 오른쪽 인덱스로 가는거 |
|  |  | Launch |  |  |  |  |  | launch 페이지로 이동 |
|  |  | Index |  |  |  |  |  | Index 페이지로 이동 |


---

## Launch

| 계층1 | 계층2 | 계층3 | 계층4 | 계층5 | 계층6 | 계층7 | 계층8 | 설명 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Launch |  |  |  |  |  |  |  | 사용자가 지갑을 연결 → 인덱스(종목 바스켓) 구성 → 레버리지와 비율 조정 → 미리보기 확인 → 결제 및 스왑 → Launch 실행 |
|  | Hero |  |  |  |  |  |  |  |
|  |  | 1행 오른쪽 |  |  |  |  |  |  |
|  |  |  | Connect Wallet |  |  |  |  | 헤더가 노치로 있으니까 이버튼은 메인에 있어야함 |
|  |  | 1행 왼쪽 |  |  |  |  |  |  |
|  |  |  | 히어로 제목 부제목 |  |  |  |  | Index Creation Made Simple / Create, preview, and launch in one go |
|  | Basics |  |  |  |  |  |  |  |
|  |  | 2행 왼쪽 |  |  |  |  |  |  |
|  |  |  | Index Name |  |  |  |  | 사용자가 생성할 인덱스 이름 입력 |
|  |  |  | Ticker |  |  |  |  | 심볼/티커 입력 |
|  |  |  | Cover Image |  |  |  |  | 이미지 업로드 |
|  |  |  | Description |  |  |  |  | 설명 텍스트 |
|  |  |  | Social Link |  |  |  |  | 선택 입력 |
|  | Components |  |  |  |  |  |  |  |
|  |  | 2행 가운데 |  |  |  |  |  |  |
|  |  |  | Asset Search |  |  |  |  | 하이퍼코어에서 자산 검색 |
|  |  |  | Asset Cards |  |  |  |  | 선택된 종목 리스트 |
|  |  |  |  | Asset Name |  |  |  |  |
|  |  |  |  | Ticker |  |  |  |  |
|  |  |  |  | Price |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  | Long/Short |  |  |  | 롱숏 선택 |
|  |  |  | 구매량 입력 |  |  |  |  | hype단위로 입력, USDC로 변환해서 보여주기 |
|  |  |  | Asset Textbox |  |  |  |  | 비율 숫자로 입력 (종목별로 입력창 뜨게 구현 종목이 세개면 세개 떠야함) |
|  |  |  | Asset Slider |  |  |  |  | 비율 조정 |
|  |  |  | Leverage Textbox |  |  |  |  | 레버리지 숫자로 입력 |
|  |  |  | Leverage Slider |  |  |  |  | 레버리지 조정 |
|  |  |  | 결정 버튼 |  |  |  |  | 누르면 프리뷰에 뜸 |
|  | Preview | 2행 오른쪽 |  |  |  |  |  |  |
|  |  |  | Chart |  |  |  |  | 성과 차트 (1d, 7d) |
|  |  |  | Performance Metrics |  |  |  |  | Return %, MDD |
|  | Checkout |  |  |  |  |  |  |  |
|  |  | 3행 |  |  |  |  |  |  |
|  |  |  | Summary Card |  |  |  |  | 필요 금액/수수료/HYPE 보유량 |
|  |  |  | Inline Swap |  |  |  |  | HYPE 부족 시 교환 기능 |
|  |  |  | Launch Button |  |  |  |  | 최종 실행 - 모달 띄우기 |
|  |  |  |  | Modal |  |  |  |  |
|  |  |  |  |  | Confirm |  |  | 체크박스 포함 요약 확인 빨간색 |
|  |  |  |  |  | Success |  |  | 완료 메시지 및 공유 버튼 |


---

## Index

| Level | Section | Item | Key | Description | Priority | Source |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Header | Notch tabs: Launch | Index |  | Centered notch; keep minimal height |  |  |
| 2 | Header | Connect Wallet (right) |  | Island-style button on the top-right |  | Privy |
| 1 | Toolbar | Search | search | Search by name, symbol, and description | Required | Directory |
| 1 | Toolbar | Sort | sort | Sort by Date Created, 24h Change %, 1W Change %, A→Z, Lowest MDD | Required | Derived |
| 1 | Toolbar | Filter | filter | Toggle Active / Redeemed | Required | Directory/Engine |
| 1 | Cards Grid | Card |  | Each card summarizes an index and key market stats |  |  |
| 2 | Cards Grid | Identity |  | Identity block on top-left of the card |  |  |
| 3 | Cards Grid | Name | name | Index display name | Required | Directory |
| 3 | Cards Grid | Symbol | symbol | Ticker/short symbol | Required | Directory |
| 2 | Cards Grid | Market Metrics |  | Live market stats |  |  |
| 3 | Cards Grid | Current Price | markPx | Latest mark price for the index token | Required | Market API |
| 3 | Cards Grid | 24h Volume | dayNtlVlm | Notional traded in last 24h | Required | Market API |
| 3 | Cards Grid | Open Interest | openInterest | Total open interest (notional) | Required | Market API |
| 3 | Cards Grid | Max Leverage | maxLeverage | Maximum leverage allowed | Required | Market/Config API |
| 3 | Cards Grid | 24h Change % | change24hPct | Percentage change over last 24 hours | Required | Derived (price history) |
| 3 | Cards Grid | 1W Change % | change1wPct | Percentage change over last 7 days | Required | Derived (price history) |
| 3 | Cards Grid | Funding Rate | funding | Current funding rate (hourly/8h basis depending on market) | Recommended | Market API |
| 3 | Cards Grid | Premium | premium | Premium/discount vs. underlying basket NAV | Recommended | Derived |
| 3 | Cards Grid | Impact Price | impactPxs | Estimated execution price for a standard order size (e.g., $10k) | Recommended | Orderbook/Quote API |
| 3 | Cards Grid | Funding History | fundingHistory | Recent funding rate snapshots (e.g., 8h x last 7 days) | Recommended | Market API |
| 3 | Cards Grid | Liquidation Threshold | liqThreshold | Approx. liquidation threshold (if applicable to leveraged index token) | Recommended | Risk/Config API |
| 2 | Cards Grid | Actions |  | Primary actions on the card bottom-right |  |  |
| 3 | Cards Grid | Details | action:details | Open details modal | Required |  |
| 3 | Cards Grid | Redeem | action:redeem | Burn & refund to USDC (partial/full) | Required | Engine/Corewriter |
| 3 | Cards Grid | Share | action:share | Copy public link | Optional |  |
| 1 | Details Modal | Overview |  | High-level index info |  |  |
| 2 | Details Modal | Header |  | Name, Symbol, Status badge (Active/Redeemed) | Required | Directory/Engine |
| 2 | Details Modal | Chart | chart | Performance chart with 7D / 1M toggles; show Return % and MDD | Required | Derived (history) |
| 2 | Details Modal | Composition | composition | Constituents with weight and leverage; simple change log | Required | Engine/Directory |
| 2 | Details Modal | Market & Risk |  | Deeper market data and risk metrics |  |  |
| 3 | Details Modal | Current Price | markPx | Latest mark price | Required | Market API |
| 3 | Details Modal | Funding Rate | funding | Current funding rate with next funding countdown if available | Recommended | Market API |
| 3 | Details Modal | Funding History | fundingHistory | Time series of funding rates | Recommended | Market API |
| 3 | Details Modal | Premium | premium | Premium/discount vs. NAV | Recommended | Derived |
| 3 | Details Modal | Impact Price | impactPxs | Execution price estimate for standard order sizes | Recommended | Orderbook/Quote API |
| 3 | Details Modal | Liquidation Threshold | liqThreshold | Approx. liquidation threshold or risk bands | Recommended | Risk/Config API |
| 2 | Details Modal | KPIs |  | Optional KPIs if we have data |  |  |
| 3 | Details Modal | Since Inception Return % | returnSinceInceptionPct | Cumulative return since launch | Optional | Derived |
| 3 | Details Modal | Market Cap | marketCap | Market capitalization of the index token | Optional | Derived |
| 3 | Details Modal | NAV | nav | Net Asset Value of the index | Optional | Derived |
| 1 | Redeem Modal | Controls |  | Redeem/burn the index and refund USDC |  |  |
| 2 | Redeem Modal | Amount | amount | Partial or full redemption | Required | Engine |
| 2 | Redeem Modal | Slippage Tolerance | slippage | Optional slippage limit | Optional | Derived/Quote |
| 2 | Redeem Modal | Summary | summary | Est. refund, fees, steps | Required | Quote/Engine |
| 2 | Redeem Modal | Risk Acknowledgment | riskAck | Checkbox to confirm risks | Required |  |
| 2 | Redeem Modal | CTA | action:confirmRedeem | Confirm Redeem button | Required | Engine/Corewriter |
| 2 | Redeem Modal | Stepper | steps | Close Position → Burn → Transfer | Optional | Engine |
| 1 | Empty State | Message + CTA |  | No indexes yet → Create New | Required |  |
| 1 | Footer | Disclaimer |  | Risk Disclaimer / Terms (light mint-gray) | Optional |  |


---

## Admin Page

| 계층1 | 계층2 | 계층3 | 계층4 | 계층5 | 계층6 | 계층7 | 계층8 | 설명 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Admin Page |  |  |  |  |  |  |  |  |
|  | Launch test |  |  |  |  |  |  | 비슷하게 하되 디자인 신경안쓰고 욱여넣기 레이아웃만 같게 |
|  | Index Test |  |  |  |  |  |  | 비슷하게 하되 디자인 신경안쓰고 욱여넣기 레이아웃만 같게 |


---

## Style Guide

| Category | Element | Value / Spec |
| --- | --- | --- |
| Color | Background | #072723 (Dark Teal) |
| Color | Primary Accent | #98FCE4 (Soft Mint) |
| Color | Secondary Accent | #D7EAE8 (Light Mint-Gray) |
| Color | Primary Text | #FFFFFF (White) |
| Color | Secondary Text | #A0B5B2 (Muted Gray) |
| Font | Primary Font | Inter (Bold for titles/buttons, Medium for headers, Regular for body) |
| Button | Primary | Background #98FCE4, Text #072723, Radius 12px |
| Button | Secondary | Transparent background, Mint-gray border/text, Radius 12px |
| Icon | Style | Simple line icons (Lucide/Feather), no emojis |
| Chart | Line | Mint line (#98FCE4) |
| Chart | Fill | Mint overlay with 20–30% opacity |


---

## Index Cards – Fields

| Field | Key | Description | Priority | Source |
| --- | --- | --- | --- | --- |
| Name | name | Index display name | Required | Directory / Metadata |
| Symbol | symbol | Ticker / short symbol | Required | Directory / Metadata |
| Current Price | markPx | Latest mark price for the index token | Required | Market API |
| 24h Volume | dayNtlVlm | Notional traded in last 24h | Required | Market API |
| Open Interest | openInterest | Open interest (notional) on the index | Required | Market API |
| Max Leverage | maxLeverage | Maximum leverage allowed for the index | Required | Market/Config API |
| 24h Change % | change24hPct | Percentage change over last 24 hours | Required | Derived (markPx history) |
| 1W Change % | change1wPct | Percentage change over last 7 days | Required | Derived (markPx history) |
| Funding Rate | funding | Current funding rate | Recommended | Market API |
| Premium | premium | Premium/discount vs underlying basket | Recommended | Derived |
| Impact Price | impactPxs | Estimated execution price given order size | Recommended | Market/Orderbook API |
| Funding History | fundingHistory | Historical funding rates | Recommended | Market API |
| Liquidation Threshold | liqThreshold | Approx. liquidation threshold if applicable | Recommended | Risk/Config API |


---

## Index Details – Fields

| Field | Key | Description | Priority | Source |
| --- | --- | --- | --- | --- |
| NAV | nav | Net Asset Value of the index | Optional | Derived |
| Market Cap | marketCap | Index token market capitalization | Optional | Derived |
| Composition | composition | Constituents with weight and leverage | Required | Directory / Engine |
| Return (Since Inception) | returnSinceInceptionPct | Cumulative return since launch | Recommended | Derived (history) |
| Current Price | markPx | Latest mark price | Required | Market API |
| Funding Rate | funding | Current funding rate | Recommended | Market API |
| Funding History | fundingHistory | Historical funding rates | Recommended | Market API |
| Premium | premium | Premium/discount vs underlying | Recommended | Derived |
| Impact Price | impactPxs | Execution price estimate | Recommended | Market/Orderbook API |
| Liquidation Threshold | liqThreshold | Approx. liquidation threshold if applicable | Recommended | Risk/Config API |


---

## Index – Structured

| Level | Section | Item | Key | Description | Priority | Source |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Header | Notch tabs: Launch | Index |  | Centered notch; keep minimal height |  |  |
| 2 | Header | Connect Wallet (right) |  | Island-style button on the top-right |  | Privy |
| 1 | Toolbar | Search | search | Search by name, symbol, and description | Required | Directory |
| 1 | Toolbar | Sort | sort | Sort by Date Created, 24h Change %, 1W Change %, A→Z, Lowest MDD | Required | Derived |
| 1 | Toolbar | Filter | filter | Toggle Active / Redeemed | Required | Directory/Engine |
| 1 | Cards Grid | Card |  | Each card summarizes an index and key market stats |  |  |
| 2 | Cards Grid | Identity |  | Identity block on top-left of the card |  |  |
| 3 | Cards Grid | Name | name | Index display name | Required | Directory |
| 3 | Cards Grid | Symbol | symbol | Ticker/short symbol | Required | Directory |
| 2 | Cards Grid | Market Metrics |  | Live market stats |  |  |
| 3 | Cards Grid | Current Price | markPx | Latest mark price for the index token | Required | Market API |
| 3 | Cards Grid | 24h Volume | dayNtlVlm | Notional traded in last 24h | Required | Market API |
| 3 | Cards Grid | Open Interest | openInterest | Total open interest (notional) | Required | Market API |
| 3 | Cards Grid | Max Leverage | maxLeverage | Maximum leverage allowed | Required | Market/Config API |
| 3 | Cards Grid | 24h Change % | change24hPct | Percentage change over last 24 hours | Required | Derived (price history) |
| 3 | Cards Grid | 1W Change % | change1wPct | Percentage change over last 7 days | Required | Derived (price history) |
| 3 | Cards Grid | Funding Rate | funding | Current funding rate (hourly/8h basis depending on market) | Recommended | Market API |
| 3 | Cards Grid | Premium | premium | Premium/discount vs. underlying basket NAV | Recommended | Derived |
| 3 | Cards Grid | Impact Price | impactPxs | Estimated execution price for a standard order size (e.g., $10k) | Recommended | Orderbook/Quote API |
| 3 | Cards Grid | Funding History | fundingHistory | Recent funding rate snapshots (e.g., 8h x last 7 days) | Recommended | Market API |
| 3 | Cards Grid | Liquidation Threshold | liqThreshold | Approx. liquidation threshold (if applicable to leveraged index token) | Recommended | Risk/Config API |
| 2 | Cards Grid | Actions |  | Primary actions on the card bottom-right |  |  |
| 3 | Cards Grid | Details | action:details | Open details modal | Required |  |
| 3 | Cards Grid | Redeem | action:redeem | Burn & refund to USDC (partial/full) | Required | Engine/Corewriter |
| 3 | Cards Grid | Share | action:share | Copy public link | Optional |  |
| 1 | Details Modal | Overview |  | High-level index info |  |  |
| 2 | Details Modal | Header |  | Name, Symbol, Status badge (Active/Redeemed) | Required | Directory/Engine |
| 2 | Details Modal | Chart | chart | Performance chart with 7D / 1M toggles; show Return % and MDD | Required | Derived (history) |
| 2 | Details Modal | Composition | composition | Constituents with weight and leverage; simple change log | Required | Engine/Directory |
| 2 | Details Modal | Market & Risk |  | Deeper market data and risk metrics |  |  |
| 3 | Details Modal | Current Price | markPx | Latest mark price | Required | Market API |
| 3 | Details Modal | Funding Rate | funding | Current funding rate with next funding countdown if available | Recommended | Market API |
| 3 | Details Modal | Funding History | fundingHistory | Time series of funding rates | Recommended | Market API |
| 3 | Details Modal | Premium | premium | Premium/discount vs. NAV | Recommended | Derived |
| 3 | Details Modal | Impact Price | impactPxs | Execution price estimate for standard order sizes | Recommended | Orderbook/Quote API |
| 3 | Details Modal | Liquidation Threshold | liqThreshold | Approx. liquidation threshold or risk bands | Recommended | Risk/Config API |
| 2 | Details Modal | KPIs |  | Optional KPIs if we have data |  |  |
| 3 | Details Modal | Since Inception Return % | returnSinceInceptionPct | Cumulative return since launch | Optional | Derived |
| 3 | Details Modal | Market Cap | marketCap | Market capitalization of the index token | Optional | Derived |
| 3 | Details Modal | NAV | nav | Net Asset Value of the index | Optional | Derived |
| 1 | Redeem Modal | Controls |  | Redeem/burn the index and refund USDC |  |  |
| 2 | Redeem Modal | Amount | amount | Partial or full redemption | Required | Engine |
| 2 | Redeem Modal | Slippage Tolerance | slippage | Optional slippage limit | Optional | Derived/Quote |
| 2 | Redeem Modal | Summary | summary | Est. refund, fees, steps | Required | Quote/Engine |
| 2 | Redeem Modal | Risk Acknowledgment | riskAck | Checkbox to confirm risks | Required |  |
| 2 | Redeem Modal | CTA | action:confirmRedeem | Confirm Redeem button | Required | Engine/Corewriter |
| 2 | Redeem Modal | Stepper | steps | Close Position → Burn → Transfer | Optional | Engine |
| 1 | Empty State | Message + CTA |  | No indexes yet → Create New | Required |  |
| 1 | Footer | Disclaimer |  | Risk Disclaimer / Terms (light mint-gray) | Optional |  |