// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title I1inchAggregatorV5
 * @dev Interface for 1inch Aggregator V5
 */
interface I1inchAggregatorV5 {
    struct SwapDescription {
        address srcToken;
        address dstToken;
        address payable srcReceiver;
        address payable dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }
    
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);
    
    function unoswap(
        address srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);
    
    function unoswapTo(
        address recipient,
        address srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);
    
    function uniswapV3Swap(
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);
    
    function clipperSwap(
        address clipperExchange,
        address srcToken,
        address dstToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 goodUntil,
        bytes32 r,
        bytes32 vs
    ) external payable returns (uint256 returnAmount);
}

/**
 * @title I1inchSpotPriceAggregator
 * @dev Interface for 1inch Spot Price Aggregator
 */
interface I1inchSpotPriceAggregator {
    function getRateToEth(
        address token,
        bool useSrcWrappers
    ) external view returns (uint256 weightedRate);
    
    function getRateToEthWithCustomConnectors(
        address token,
        bool useSrcWrappers,
        address[] calldata customConnectors,
        uint256 thresholdFilter
    ) external view returns (uint256 weightedRate);
    
    function getRate(
        address srcToken,
        address dstToken,
        bool useWrappers
    ) external view returns (uint256 weightedRate);
    
    function getRateWithCustomConnectors(
        address srcToken,
        address dstToken,
        bool useWrappers,
        address[] calldata customConnectors,
        uint256 thresholdFilter
    ) external view returns (uint256 weightedRate);
}

/**
 * @title I1inchPathFinder
 * @dev Advanced routing for optimal swap paths
 */
interface I1inchPathFinder {
    struct Route {
        address[] tokens;
        uint256[] pools;
        uint256[] amounts;
        uint256 gasEstimate;
    }
    
    function findBestPath(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 parts,
        uint256 flags
    ) external view returns (Route memory);
    
    function getExpectedReturn(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 parts,
        uint256 flags
    ) external view returns (
        uint256 returnAmount,
        uint256[] memory distribution
    );
}
