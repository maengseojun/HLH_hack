// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IHyperIndexPair
 * @notice Interface for the HyperIndex Pair contract
 * @dev Uniswap V2 style AMM pair interface
 */
interface IHyperIndexPair {
    /**
     * @notice Emitted when liquidity is minted
     * @param sender Address that provided liquidity
     * @param amount0 Amount of token0 deposited
     * @param amount1 Amount of token1 deposited
     */
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    
    /**
     * @notice Emitted when liquidity is burned
     * @param sender Address that removed liquidity
     * @param amount0 Amount of token0 withdrawn
     * @param amount1 Amount of token1 withdrawn
     * @param to Address that received the tokens
     */
    event Burn(
        address indexed sender,
        uint256 amount0,
        uint256 amount1,
        address indexed to
    );
    
    /**
     * @notice Emitted when a swap occurs
     * @param sender Address that initiated the swap
     * @param amount0In Amount of token0 input
     * @param amount1In Amount of token1 input
     * @param amount0Out Amount of token0 output
     * @param amount1Out Amount of token1 output
     * @param to Address that received output tokens
     */
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    
    /**
     * @notice Emitted when reserves are updated
     * @param reserve0 Updated reserve of token0
     * @param reserve1 Updated reserve of token1
     */
    event Sync(uint112 reserve0, uint112 reserve1);
    
    /**
     * @notice Initialize the pair with two tokens
     * @param token0 Address of the first token
     * @param token1 Address of the second token
     */
    function initialize(address token0, address token1) external;
    
    /**
     * @notice Get the current reserves
     * @return reserve0 Reserve of token0
     * @return reserve1 Reserve of token1
     * @return blockTimestampLast Timestamp of last update
     */
    function getReserves() external view returns (
        uint112 reserve0,
        uint112 reserve1,
        uint32 blockTimestampLast
    );
    
    /**
     * @notice Get the factory address
     * @return Address of the factory that created this pair
     */
    function factory() external view returns (address);
    
    /**
     * @notice Get the first token address
     * @return Address of token0
     */
    function token0() external view returns (address);
    
    /**
     * @notice Get the second token address
     * @return Address of token1
     */
    function token1() external view returns (address);
    
    /**
     * @notice Get cumulative price of token0
     * @return Cumulative price (used for TWAP oracle)
     */
    function price0CumulativeLast() external view returns (uint256);
    
    /**
     * @notice Get cumulative price of token1
     * @return Cumulative price (used for TWAP oracle)
     */
    function price1CumulativeLast() external view returns (uint256);
    
    /**
     * @notice Get the last k value (reserve0 * reserve1)
     * @return Last k value
     */
    function kLast() external view returns (uint256);
    
    /**
     * @notice Mint LP tokens
     * @param to Address to receive LP tokens
     * @return liquidity Amount of LP tokens minted
     */
    function mint(address to) external returns (uint256 liquidity);
    
    /**
     * @notice Burn LP tokens
     * @param to Address to receive underlying tokens
     * @return amount0 Amount of token0 received
     * @return amount1 Amount of token1 received
     */
    function burn(address to) external returns (uint256 amount0, uint256 amount1);
    
    /**
     * @notice Swap tokens
     * @param amount0Out Amount of token0 to receive
     * @param amount1Out Amount of token1 to receive
     * @param to Address to receive output tokens
     * @param data Callback data (for flash swaps)
     */
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
    
    /**
     * @notice Force reserves to match balances
     * @param to Address to receive excess tokens
     */
    function skim(address to) external;
    
    /**
     * @notice Force reserves to match balances
     */
    function sync() external;
    
    /**
     * @notice Get the minimum liquidity
     * @return Minimum liquidity locked forever
     */
    function MINIMUM_LIQUIDITY() external pure returns (uint256);
}

/**
 * @title IHyperIndexCallee
 * @notice Interface for flash swap callbacks
 */
interface IHyperIndexCallee {
    /**
     * @notice Callback for flash swaps
     * @param sender Address that initiated the swap
     * @param amount0 Amount of token0
     * @param amount1 Amount of token1
     * @param data Arbitrary callback data
     */
    function hyperIndexCall(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}
