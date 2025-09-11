# 튜토리얼: 첫 인덱스 생성하기

이 튜토리얼에서는 HyperIndex 프로토콜을 사용하여 여러 암호화폐 자산을 묶어 자신만의 인덱스 토큰을 생성하는 과정을 단계별로 안내합니다.

## 준비물

-   Sufficient gas fee (e.g., ETH, MATIC)
-   인덱스에 포함할 토큰 (e.g., WETH, WBTC, DAI)
-   HyperIndex SDK 또는 웹 애플리케이션 접속 환경

---

## 1단계: 자산 선택 및 비율 결정

첫 번째 단계는 인덱스에 어떤 자산을 포함할지, 그리고 각 자산의 비율을 어떻게 설정할지 결정하는 것입니다.

예를 들어, "My Bluechip Index"라는 이름으로 아래와 같이 구성해 보겠습니다.

-   **Wrapped Bitcoin (WBTC):** 50%
-   **Wrapped Ether (WETH):** 50%

## 2단계: 인덱스 생성 트랜잭션 실행

SDK 또는 웹 앱을 통해 선택한 자산과 비율 정보를 입력하고 인덱스 생성을 요청합니다.

### JavaScript SDK 예시

```javascript
import { HyperIndexSDK } from 'hyperindex-sdk';

const sdk = new HyperIndexSDK(provider);

const indexAssets = [
  { token: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', weight: 50 }, // WBTC
  { token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', weight: 50 }  // WETH
];

const indexName = "My Bluechip Index";
const indexSymbol = "MBI";

// 인덱스 생성 트랜잭션 실행
const tx = await sdk.createIndex(indexName, indexSymbol, indexAssets);
console.log('Transaction Hash:', tx.hash);

await tx.wait();
console.log('Index "MBI" created successfully!');
```

## 3단계: 유동성 공급 및 인덱스 토큰 발행

인덱스 컨트랙트가 성공적으로 배포되면, 이제 초기 유동성을 공급하여 인덱스 토큰을 발행할 수 있습니다.

1.  **자산 예치:** 2단계에서 설정한 비율에 맞게 WBTC와 WETH를 인덱스 컨트랙트에 예치합니다.
2.  **토큰 발행:** 예치한 자산의 가치에 해당하는 만큼의 "MBI" 인덱스 토큰이 발행되어 당신의 지갑으로 전송됩니다.

### JavaScript SDK 예시

```javascript
// MBI 인덱스 컨트랙트 주소
const mbiAddress = '0x...'; // 2단계에서 배포된 컨트랙트 주소

// 1 WBTC와 10 WETH를 예치한다고 가정 (비율에 맞춰 계산 필요)
const amountsToDeposit = [
    { token: 'WBTC', amount: '100000000' }, // 1 WBTC (8 decimals)
    { token: 'WETH', amount: '10000000000000000000' } // 10 WETH (18 decimals)
];

const tx = await sdk.mint(mbiAddress, amountsToDeposit);
console.log('Minting MBI tokens...');

await tx.wait();
console.log('Successfully minted MBI tokens!');
```

## 4단계: 생성된 인덱스 확인

이제 당신은 MBI 토큰을 보유하게 되었습니다. 이 토큰은 WBTC와 WETH의 가치를 50:50으로 추종하는 인덱스 자산입니다. 당신의 지갑이나 HyperIndex 대시보드에서 보유 현황과 실시간 가치를 확인할 수 있습니다.

축하합니다! 첫 번째 인덱스 생성을 완료했습니다.