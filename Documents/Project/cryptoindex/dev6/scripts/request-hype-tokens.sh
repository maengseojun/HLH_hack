#!/bin/bash

# HyperEVM 테스트넷 토큰 자동 요청 스크립트
ADDRESS="0x81Bf724a8101EC81540fA841fD1E68076A8101cd"

echo "🪙 HyperEVM 테스트넷 토큰 요청 중..."
echo "주소: $ADDRESS"

# HyperEVM Faucet 요청
curl -X POST "https://faucet.hyperliquid-testnet.xyz/request" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"$ADDRESS\"}"

echo ""
echo "✅ HyperEVM 테스트넷 토큰 요청 완료"
echo "📊 잔액 확인: cast balance $ADDRESS --rpc-url https://rpc.hyperliquid-testnet.xyz/evm"
echo "⏰ 토큰이 도착하는데 몇 분이 걸릴 수 있습니다."
