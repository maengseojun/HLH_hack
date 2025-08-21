**제품 및 서비스 설명**

  **1.** **사업 개요 및 혁신성**

HyperIndex는 Hyperliquid L1 블록체인의 HyperEVM 레이어에서 운영되는 세계 최초 밈코인 인덱스 토큰화 거래소입니다. 본 플랫폼은 전통 금융시장의  상장지수펀드(ETF) 구조를 완전 탈중앙화된 블록체인 환경에서 구현하여, 실제 운용 가능한 인덱스 토큰을 통한 새로운 투자 패러다임을 제시합니다.

  **1.1** **시장 혁신성 및 차별화 요소**

  - 세계 최초: 밈코인 특화 인덱스 토큰 발행/유통 플랫폼

  - 기술적 혁신: 하이브리드 거래 시스템을 통한 CEX급 성능과 DEX의 투명성 동시 달성

  - 금융 공학: 전통금융 ETF-AP(Authorized Participant) 모델의 완전한 DeFi 구현

- 크로스체인 통합: 멀티체인 자산을 단일 플랫폼에서 통합 관리

  **2.** **핵심 기술 아키텍처**

  **2.1 HOOATS (Hybrid OffChain Orderbook + AMM Trading System)**

  **2.1.1 Off-Chain Orderbook** **엔진**

  - 처리 성능: 현재 15,000 TPS, 목표 20,000 TPS

  - 기술 스택: Redis 클러스터 기반 고성능 메모리 데이터베이스

  - 매칭 알고리즘: 가격-시간 우선순위(Price-Time Priority) 기반 최적화된 주문 매칭

  - 지연시간: 평균 5ms 이하의 초저지연 주문 체결

- 보안: Commit-Reveal 메커니즘을 통한 MEV(Maximal Extractable Value) 공격 방어

  **2.1.2 On-Chain Settlement** **시스템**

  - 투명성: 모든 거래 결과의 블록체인 기록 보장

  - 보안: 스마트 컨트랙트를 통한 자동화된 자산 정산

  - 검증 가능성: 탈중앙화된 거래 내역 검증 시스템

- 배치 처리: 가스 비용 최적화를 위한 거래 배치 정산

  **2.1.3 AMM(Automated Market Maker)** **통합**

  - 유동성 제공: Constant Product Formula(x*y=k) 기반 자동 시장 조성

  - 가격 발견: 실시간 시장 균형가격 형성 메커니즘

  - 슬리피지 최소화: 스마트 라우팅을 통한 최적 가격 매칭

  - 차익거래 억제: 동적 수수료 조정을 통한 시장 안정성 확보

  **2.2 Smart Contract Vault (SCV) - ETF-AP** **구조 구현**

  **2.2.1** **멀티체인 자산 담보 시스템**

  - 지원 네트워크: Ethereum, BSC, Solana 등 주요 블록체인

  - 담보 비율: 1:1 완전담보 방식으로 인덱스 토큰의 내재가치 보장

  - 실시간 검증: 24/7 담보 비율 모니터링 및 자동 리밸런싱

  **2.2.2** **가격 오라클 시스템**

  - 데이터 소스: 1inch, Jupiter, 0x Protocol 등 주요 Aggregator 연동

  - 가격 업데이트: 실시간 가격 피드를 통한 정확한 NAV(Net Asset Value) 계산

  - 조작 방지: 복수 오라클 소스 검증을 통한 가격 조작 방어

  **2.2.3** **크로스체인 메시징**

  - 기술 파트너: LayerZero 프로토콜 활용

  - 메시지 검증: 다중 서명 및 시간 지연을 통한 보안성 강화

  - 자동화: 스마트 컨트랙트 기반 자동 크로스체인 자산 이동

  **2.2.4** **기관 전용 생성/소각 메커니즘 (AP 시스템)**

  - 생성 프로세스: 기관투자자가 기초자산을 예치하여 인덱스 토큰 발행

  - 소각 프로세스: 인덱스 토큰을 반환하여 기초자산 회수

  - 차익거래 인센티브: NAV-시장가격 괴리 시 무위험 수익 기회 제공

  - 시장 효율성: AP 참여를 통한 자동적 가격 수렴 메커니즘

  **2.3** **탈중앙화 거버넌스 및 리밸런싱 시스템**

  **2.3.1** **일반 리밸런싱 (Democratic Rebalancing)**

  - 투표 시스템: 토큰 홀더 지분 비례 투표권 행사

  - 제안 프로세스: 커뮤니티 주도의 편입/제외 종목 결정

  - 실행 메커니즘: 스마트 컨트랙트 자동 실행을 통한 투명한 리밸런싱

