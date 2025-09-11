# 에러 핸들링

HyperIndex API 및 SDK 사용 중 발생할 수 있는 주요 에러 코드와 그 의미, 그리고 대응 방안을 안내합니다. 안정적인 애플리케이션 개발을 위해 각 에러 상황에 대한 처리를 구현하는 것이 중요합니다.

## 에러 응답 형식

REST API 호출 실패 시, HTTP 상태 코드와 함께 아래와 같은 형식의 JSON 응답이 반환됩니다.

```json
{
  "error": {
    "code": "INSUFFICIENT_LIQUIDITY",
    "message": "The requested trade size exceeds available liquidity."
  }
}
```

## 일반적인 에러 코드

| HTTP 상태 | 에러 코드 | 의미 | 해결 방안 |
| :--- | :--- | :--- | :--- |
| 400 Bad Request | `INVALID_PARAMETER` | 요청 파라미터가 잘못되었거나 누락됨 | API 명세를 다시 확인하고, 파라미터의 타입과 형식을 맞춰 재요청하세요. |
| 400 Bad Request | `SLIPPAGE_EXCEEDED` | 현재 시장 가격 변동으로 인해 설정된 슬리피지 허용치를 초과함 | 슬리피지 설정을 높이거나, 잠시 후 변동성이 줄어들었을 때 다시 시도하세요. |
| 400 Bad Request | `INSUFFICIENT_FUNDS` | 요청을 처리하기에 계정 잔고가 부족함 | 지갑의 토큰 잔고를 확인하고, 필요한 만큼 충전 후 다시 시도하세요. |
| 401 Unauthorized | `INVALID_API_KEY` | API 키가 유효하지 않거나 존재하지 않음 | API 키가 올바르게 입력되었는지, 만료되지 않았는지 확인하세요. |
| 403 Forbidden | `PERMISSION_DENIED` | 해당 리소스에 접근할 권한이 없음 | 인증 정보나 요청 권한을 확인하세요. |
| 404 Not Found | `NOT_FOUND` | 요청한 리소스(예: 인덱스, 사용자)를 찾을 수 없음 | 요청한 ID나 심볼이 올바른지 확인하세요. |
| 429 Too Many Requests | `RATE_LIMIT_EXCEEDED` | 단기간에 너무 많은 요청을 보냄 | 요청 빈도를 줄이거나, 잠시 후 다시 시도하세요. API 속도 제한 정책을 확인하세요. |
| 500 Internal Server Error | `INTERNAL_SERVER_ERROR` | 서버 내부에서 예상치 못한 오류 발생 | HyperIndex 팀에 문의하세요. 에러 발생 시간, 요청 정보 등을 함께 전달하면 빠른 해결에 도움이 됩니다. |

## 스마트 컨트랙트 관련 에러

| 에러 코드 | 의미 | 해결 방안 |
| :--- | :--- | :--- |
| `INSUFFICIENT_LIQUIDITY` | 스왑 또는 인출 시 유동성이 부족함 | 더 적은 금액으로 재시도하거나, 다른 풀을 이용하거나, 유동성이 충분해질 때까지 기다리세요. |
| `EXECUTION_REVERTED` | 트랜잭션이 스마트 컨트랙트 레벨에서 실패함 | 가스비 부족, 컨트랙트 제약 조건 위반 등 다양한 원인이 있을 수 있습니다. 트랜잭션 실패 로그를 분석하거나, Etherscan 등에서 실패 원인을 확인하세요. |
| `TRANSFER_FAILED` | ERC20 토큰 전송에 실패함 | 해당 토큰 컨트랙트가 일시 중지되었거나, 블랙리스트에 오른 주소는 아닌지 확인하세요. |

## SDK 에러 처리 예시

SDK는 에러 발생 시 상세 정보가 담긴 객체를 `throw`합니다. `try...catch` 구문을 사용하여 에러를 처리할 수 있습니다.

```javascript
try {
  const tx = await sdk.createIndex(indexName, indexSymbol, invalidAssets);
  await tx.wait();
} catch (error) {
  console.error('Error Code:', error.code); // e.g., 'INVALID_PARAMETER'
  console.error('Message:', error.message);

  if (error.code === 'SLIPPAGE_EXCEEDED') {
    // 슬리피지 초과 시 사용자에게 알림 및 재시도 옵션 제공
    alert('Price has changed. Please try again.');
  } else {
    // 기타 에러 처리
  }
}
```