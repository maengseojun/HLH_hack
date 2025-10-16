// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMultiChainAggregator
 * @notice Interface for Multi-Chain Aggregator
 * @dev Handles cross-chain operations and liquidity aggregation
 */
interface IMultiChainAggregator {
    /**
     * @notice Chain information
     */
    struct ChainInfo {
        uint256 chainId;
        string name;
        bool isActive;
        address bridgeContract;
        uint256 minBridgeAmount;
        uint256 maxBridgeAmount;
        uint256 estimatedBridgeTime;  // In seconds
    }
    
    /**
     * @notice Cross-chain swap route
     */
    struct CrossChainRoute {
        uint256 sourceChain;
        uint256 destinationChain;
        address[] tokens;
        uint256[] amounts;
        uint256 estimatedTime;
        uint256 estimatedCost;
        address bridgeUsed;
    }
    
    /**
     * @notice Bridge operation
     */
    struct BridgeOperation {
        uint256 id;
        uint256 sourceChain;
        uint256 destinationChain;
        address tokenAddress;
        uint256 amount;
        address sender;
        address recipient;
        uint256 timestamp;
        bool completed;
        bytes32 txHash;
    }
    
    /**
     * @notice Events
     */
    event CrossChainSwapInitiated(
        uint256 indexed operationId,
        uint256 sourceChain,
        uint256 destinationChain,
        address tokenIn,
        uint256 amountIn
    );
    
    event CrossChainSwapCompleted(
        uint256 indexed operationId,
        uint256 amountOut,
        address recipient
    );
    
    event BridgeOperationStarted(
        uint256 indexed operationId,
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 amount
    );
    
    event BridgeOperationCompleted(
        uint256 indexed operationId,
        bytes32 txHash
    );
    
    /**
     * @notice Get optimal cross-chain route
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @return route Optimal cross-chain route
     * @return estimatedOut Expected output amount
     */
    function getOptimalCrossChainRoute(
        uint256 sourceChain,
        uint256 destinationChain,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (
        CrossChainRoute memory route,
        uint256 estimatedOut
    );
    
    /**
     * @notice Execute cross-chain swap
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param minAmountOut Minimum acceptable output
     * @param recipient Recipient address
     * @param deadline Execution deadline
     * @return operationId Operation identifier
     */
    function executeCrossChainSwap(
        uint256 sourceChain,
        uint256 destinationChain,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 operationId);
    
    /**
     * @notice Get supported chains
     * @return chains Array of supported chain information
     */
    function getSupportedChains() 
        external 
        view 
        returns (ChainInfo[] memory chains);
    
    /**
     * @notice Check if chain is supported
     * @param chainId Chain ID to check
     * @return supported True if supported
     */
    function isChainSupported(uint256 chainId) 
        external 
        view 
        returns (bool supported);
    
    /**
     * @notice Get liquidity on a specific chain
     * @param chainId Chain ID
     * @param tokenAddress Token address
     * @return liquidity Available liquidity
     */
    function getChainLiquidity(
        uint256 chainId,
        address tokenAddress
    ) external view returns (uint256 liquidity);
    
    /**
     * @notice Get bridge operation status
     * @param operationId Operation identifier
     * @return operation Bridge operation details
     */
    function getBridgeOperation(uint256 operationId)
        external
        view
        returns (BridgeOperation memory operation);
    
    /**
     * @notice Estimate cross-chain swap cost
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param amountIn Input amount
     * @return estimatedCost Total cost including fees
     * @return bridgeFee Bridge fee
     * @return gasCost Estimated gas cost
     */
    function estimateCrossChainCost(
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 amountIn
    ) external view returns (
        uint256 estimatedCost,
        uint256 bridgeFee,
        uint256 gasCost
    );
    
    /**
     * @notice Add supported chain (admin only)
     * @param chainInfo Chain information to add
     */
    function addSupportedChain(ChainInfo memory chainInfo) external;
    
    /**
     * @notice Remove supported chain (admin only)
     * @param chainId Chain ID to remove
     */
    function removeSupportedChain(uint256 chainId) external;
    
    /**
     * @notice Set bridge contract for chain (admin only)
     * @param chainId Chain ID
     * @param bridgeContract Bridge contract address
     */
    function setBridgeContract(
        uint256 chainId,
        address bridgeContract
    ) external;
    
    /**
     * @notice Emergency withdraw stuck funds (admin only)
     * @param tokenAddress Token address
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function emergencyWithdraw(
        address tokenAddress,
        uint256 amount,
        address recipient
    ) external;
}
