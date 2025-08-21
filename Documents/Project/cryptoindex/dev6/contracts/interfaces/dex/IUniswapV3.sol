// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IUniswapV3Router
 * @dev Interface for Uniswap V3 Router
 */
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }
    
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    
    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) 
        external 
        payable 
        returns (uint256 amountOut);
    
    function exactOutputSingle(ExactOutputSingleParams calldata params) 
        external 
        payable 
        returns (uint256 amountIn);
    
    function exactInput(ExactInputParams calldata params) 
        external 
        payable 
        returns (uint256 amountOut);
    
    function exactOutput(ExactOutputParams calldata params) 
        external 
        payable 
        returns (uint256 amountIn);
}

/**
 * @title IUniswapV3Factory
 * @dev Interface for Uniswap V3 Factory
 */
interface IUniswapV3Factory {
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);
    
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool);
}

/**
 * @title IUniswapV3Pool
 * @dev Interface for Uniswap V3 Pool
 */
interface IUniswapV3Pool {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
    
    function liquidity() external view returns (uint128);
    
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
    
    function observations(uint256 index)
        external
        view
        returns (
            uint32 blockTimestamp,
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulativeX128,
            bool initialized
        );
    
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

/**
 * @title IQuoter
 * @dev Interface for Uniswap V3 Quoter
 */
interface IQuoterV2 {
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }
    
    struct QuoteExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amount;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }
    
    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
        external
        returns (
            uint256 amountOut,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        );
    
    function quoteExactOutputSingle(QuoteExactOutputSingleParams memory params)
        external
        returns (
            uint256 amountIn,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        );
}
