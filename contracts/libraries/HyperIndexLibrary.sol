// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/amm/IHyperIndexPair.sol";
import "../interfaces/amm/IHyperIndexFactory.sol";

/**
 * @title HyperIndexLibrary
 * @notice Library containing helper functions for HyperIndex AMM
 * @dev Provides functions for price calculations, routing, and pair operations
 */
library HyperIndexLibrary {
    /**
     * @notice Sort two token addresses
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return token0 Lower address
     * @return token1 Higher address
     */
    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "HyperIndexLibrary: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "HyperIndexLibrary: ZERO_ADDRESS");
    }

    /**
     * @notice Calculate pair address using CREATE2
     * @param factory Factory address
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return pair Deterministic pair address
     */
    function pairFor(
        address factory,
        address tokenA,
        address tokenB
    ) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex"ff",
                            factory,
                            keccak256(abi.encodePacked(token0, token1)),
                            IHyperIndexFactory(factory).PAIR_CODE_HASH()
                        )
                    )
                )
            )
        );
    }

    /**
     * @notice Get reserves for a token pair
     * @param factory Factory address
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return reserveA Reserve of tokenA
     * @return reserveB Reserve of tokenB
     */
    function getReserves(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0, ) = sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1, ) = IHyperIndexPair(
            pairFor(factory, tokenA, tokenB)
        ).getReserves();
        (reserveA, reserveB) = tokenA == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }

    /**
     * @notice Calculate quote for exact input
     * @param amountA Amount of tokenA
     * @param reserveA Reserve of tokenA
     * @param reserveB Reserve of tokenB
     * @return amountB Equivalent amount of tokenB
     */
    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 amountB) {
        require(amountA > 0, "HyperIndexLibrary: INSUFFICIENT_AMOUNT");
        require(
            reserveA > 0 && reserveB > 0,
            "HyperIndexLibrary: INSUFFICIENT_LIQUIDITY"
        );
        amountB = (amountA * reserveB) / reserveA;
    }

    /**
     * @notice Calculate output amount given input amount
     * @dev Applies 0.3% fee
     * @param amountIn Input amount
     * @param reserveIn Input token reserve
     * @param reserveOut Output token reserve
     * @return amountOut Output amount
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "HyperIndexLibrary: INSUFFICIENT_INPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "HyperIndexLibrary: INSUFFICIENT_LIQUIDITY"
        );
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @notice Calculate input amount given output amount
     * @dev Applies 0.3% fee
     * @param amountOut Desired output amount
     * @param reserveIn Input token reserve
     * @param reserveOut Output token reserve
     * @return amountIn Required input amount
     */
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "HyperIndexLibrary: INSUFFICIENT_OUTPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "HyperIndexLibrary: INSUFFICIENT_LIQUIDITY"
        );
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1;
    }

    /**
     * @notice Calculate output amounts for multi-hop swap
     * @param factory Factory address
     * @param amountIn Input amount
     * @param path Array of token addresses
     * @return amounts Array of output amounts for each hop
     */
    function getAmountsOut(
        address factory,
        uint256 amountIn,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, "HyperIndexLibrary: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(
                factory,
                path[i],
                path[i + 1]
            );
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    /**
     * @notice Calculate input amounts for multi-hop swap
     * @param factory Factory address
     * @param amountOut Desired output amount
     * @param path Array of token addresses
     * @return amounts Array of input amounts for each hop
     */
    function getAmountsIn(
        address factory,
        uint256 amountOut,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, "HyperIndexLibrary: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(
                factory,
                path[i - 1],
                path[i]
            );
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }
}
