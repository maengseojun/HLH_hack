// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../interfaces/IMultiChainAggregator.sol";

/**
 * @title MockMultiChainAggregator
 * @dev Mock implementation of IMultiChainAggregator for testing
 */
contract MockMultiChainAggregator is IMultiChainAggregator {
    
    // Mock data storage
    mapping(uint32 => uint256) public assetPrices;
    mapping(uint32 => uint256) public assetLiquidity;
    mapping(uint32 => mapping(uint256 => address)) public tokenAddresses;
    mapping(uint256 => ChainInfo) public chains;
    
    uint256[] public supportedChainIds;
    uint32[] public supportedAssets;

    constructor() {
        // Initialize mock chains
        chains[1] = ChainInfo({
            chainId: 1,
            name: "Ethereum",
            isActive: true,
            bridgeFee: 0.001 ether,
            gasPrice: 20 gwei,
            blockTime: 12,
            bridgeContract: address(0x123),
            lastUpdate: block.timestamp
        });
        
        chains[137] = ChainInfo({
            chainId: 137,
            name: "Polygon",
            isActive: true,
            bridgeFee: 0.0001 ether,
            gasPrice: 30 gwei,
            blockTime: 2,
            bridgeContract: address(0x456),
            lastUpdate: block.timestamp
        });
        
        chains[42161] = ChainInfo({
            chainId: 42161,
            name: "Arbitrum",
            isActive: true,
            bridgeFee: 0.0005 ether,
            gasPrice: 0.1 gwei,
            blockTime: 1,
            bridgeContract: address(0x789),
            lastUpdate: block.timestamp
        });
        
        // Add HyperEVM testnet chain
        chains[998] = ChainInfo({
            chainId: 998,
            name: "HyperEVM",
            isActive: true,
            bridgeFee: 0.0001 ether,
            gasPrice: 0.1 gwei,
            blockTime: 1,
            bridgeContract: address(0xABC),
            lastUpdate: block.timestamp
        });
        
        supportedChainIds = [1, 137, 42161, 998]; // 4개 체인으로 증가

        // Initialize mock assets
        assetPrices[0] = 2000e18; // ETH: $2000
        assetPrices[1] = 50000e18; // BTC: $50000
        assetPrices[2] = 100e18; // SOL: $100
        assetPrices[3] = 1e18; // USDC: $1
        assetPrices[4] = 1.5e18; // HYPE: $1.5
        
        assetLiquidity[0] = 1000000e18; // 1M ETH equivalent
        assetLiquidity[1] = 50000e18; // 50K BTC equivalent
        assetLiquidity[2] = 5000000e18; // 5M SOL equivalent
        assetLiquidity[3] = 100000000e18; // 100M USDC
        assetLiquidity[4] = 10000000e18; // 10M HYPE
        
        supportedAssets = [0, 1, 2, 3, 4];
        
        // Mock token addresses
        tokenAddresses[0][1] = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // WETH on Ethereum
        tokenAddresses[1][1] = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599; // WBTC on Ethereum
        tokenAddresses[3][1] = 0xA0B86a33e6417c5a4dC7c2C4a8b86A3cc7dC1A9C; // USDC on Ethereum
    }

    function getAggregatedPrice(uint32 assetIndex) 
        external 
        view 
        override 
        returns (AggregatedPrice memory aggregatedPrice) 
    {
        uint256 price = assetPrices[assetIndex];
        uint256 liquidity = assetLiquidity[assetIndex];
        
        // Oracle 보안: 최소 데이터 소스 정책 (3개 이상 소스 필수)
        uint256 activeDataSources = supportedChainIds.length;
        require(activeDataSources >= 3, "Insufficient data sources - minimum 3 required");
        
        uint256[] memory chainPrices = new uint256[](supportedChainIds.length);
        uint256[] memory chainLiquidity = new uint256[](supportedChainIds.length);
        
        for (uint i = 0; i < supportedChainIds.length; i++) {
            chainPrices[i] = price + (i * price / 100); // Add small variance per chain
            chainLiquidity[i] = liquidity / supportedChainIds.length;
        }
        
        aggregatedPrice = AggregatedPrice({
            assetIndex: assetIndex,
            weightedPrice: price,
            bestPrice: price - (price / 100), // 1% better
            worstPrice: price + (price / 100), // 1% worse
            totalLiquidity: liquidity,
            priceVariance: price / 50, // 2% variance
            chainPrices: chainPrices,
            chainLiquidity: chainLiquidity,
            timestamp: block.timestamp
        });
    }

    function getBestRoute(
        uint32 assetIndex,
        uint256 amount,
        uint256 sourceChain,
        uint256 targetChain
    ) external view override returns (LiquidityRoute memory route) {
        // Return mock optimal route
        route = LiquidityRoute({
            sourceChain: sourceChain == 0 ? 1 : sourceChain,
            targetChain: targetChain == 0 ? 137 : targetChain,
            sourceToken: tokenAddresses[assetIndex][sourceChain == 0 ? 1 : sourceChain],
            targetToken: tokenAddresses[assetIndex][targetChain == 0 ? 137 : targetChain],
            amount: amount,
            bridgeFee: chains[targetChain == 0 ? 137 : targetChain].bridgeFee,
            gasCost: 0.01 ether, // Mock gas cost
            timeEstimate: 300, // 5 minutes
            priceImpact: amount > 1000000e18 ? 100 : 50, // Higher impact for larger trades
            intermediates: new address[](0),
            routeData: ""
        });
    }

    function acquireAsset(
        uint32 assetIndex,
        uint256 amount,
        uint256 maxSlippage,
        uint256 targetChain,
        address recipient
    ) external override returns (
        uint256 executedAmount,
        uint256 totalCost,
        uint256 executionChain
    ) {
        // Mock execution
        executedAmount = amount * 995 / 1000; // 0.5% slippage
        totalCost = amount * assetPrices[assetIndex] / 1e18;
        executionChain = targetChain == 0 ? 1 : targetChain;
        
        emit AssetAcquired(assetIndex, executedAmount, totalCost, executionChain, recipient);
    }

    function liquidateAsset(
        uint32 assetIndex,
        uint256 amount,
        uint256 minReturn,
        uint256 preferredChain,
        address recipient
    ) external override returns (
        uint256 liquidatedAmount,
        uint256 totalReturn,
        uint256 liquidationChain
    ) {
        // Mock liquidation
        liquidatedAmount = amount;
        totalReturn = amount * assetPrices[assetIndex] * 995 / (1e18 * 1000); // 0.5% slippage
        liquidationChain = preferredChain == 0 ? 1 : preferredChain;
        
        emit AssetLiquidated(assetIndex, liquidatedAmount, totalReturn, liquidationChain, recipient);
    }

    function getTotalLiquidity(uint32 assetIndex) 
        external 
        view 
        override 
        returns (
            uint256 totalLiquidity,
            uint256[] memory chainDistribution
        ) 
    {
        totalLiquidity = assetLiquidity[assetIndex];
        chainDistribution = new uint256[](supportedChainIds.length);
        
        for (uint i = 0; i < supportedChainIds.length; i++) {
            chainDistribution[i] = totalLiquidity / supportedChainIds.length;
        }
    }

    function getSupportedChains() external view override returns (ChainInfo[] memory chainInfos) {
        chainInfos = new ChainInfo[](supportedChainIds.length);
        
        for (uint i = 0; i < supportedChainIds.length; i++) {
            chainInfos[i] = chains[supportedChainIds[i]];
        }
    }

    function isAssetSupportedOnChain(uint32 assetIndex, uint256 chainId) 
        external 
        view 
        override 
        returns (
            bool isSupported,
            address tokenAddress,
            uint256 currentLiquidity
        ) 
    {
        isSupported = tokenAddresses[assetIndex][chainId] != address(0);
        tokenAddress = tokenAddresses[assetIndex][chainId];
        currentLiquidity = assetLiquidity[assetIndex] / supportedChainIds.length;
    }

    function calculateOptimalDistribution(
        uint32[] memory assetIndices,
        uint256[] memory targetAmounts,
        uint256 riskTolerance
    ) external view override returns (
        uint256[][] memory distribution,
        uint256 totalCost,
        uint256 executionTime
    ) {
        // Mock optimal distribution calculation
        distribution = new uint256[][](assetIndices.length);
        totalCost = 0;
        executionTime = 600; // 10 minutes
        
        for (uint i = 0; i < assetIndices.length; i++) {
            distribution[i] = new uint256[](supportedChainIds.length);
            uint256 amountPerChain = targetAmounts[i] / supportedChainIds.length;
            
            for (uint j = 0; j < supportedChainIds.length; j++) {
                distribution[i][j] = amountPerChain;
            }
            
            totalCost += targetAmounts[i] * assetPrices[assetIndices[i]] / 1e18;
        }
    }

    function rebalanceAsset(
        uint32 assetIndex,
        uint256[] memory targetDistribution,
        uint256 maxSlippage
    ) external override returns (
        bool success,
        uint256[] memory newDistribution,
        uint256 totalCost
    ) {
        // Mock rebalancing
        success = true;
        newDistribution = targetDistribution;
        totalCost = 0.1 ether; // Mock rebalancing cost
    }

    function emergencyBridge(
        uint32 assetIndex,
        uint256 amount,
        uint256 sourceChain,
        uint256 safetyChain,
        address recipient
    ) external override returns (bool success, uint256 bridgedAmount) {
        // Mock emergency bridge
        success = true;
        bridgedAmount = amount * 98 / 100; // 2% emergency fee
        
        emit CrossChainBridge(
            assetIndex,
            bridgedAmount,
            sourceChain,
            safetyChain,
            recipient,
            keccak256(abi.encodePacked(block.timestamp, msg.sender))
        );
    }

    // Additional helper functions for testing
    function setAssetPrice(uint32 assetIndex, uint256 price) external {
        assetPrices[assetIndex] = price;
    }

    function setAssetLiquidity(uint32 assetIndex, uint256 liquidity) external {
        assetLiquidity[assetIndex] = liquidity;
    }

    function addChain(
        uint256 chainId,
        string memory name,
        uint256 bridgeFee,
        uint256 gasPrice,
        address bridgeContract
    ) external {
        chains[chainId] = ChainInfo({
            chainId: chainId,
            name: name,
            isActive: true,
            bridgeFee: bridgeFee,
            gasPrice: gasPrice,
            blockTime: 12,
            bridgeContract: bridgeContract,
            lastUpdate: block.timestamp
        });
        
        supportedChainIds.push(chainId);
        emit ChainAdded(chainId, name, true);
    }

    function setTokenAddress(uint32 assetIndex, uint256 chainId, address tokenAddress) external {
        tokenAddresses[assetIndex][chainId] = tokenAddress;
        emit AssetSupportAdded(assetIndex, chainId, tokenAddress);
    }
}