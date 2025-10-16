// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAMM
 * @notice Interface for AMM (Automated Market Maker)
 * @dev Provides liquidity and swap functionality
 */
interface IAMM {
    /**
     * @notice Swap information structure
     */
    struct SwapInfo {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 priceImpact;      // In basis points
        uint256[] route;          // Path of token addresses
        uint256 estimatedGas;
    }
    
    /**
     * @notice Get quote for a swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return amountOut Expected output amount
     * @return priceImpact Price impact in basis points
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 priceImpact);
    
    /**
     * @notice Get optimal swap route
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return route Array of token addresses in the route
     * @return expectedOut Expected output amount
     */
    function getOptimalRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (address[] memory route, uint256 expectedOut);
    
    /**
     * @notice Execute a swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum acceptable output
     * @param recipient Address to receive output tokens
     * @param deadline Execution deadline
     * @return amountOut Actual output amount
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut);
    
    /**
     * @notice Execute multi-hop swap
     * @param route Array of token addresses
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum acceptable output
     * @param recipient Address to receive output tokens
     * @param deadline Execution deadline
     * @return amounts Array of amounts for each hop
     */
    function swapExactTokensForTokens(
        address[] calldata route,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @notice Get liquidity for a token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return reserveA Reserve of tokenA
     * @return reserveB Reserve of tokenB
     * @return totalLiquidity Total liquidity in USD
     */
    function getLiquidity(
        address tokenA,
        address tokenB
    ) external view returns (
        uint256 reserveA,
        uint256 reserveB,
        uint256 totalLiquidity
    );
    
    /**
     * @notice Check if pair exists
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return exists True if pair exists
     * @return pairAddress Address of the pair
     */
    function pairExists(
        address tokenA,
        address tokenB
    ) external view returns (bool exists, address pairAddress);
}
