// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IDEXAggregator
 * @dev Interface for DEX aggregator functionality (inspired by 1inch)
 * @notice Provides quote and swap functionality for multiple DEX integration
 */
interface IDEXAggregator {
    
    struct SwapParams {
        address srcToken;          // Source token address
        address destToken;         // Destination token address
        uint256 amount;            // Amount to swap
        uint256 minReturn;         // Minimum return amount
        uint256[] distribution;    // Distribution across DEXes
        uint256 flags;             // Swap flags
    }
    
    struct QuoteResult {
        uint256 returnAmount;      // Expected return amount
        uint256[] distribution;    // Optimal distribution
        uint256 estimatedGas;      // Estimated gas cost
        string[] protocols;        // Protocols used
    }
    
    struct SwapResult {
        uint256 returnAmount;      // Actual return amount
        uint256 spentAmount;       // Actual spent amount
        uint256 gasUsed;           // Gas used for swap
        string protocol;           // Main protocol used
    }
    
    /**
     * @dev Get quote for token swap
     * @param srcToken Source token address
     * @param destToken Destination token address
     * @param amount Amount to swap
     * @return result Quote result with expected return and distribution
     */
    function getQuote(
        address srcToken,
        address destToken,
        uint256 amount
    ) external view returns (QuoteResult memory result);
    
    /**
     * @dev Execute token swap
     * @param params Swap parameters
     * @return result Swap result with actual amounts
     */
    function swap(
        SwapParams calldata params
    ) external payable returns (SwapResult memory result);
    
    /**
     * @dev Get supported tokens for swapping
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory tokens);
    
    /**
     * @dev Check if token pair is supported
     * @param tokenA First token
     * @param tokenB Second token
     * @return supported Whether the pair is supported
     */
    function isPairSupported(address tokenA, address tokenB) external view returns (bool supported);
    
    /**
     * @dev Get available protocols/DEXes
     * @return protocols Array of protocol names
     */
    function getProtocols() external view returns (string[] memory protocols);
    
    /**
     * @dev Get exchange rate between two tokens
     * @param srcToken Source token
     * @param destToken Destination token
     * @param amount Amount to check rate for
     * @return rate Exchange rate (dest token per src token)
     */
    function getExchangeRate(
        address srcToken,
        address destToken,
        uint256 amount
    ) external view returns (uint256 rate);
    
    // Events
    event SwapExecuted(
        address indexed srcToken,
        address indexed destToken,
        address indexed sender,
        uint256 srcAmount,
        uint256 destAmount,
        string protocol
    );
    
    event QuoteRequested(
        address indexed srcToken,
        address indexed destToken,
        uint256 amount,
        uint256 returnAmount
    );
    
    event ProtocolAdded(string protocolName);
    event ProtocolRemoved(string protocolName);
}