// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MinimalPair.sol";

/**
 * @title MinimalFactory
 * @notice Ultra-minimal Factory for HyperEVM
 */
contract MinimalFactory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    
    event PairCreated(address indexed token0, address indexed token1, address pair);
    
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO");
        require(getPair[token0][token1] == address(0), "EXISTS");
        
        pair = address(new MinimalPair());
        MinimalPair(pair).initialize(token0, token1);
        
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        
        emit PairCreated(token0, token1, pair);
    }
    
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}