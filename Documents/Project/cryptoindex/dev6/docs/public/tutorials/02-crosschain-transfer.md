# 튜토리얼: 크로스체인 전송

HyperIndex는 여러 블록체인 네트워크를 지원합니다. 이 튜토리얼에서는 Ethereum에서 생성한 인덱스 토큰을 Polygon으로 전송하는 방법을 알아봅니다.

## 전제 조건

-   Ethereum과 Polygon 네트워크 모두에 지갑 설정
-   전송할 인덱스 토큰 (e.g., MBI)
-   각 네트워크의 Gas 비용 (ETH, MATIC)

---

## 1단계: HyperIndex Bridge 접속

HyperIndex 웹 앱의 "Bridge" 또는 "Cross-Chain" 섹션으로 이동합니다.

## 2단계: 전송 정보 입력

1.  **출발 네트워크 (From):** `Ethereum`
2.  **도착 네트워크 (To):** `Polygon`
3.  **자산 (Asset):** 전송하려는 인덱스 토큰 `MBI` 선택
4.  **수량 (Amount):** 전송할 수량 입력

## 3단계: 트랜잭션 승인 (Approve)

Polygon으로 토큰을 보내기 전에, HyperIndex의 브릿지 컨트랙트가 당신의 MBI 토큰을 제어할 수 있도록 `Approve` 트랜잭션을 실행해야 합니다.

-   `Approve` 버튼을 클릭하고 지갑에서 트랜잭션을 확인합니다.

이 과정은 토큰을 전송할 때마다 처음 한 번만 필요할 수 있습니다.

## 4단계: 전송 실행 (Transfer)

승인이 완료되면 `Transfer` 또는 `Bridge` 버튼이 활성화됩니다.

-   `Transfer` 버튼을 클릭합니다.
-   지갑에서 최종 전송 트랜잭션 내용을 확인하고 서명합니다.
-   출발 네트워크(Ethereum)에서 트랜잭션이 컨펌되면, 브릿지가 도착 네트워크(Polygon)에서 해당 토큰을 발행하는 프로세스를 시작합니다.

## 5단계: Polygon에서 토큰 확인

잠시 후, 당신의 Polygon 지갑에 동일한 `MBI` 토큰이 들어온 것을 확인할 수 있습니다.

-   Polygon의 토큰 컨트랙트 주소를 지갑에 추가해야 보일 수 있습니다.
-   HyperIndex 앱에서 네트워크를 Polygon으로 전환하면 전송된 자산을 바로 확인할 수 있습니다.

이제 당신의 인덱스 토큰은 Polygon의 저렴한 수수료 환경에서 자유롭게 거래되거나 다른 DeFi 프로토콜에 예치될 수 있습니다.