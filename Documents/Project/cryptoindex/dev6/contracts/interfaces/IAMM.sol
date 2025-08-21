// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IAMM
 * @dev Interface for Automated Market Maker integration
 * @notice Handles AMM liquidity, swaps, and pool management for index fund operations
 */
interface IAMM {
    
    // Pool Information Structure
    struct PoolInfo {
        address tokenA;           // First token in the pair
        address tokenB;           // Second token in the pair
        uint256 reserveA;         // Reserve of token A
        uint256 reserveB;         // Reserve of token B
        uint256 liquidity;        // Total liquidity tokens
        uint256 fee;              // Pool fee (basis points)
        bool isActive;            // Whether pool is active
        uint256 lastUpdate;       // Last update timestamp
    }
    
    // Quote Information
    struct QuoteInfo {
        uint256 amountOut;        // Expected output amount
        uint256 priceImpact;      // Price impact (basis points)
        uint256 minAmountOut;     // Minimum output after slippage
        uint256 fee;              // Total fees
        address[] path;           // Swap path
        uint256 deadline;         // Quote validity deadline
    }
    
    // Liquidity Position
    struct LiquidityPosition {
        uint256 positionId;       // Unique position identifier
        address owner;            // Position owner
        address tokenA;           // First token
        address tokenB;           // Second token
        uint256 amountA;          // Amount of token A
        uint256 amountB;          // Amount of token B
        uint256 liquidity;        // Liquidity tokens owned
        uint256 feesEarnedA;      // Unclaimed fees in token A
        uint256 feesEarnedB;      // Unclaimed fees in token B
        uint256 createdAt;        // Position creation time
    }
    
    /**
     * @dev Get quote for token swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param slippageTolerance Maximum acceptable slippage (basis points)
     * @return quote Detailed quote information
     */
    function getQuote(
        address tokenIn,
        address tokenOut, 
        uint256 amountIn,
        uint256 slippageTolerance
    ) external view returns (QuoteInfo memory quote);
    
    /**
     * @dev Execute token swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum acceptable output amount
     * @param recipient Address to receive output tokens
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount received
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
     * @dev Execute multi-hop swap through optimal path
     * @param path Array of token addresses for the swap path
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum acceptable final output
     * @param recipient Address to receive output tokens
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step in the path
     */
    function swapExactTokensForTokens(
        address[] memory path,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @dev Add liquidity to a pool
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param amountADesired Desired amount of token A
     * @param amountBDesired Desired amount of token B
     * @param amountAMin Minimum amount of token A
     * @param amountBMin Minimum amount of token B
     * @param recipient Address to receive liquidity tokens
     * @param deadline Transaction deadline
     * @return amountA Actual amount of token A added
     * @return amountB Actual amount of token B added
     * @return liquidity Amount of liquidity tokens minted
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    /**
     * @dev Remove liquidity from a pool
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param liquidity Amount of liquidity tokens to burn
     * @param amountAMin Minimum amount of token A to receive
     * @param amountBMin Minimum amount of token B to receive
     * @param recipient Address to receive tokens
     * @param deadline Transaction deadline
     * @return amountA Amount of token A received
     * @return amountB Amount of token B received
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
    
    /**
     * @dev Get pool information
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return poolInfo Pool information structure
     */
    function getPoolInfo(address tokenA, address tokenB) 
        external view returns (PoolInfo memory poolInfo);
    
    /**
     * @dev Get current price from AMM pool
     * @param tokenA First token address (numerator)
     * @param tokenB Second token address (denominator)
     * @return price Price of tokenA in terms of tokenB (scaled by 1e18)
     */
    function getPrice(address tokenA, address tokenB) 
        external view returns (uint256 price);
    
    /**
     * @dev Get available liquidity for a token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return liquidityA Available liquidity of token A
     * @return liquidityB Available liquidity of token B
     */
    function getLiquidity(address tokenA, address tokenB) 
        external view returns (uint256 liquidityA, uint256 liquidityB);
    
    /**
     * @dev Calculate price impact for a trade
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return priceImpact Price impact in basis points
     */
    function calculatePriceImpact(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 priceImpact);
    
    /**
     * @dev Get optimal swap path between two tokens
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return path Optimal path for the swap
     * @return expectedOut Expected output amount
     */
    function getOptimalPath(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (address[] memory path, uint256 expectedOut);
    
    /**
     * @dev Check if a pool exists and is active
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return exists Whether the pool exists
     * @return isActive Whether the pool is active
     */
    function poolExists(address tokenA, address tokenB) 
        external view returns (bool exists, bool isActive);
    
    // Events
    event Swap(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );
    
    event LiquidityAdded(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        address indexed provider
    );
    
    event LiquidityRemoved(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        address indexed provider
    );
    
    event PoolCreated(
        address indexed tokenA,
        address indexed tokenB,
        address poolAddress,
        uint256 fee
    );
}