구체적 설명: 일반적인 리밸런싱처럼, 특정 종목의 비중 조정 및 바스켓에서 종목 이탈 편입 등의 투표를 진행하게 됨. 다만, 투표 과정에서 아주 확정적으로 투표결과가 예측되지 않도록 조심해야 함. 즉, A토큰을 n개만큼의 수량으로 리밸런싱 하겠다 등의 투표가 이루어져서는 안됨. 이는 사후적으로 발표되어야 하며, 프로토콜 상으로 자동적으로 이루어져야 함. 그래야 중앙화 위험도 벗어나고, 리밸런싱 포지션이 오픈되면 우리가 사야 할 토큰이 공격의 대상이 되기에 충분함. 따라서, 리밸런싱 후보들을 보여주고, 각 투표권에 따라서 후보들마다 투표 수가 모이고, 이를 마치 로또 뽑듯이 뽑기해서 결정하는 등으로, 투표 과정에서 민주성도 보장되지만, 무결성과 무작위성도 들어가야함.

**2.3.2 VS 리밸런싱 (Competitive Rebalancing)**

  - 대결 구조: "Trump VS Elon", "AI VS Meme" 등 테마 대결

  - 승부 결정: 각 테마별로 집계된 투표 수가 하나의 로또 공처럼 작용하여, 무작위 추출을 통한 승부 결정이 이루어짐.

  - 집중 운영: 승리 테마에 대한 특정 기간 집중 투자

  - 엔터테인먼트: 게임화된 투자 경험을 통한 사용자 참여 촉진

구체적 설명: VS 타입은 일반타입과 매우 다름. 특정 VS토큰들에 대해서만 작동하는 리밸런싱 방식임. VS토큰 역시 투표 수가 모이고, 로또 뽑듯이 뽑기해서 결정되는 것이어야 함. 과도한 선행매매 등을 막기 위해서. 그리고, VS토큰으로 승리하게 된 팀의 테마로 일정 기간동안 자금 운용이 집중적으로 이루어지게 됨. VS토큰에서 탈락한 팀의 테마마으로부터 승리한 팀의 테마로 자금 흐름을 이동시키는 것으로 이해하면 됨.


  **3.** **소비자 삶의 변화 및 가치 제안**

  **3.1** **개인 트레이더 (Primary Target Market)**

  **3.1.1** **투자 복잡성 해결**

  - 리서치 부담 경감: 개별 밈코인 분석 없이 테마별 다변화 포트폴리오 구성

  - 전문성 격차 해소: 기관급 투자 전략에 개인 투자자도 접근 가능

  - 시간 효율성: 원스톱 투자 플랫폼을 통한 시간 절약

  **3.1.2** **리스크-리턴 최적화**

  - 변동성 완화: 개별 밈코인 대비 20-30% 변동성 감소 (포트폴리오 효과)

  - 안전성 강화: 분산투자를 통한 개별 토큰 몰락 리스크 회피

  - 수익성 유지: 밈코인 섹터의 고수익 특성 보존

  **3.1.3** **접근성 및 사용자 경험 개선**

  - 멀티체인 통합: 하나의 플랫폼에서 다중 블록체인 자산 익스포져

  - 초고속 거래: CEX 수준의 거래 속도 (평균 5ms 체결)

  - 저비용 구조: 개별 토큰 구매 대비 60-80% 거래비용 절감

  **3.1.4** **커뮤니티 참여 및 거버넌스**

  - 민주적, 탈중앙화사결정: 거버넌스 투표를 통한 포트폴리오 구성 참여

  - 커뮤니티 형성: 공통 관심사 기반 투자자 네트워크 구축

  - 게임화 요소: VS 리밸런싱을 통한 엔터테인먼트성 제공

  **3.2** **기관 투자자 (Authorized Participants)**

  **3.2.1** **차익거래 기회**

  - NAV-시장가격 괴리: 평균 0.1-0.5% 스프레드에서 무위험 수익 (기관이 직접 기초자산을 보유하여 생성 소각에 참여하는 경우, 이 스프레드는 더 낮아질 수 있음)

  - 높은 회전율: 밈코인 시장의 높은 변동성으로 인한 빈번한 기회 창출

  - 확장성: 대규모 자본 투입 가능한 구조적 차익거래 모델

  **3.2.2** **유동성 공급 인센티브**

  - 시장 조성: LP(Liquidity Provider) 역할을 통한 추가 수익원 창출

  - 생태계 기여: 시장 효율성 개선을 통한 전체 플랫폼 가치 상승

  **4.** **기술 개발 현황 및 성과 (2025년 8월 10일 기준)**

