// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IHyperIndexPair.sol";
import "../interfaces/IHyperIndexFactory.sol";

/**
 * @title HyperIndexLibrary
 * @notice Library for HyperIndex AMM calculations and utilities
 * @dev OpenZeppelin v5 compatible with built-in overflow protection
 */
library HyperIndexLibrary {
    
    // Returns sorted token addresses for pair creation
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "HyperIndexLibrary: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "HyperIndexLibrary: ZERO_ADDRESS");
    }
    
    // Calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(uint160(uint256(keccak256(abi.encodePacked(
                hex"ff",
                factory,
                keccak256(abi.encodePacked(token0, token1)),
                hex"850862577798453a83a82988c33040528b3c07c908b27877fad5f2059df00c43" // init code hash
            )))));
    }
    
    // Fetches and sorts the reserves for a pair
    function getReserves(address factory, address tokenA, address tokenB) 
        internal view returns (uint256 reserveA, uint256 reserveB) 
    {
        (address token0,) = sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1,) = IHyperIndexPair(pairFor(factory, tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }
    
    // Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) internal pure returns (uint256 amountB) {
        require(amountA > 0, "HyperIndexLibrary: INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "HyperIndexLibrary: INSUFFICIENT_LIQUIDITY");
        amountB = amountA * reserveB / reserveA;
    }
    
    // Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        internal pure returns (uint256 amountOut)
    {
        require(amountIn > 0, "HyperIndexLibrary: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "HyperIndexLibrary: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    // Given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        internal pure returns (uint256 amountIn)
    {
        require(amountOut > 0, "HyperIndexLibrary: INSUFFICIENT_OUTPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "HyperIndexLibrary: INSUFFICIENT_LIQUIDITY");
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1;
    }
    
    // Performs chained getAmountOut calculations on any number of pairs
    function getAmountsOut(address factory, uint256 amountIn, address[] memory path)
        internal view returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "HyperIndexLibrary: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(factory, path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }
    
    // Performs chained getAmountIn calculations on any number of pairs
    function getAmountsIn(address factory, uint256 amountOut, address[] memory path)
        internal view returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "HyperIndexLibrary: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(factory, path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }
}