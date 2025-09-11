# SDK 설치 및 설정

HyperIndex는 개발자들이 프로토콜과 쉽게 상호작용할 수 있도록 JavaScript/TypeScript SDK를 제공합니다. 또한, 다른 언어 환경의 개발자를 위해 REST API 엔드포인트 사용 예시도 함께 안내합니다.

## JavaScript/TypeScript SDK

### 설치

`npm` 또는 `yarn`을 사용하여 SDK를 설치합니다.

```bash
npm install hyperindex-sdk
```

```bash
yarn add hyperindex-sdk
```

### 기본 사용법

Ethers.js와 같은 라이브러리의 `provider` 또는 `signer`를 사용하여 SDK를 초기화합니다.

```javascript
import { HyperIndexSDK } from 'hyperindex-sdk';
import { ethers } from 'ethers';

// Infura, Alchemy 등 RPC 프로바이더 또는 지갑 프로바이더 사용
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/YOUR_INFURA_ID');

// 읽기 전용 SDK 초기화
const sdk = new HyperIndexSDK(provider);

async function getIndexValue() {
  const indexAddress = '0x...'; // 조회할 인덱스 주소
  const value = await sdk.getIndexValue(indexAddress);
  console.log('Current Index Value:', value);
}

getIndexValue();
```

---

## Python (REST API 예시)

Python 환경에서는 `requests` 라이브러리를 사용하여 REST API를 직접 호출할 수 있습니다.

### 설치

```bash
pip install requests
```

### Minimal Example

다음은 특정 인덱스의 정보를 조회하는 간단한 Python 예제입니다.

```python
import requests

# HyperIndex API 엔드포인트
API_BASE_URL = "https://api.hyperindex.finance/v1"

def get_index_details(index_symbol: str):
    """특정 심볼을 가진 인덱스의 상세 정보를 조회합니다."""
    try:
        response = requests.get(f"{API_BASE_URL}/indexes/{index_symbol}")
        response.raise_for_status()  # 200 OK가 아니면 에러 발생

        index_data = response.json()
        print(f"Index: {index_data.get('name')}")
        print(f"Symbol: {index_data.get('symbol')}")
        print(f"Current Price: ${index_data.get('price')}")
        print("--- Assets ---")
        for asset in index_data.get('assets', []):
            print(f"- {asset.get('symbol')}: {asset.get('weight')}%")

    except requests.exceptions.HTTPError as err:
        print(f"API Error: {err}")
    except requests.exceptions.RequestException as err:
        print(f"Request Error: {err}")

if __name__ == "__main__":
    get_index_details("MBI") # My Bluechip Index 조회

```

---

## cURL (REST API 예시)

터미널에서 `cURL`을 사용하여 API를 테스트해볼 수 있습니다.

### 모든 인덱스 목록 조회

```bash
curl -X GET https://api.hyperindex.finance/v1/indexes
```

### 특정 인덱스 상세 조회 (MBI)

```bash
curl -X GET https://api.hyperindex.finance/v1/indexes/MBI
```

### 특정 지갑의 인덱스 보유량 조회

```bash
curl -X GET https://api.hyperindex.finance/v1/balances/0xYourWalletAddress
```