**4.1 Frontend** **개발 완성도**

|   |   |   |   |
|---|---|---|---|
|**컴포넌트**|**개발 상태**|**완성도**|**비고**|
|Trading Page|초안 완료|85%|실시간 차트, 주문 인터페이스 포함  <br>현재 UI 디자인 개선만 필요|
|Landing Page|초안 구성중|60%|레퍼런스를 통한 초안 구현중|
|Wallet Connection|초안 완료|85%|Trading Page와 동일한 상태|
|Portfolio Dashboard|초안 완료|70%|컴포넌트 구현 완료, 디자인 추가 개선 및 Back-Front 연동 필요|
|Governance Portal|초안 완료|70%|Portfolio Dashboard와 동일한 상태|

**4.2 Backend** **핵심 시스템 개발 현황**

**4.2.1 Trading System****개발 현황**

|   |   |   |   |
|---|---|---|---|
|**기능**|**개발 상태**|**진행률**|**주요 마일스톤**|
|Off-Chain Orderbook (OCOB)|V2 Testing|100%+개선 중|- 현재 TPS: 13,000+ 달성<br><br>- 목표 TPS: 20,000 (67% 달성률)<br><br>- 기술 스택: Redis Cluster + Lua Scripts<br><br>- 지연시간: 평균 3.2ms 예상 (목표 5ms 대비 36% 개선)<br><br>- 안정성: 99.9% 가동률 달성<br><br>- 보안 감사: OpenZepplin 소규모 감사 패키지 계획중|
|AMM Smart Contract|V1 Deploy Prepare|70%|- HyperIndex-USDC Pair: v1.0 개발 완료<br><br>- 테스트넷 상태: 배포 준비 완료, 최종 감사 중<br><br>- 가스 최적화: 표준 Uniswap V2 대비 15% 가스비 절감<br><br>- 보안 감사: Code4rena / OpenZepplin 소규모 감사 패키지 예정<br><br>(그러나 타 감사업체로부터 감사를 받을 가능성도 열려 있음)|
|Smart Router 시스템|V2 Testing|100%+개선 중|- AMM-OCOB 가격 비교: 실시간 최적 경로 탐색<br><br>- 주문 분할: 대량 주문 자동 분할 처리<br><br>- 비용 최적화: 평균 12% 거래비용 절감 달성<br><br>- 처리 속도: 라우팅 결정 평균 0.8ms|

  **4.2.2** **사용자 온보딩 시스템**

  - Privy 통합: Email + Web3 Wallet 지원 완료

  - Embedded Wallet: HyperEVM 네트워크 자동 추가

  - Cross-Chain Bridge: Arbitrum USDC → HyperEVM 브릿지 운영

- KYC/AML: 완전한 DEX탈중앙화로써, KYC및 AML 필요하지 않음

**4.2.3 Token Creation/Redemption Protocol**

|   |   |   |   |
|---|---|---|---|
|**기능**|**개발 상태**|**진행률**|**주요 마일스톤**|
|MultiChain Aggregator|Prototype 완료|80%|1차 테스트 진행중, MVP 런치 전까지 최소 5회 이상 버전 개선 예정|
|Creation Logic|Prototype 완료|80%|1차 테스트 진행중, HyperEVM 테스트넷 상에서의 토큰 Creation 테스트 예정|
|Redemption Protocol|개발 중|50%|- Redemption의 기본은 Index의 구성요소를 그대로 Insitution에게 반환하는 방식.  <br>- LayerZero와의 기술적 협업을 통한 업계 최고 수준 보안과 속도를 목표로 함.|
|Instant Swap Redemption|개발 중|30%|- Optional로 제공되는 Redemption 방식. Index의 구성요소를 Swap하여 네이티브 토큰으로 Institution에게 반환하는 방식.<br><br>- DEX Aggregator의 통합과, Slippage계산 등 복잡한 로직이 요구되므로, 초기에는 베타 테스팅 기능으로 출시 후 보강 예정|
|Cross-Chain Messaging|개발 중|50%|LayerZero Labs 프로토콜 통합으로 개발 진행중, 기술적 협업 진행중|
|Composition Instant Creation|개발 중|30%|Composition -> SCV Direct 예치를 통한 Token Creation 방식. 초기에 Beta Feature 형식으로 출시 후 보강 예정|

