#!/bin/bash

# Foundry를 사용한 HyperEVM 배포 스크립트

echo "🔨 HyperEVM Deployment with Foundry"
echo "===================================="

# 환경 변수 설정
source .env

# RPC URL 확인
echo "RPC URL: $HYPEREVM_RPC"
echo "Deployer: $(cast wallet address $PRIVATE_KEY)"

# 잔액 확인
echo -e "\n💰 Checking balance..."
BALANCE=$(cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $HYPEREVM_RPC)
echo "Balance: $BALANCE"

# SimpleTest 컨트랙트 컴파일
echo -e "\n📝 Compiling contract..."
forge build --contracts contracts/SimpleTest.sol

# 배포 시도 1: 기본 설정
echo -e "\n🚀 Attempt 1: Default deployment..."
forge create contracts/SimpleTest.sol:SimpleTest \
  --rpc-url $HYPEREVM_RPC \
  --private-key $PRIVATE_KEY \
  --legacy \
  --gas-price 100000000 \
  --gas-limit 500000 \
  --json

# 배포 시도 2: 더 낮은 가스
echo -e "\n🚀 Attempt 2: Lower gas..."
forge create contracts/SimpleTest.sol:SimpleTest \
  --rpc-url $HYPEREVM_RPC \
  --private-key $PRIVATE_KEY \
  --legacy \
  --gas-price 1000000 \
  --gas-limit 300000 \
  --json

# 배포 시도 3: EIP-1559 방식
echo -e "\n🚀 Attempt 3: EIP-1559..."
forge create contracts/SimpleTest.sol:SimpleTest \
  --rpc-url $HYPEREVM_RPC \
  --private-key $PRIVATE_KEY \
  --priority-gas-price 1000000 \
  --gas-limit 500000 \
  --json
