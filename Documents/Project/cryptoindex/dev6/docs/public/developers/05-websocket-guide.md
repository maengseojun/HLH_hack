# 웹소켓 가이드

HyperIndex는 실시간 데이터 스트리밍을 위해 웹소켓 API를 제공합니다. 웹소켓을 통해 인덱스 가격, 오더북, 체결 내역 등의 정보를 지연 없이 받아볼 수 있습니다.

## 연결 (Connection)

웹소켓 서버 주소는 다음과 같습니다.

`wss://ws.hyperindex.finance/v1`

### JavaScript 예시

```javascript
const socket = new WebSocket('wss://ws.hyperindex.finance/v1');

socket.onopen = () => {
  console.log('WebSocket connection established.');
  // 연결 성공 후 채널 구독 메시지 전송
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received data:', data);
  // 수신된 데이터 처리 로직
};

socket.onclose = (event) => {
  console.log('WebSocket connection closed:', event);
  // 재연결 로직 구현
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

## 구독 채널 (Channels)

연결이 성공하면, `subscribe` 메시지를 보내 원하는 채널의 데이터를 구독할 수 있습니다.

### 구독 메시지 형식

```json
{
  "action": "subscribe",
  "channels": [
    { "name": "price", "symbols": ["MBI", "DEFI_TOP5"] },
    { "name": "trades", "symbols": ["MBI"] }
  ]
}
```

### 구독 취소

```json
{
  "action": "unsubscribe",
  "channels": [
    { "name": "price", "symbols": ["DEFI_TOP5"] }
  ]
}
```

### 사용 가능한 채널

| 채널 이름 | 설명 | 파라미터 | 수신 데이터 예시 |
| :--- | :--- | :--- | :--- |
| `price` | 특정 인덱스의 실시간 가격 정보 | `symbols`: 인덱스 심볼 배열 | `{"channel":"price","symbol":"MBI","price":"1234.56","timestamp":...}` |
| `orderbook` | 특정 인덱스의 오더북 (L2) | `symbols`: 인덱스 심볼 배열 | `{"channel":"orderbook","symbol":"MBI","bids":[...],"asks":[...],"timestamp":...}` |
| `trades` | 특정 인덱스의 실시간 체결 내역 | `symbols`: 인덱스 심볼 배열 | `{"channel":"trades","symbol":"MBI","price":"1235.01","amount":"10.5","side":"buy",...}` |

## 인증 (Authentication)

일부 프라이빗 채널(예: 내 주문, 내 잔고)을 구독하기 위해서는 API 키를 사용한 인증이 필요합니다.

1.  연결 시 헤더 또는 파라미터에 API 키를 전송합니다.
2.  인증 성공 후, 프라이빗 채널 구독 메시지를 보냅니다.

(상세 인증 방식은 추후 업데이트 예정)

## 재연결 로직 (Reconnection)

네트워크 문제나 서버 점검으로 인해 웹소켓 연결이 끊어질 수 있습니다. 안정적인 데이터 수신을 위해 클라이언트 측에서 아래와 같은 재연결 로직을 구현하는 것을 권장합니다.

-   `onclose` 이벤트 감지
-   Exponential backoff 알고리즘을 사용한 재연결 시도 (예: 1초, 2초, 4초, 8초... 간격)
-   재연결 성공 시, 이전에 구독했던 채널들을 다시 구독