**4.2.4 Governance**
구조 미확정 상태. 아이디어 구체화중중

**5.** **전략적 파트너십 및 협업 현황 및 계획**

|   |   |   |   |
|---|---|---|---|
|파트너|협업 영역|진행 상태|예상 완료|
|LayerZero Labs|- Cross Chain Messaging Security<br><br>- HyperEVM Messaging Support|컨택 후 프로젝트 상세 논의중|2025.08|
|1inch|- Multi Chain Aggregation(BSC, ETH, etc.) : Token Creation-Redemption 과정의 Aggregator로 작용<br><br>- 1inch Swap DEX Integration|2025 8월 3주차 컨택 예정|2025.08|
|Jupiter|- Solana Aggregation|2025 8월 3주차 컨택 예정|2025.08|
|0x Protocol|- Second Tier Multichain Aggregation|2025 8월 3주차 컨택 예정|2025.08|
|Axiom Trade(SOL)|- Trading Infrastructure Partner|2025 8월 4주차 컨택 예정|2025.09|
|Photon Trade(SOL)|- Trading Infrastructure Partner|2025 8월 4주차 컨택 예정|2025.09|
|Trojan Trade(SOL)|- Trading Infrastructure Partner|2025 8월 4주차 컨택 예정|2025.09|
|Uniswap(ETH main, multichain)|- DEX Exchange Partner|2025 8월 4주차 컨택 예정|2025.09|
|Pancakeswap(BSC main, multichain)|- DEX Exchange Partner|2025 8월 4주차 컨택 예정|2025.09|
|Hyperliquid Foundation(Hyperliquid L1, HyperCore&HyperBFT structure, built HyperEVM)|- DEX Exchange Partner  <br>- Foundation of HyperEVM, Support of Technical Structure|2025 8월 4주차 컨택 예정|2025.09|
|Raydium(SOL)|- DEX Exchange Partner|2025 8월 4주차 컨택 예정|2025.09|
|Pumpfun/PumpSwap(SOL)|- DEX Exchange Partner<br><br>- Not Migrated Token에 대해 인덱스 구성요소로 편입 가능한지|2025 8월 4주차 컨택 예정|2025.09|
|Aerodrome(Base)|- DEX Exchange Partner|2025 8월 4주차 컨택 예정|2025.09|
|Meteora(SOL)|- DEX Exchange Partner|2025 8월 4주차 컨택 예정|2025.09|
|Orca(SOL)|- DEX Exchange Partner|2025 8월 4주차 컨택 예정|2025.09|
|DEX Screener|- DEX Exchanges and Tokens Screener: INDEX 리스트 별도 만들기 요청 or 우리 거래소도 DEX Screener 목록 올라가도록 요청|2025 8월 4주차 컨택 예정|2025.09|
|PolyMarket|- Crypto기반 예측 베팅 사이트<br><br>- 우리 인덱스의 상승 혹은 하락/VS거버넌스 관련 항목에 대한 Polymarket Poll 생성 요청|2025 9월 1주차 컨택 예정|2025.10|
|TradingView|- TradingView의 고성능 차트 기능|2025 8월 2주차 컨택 예정|2025.08|
|Dune.com|- Dune의 Analytics 및 Trading Visualization|2025 8월 2주차 컨택 예정|2025.08|
|Tokenterminal|- Projects에 HyperIndex를 DEX로 등록, 투명한 통계 오픈|2025 9월 1주차 컨택 예정|2025.10|
|HyperSwap|- Hyperliquid L1 HyperEVM 생태계 DEX Partnetship<br><br>- HYPE <-> USDC Aggregator|2025 8월 3주차 컨택 예정|2025.09|
|LiquidSwap|- Hyperliquid L1 HyperEVM 생태계 DEX Partnetship<br><br>- HYPE <-> USDC Aggregator|2025 8월 3주차 컨택 예정|2025.09|
|ChainLink|- 가격 참조 Orcale|2025 8월 2주차 컨택 예정|2025.08|
|Wintermute|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|GSR|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|Jump Trading (Jump Crypto)|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|DWF Labs|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|DRW Cumberland|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|Keyrock|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|Kairon Labs|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|Hehmeyer Trading|- Market Maker|2025 8월3주차 컨택 예정|2025.09|
|MGNR|- Market Maker|2025 8월3주차 컨택 예정|2025.09|

**6.** **상세 개발 로드맵**

  **Phase 1:** **메인넷 런칭 (1개월, 2025년 9월)**

  **기술적 목표**

- TPS 안정화: 15,000+ TPS 지속적 달성 및 모니터링

- E2E 테스트: 전체 시스템 통합 테스트 및 스트레스 테스트

- 보안 강화 – 외부 보안 감사

    - Off-Chain Orderbook 보안 취약점 감사 by OpenZepplin

  - Smart Contract 보안 감사 by OpenZepplin, Code4rena 버그 바운티 프로그램 운영

- 보안 강화 – 운영 보안 체계

    - Incident Response Protocol 수립

    - Multi-sig 관리 체계 구현 (3/4 서명)

- 보안 강화 – 제3자 검증 시스템

    - LayerZero와 Cross-chain messaging 보안 검증

    - Cross Node Validator (Off-Chain Orderbook) 도입 검토: Chainlink Node Operators 컨택

    - Chainlink 오라클 통합 및 검증

- 기관 및 DEX/Trading Infra 파트너용 API v1: 프로그래매틱 거래 및 대량 거래 지원, 오프체인 오더북 거래정보 API 및 Order 투입 가능.

**사업적 목표**

- 인덱스 토큰 출시: 20개 초기 테마 인덱스 메인넷 배포

   - 기관 파트너 온보딩: 5-10개 AP(Authorized Participant) Market Makers 확보

   - Trading Infra / DEX 파트너십 최소 체인 별 1곳 달성

   - DEX Screener 파트너십 및 정보연동

   - 유동성 확보: 초기 유동성 풀 $10M+(인덱스 토큰 총합) 달성

   - 파트너십 목표 중 85%이상 달성

  **생태계 통합**

  - HyperLiquid 통합: HyperSwap, LiquidSwap 등과 AMM 유동성 공유

  - 차트 시스템: TradingView 차트 통합 완료 / Dune Visual Integration

  - 거버넌스 시스템: VS 시스템 및 Normal 거버넌스 완전 구현

  **Phase 2:** **기능 확장 (3개월, 2025년 12월)**

  **성능 최적화 및 사업적 목표**

  - 20,000 TPS 달성: 시스템 아키텍처 최적화 및 하드웨어 스케일링

  - 지연시간 개선: 평균 체결 시간 3ms → 1ms 단축

- 가동률 개선: 99.9% → 99.99% SLA 달성

- 기관용 API v2: 프로그래매틱 거래 및 대량 거래 지원 강화, 비용최적화

- 파트너십 목표 95%이상 달성

  **사용자 경험 확장**

  - 모바일 앱: iOS/Android 네이티브 앱 개발 및 출시

  - 고급 거래 기능: 지정가, 시장가 외 조건부 주문 추가

- 포트폴리오 분석 Upgrade: 실시간 리스크 메트릭 및 고성능 성과 분석 툴 추가

- 사용자의 Customize Index Launch 기능 추가: 사용자가 직접 DEX 토큰을 런치하는 정도의 편의성으로, 플랫폼 내에서 원하는 멀티체인 자산으로 Index Basket을 구성하고, AMM풀을 생성할 수 있도록 하기. 탈중앙성 강화

  **Phase 3:** **생태계 확장 (6개월, 2026년 6월)**

  **커뮤니티 주도 성장**

  - 테마 제안 시스템: 사용자 참여형 인덱스 생성 플랫폼

  - DAO 거버넌스: 완전 탈중앙화된 의사결정 구조 구축

  - 인센티브 시스템: 커뮤니티 기여도 기반 보상 체계

  **고도화된 거래 서비스**

  - 레버리지 거래: 선물 및 무기한 계약 거래 지원
  - HOOATS 확장: Off-Chain 체결, On-Chain 정산 모델로 파생상품 지원

 - Hyperliquid 생태계 내에서 DeFi 영역과 확장: 상위 INDEX 토큰들을 통하여 담보대출 등 서비스 이용 가능하도록 HyperLiquid 생태계의 DeFi와 협업