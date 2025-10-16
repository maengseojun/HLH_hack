// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IHyperIndexFactory
 * @notice Interface for the HyperIndex Factory contract
 */
interface IHyperIndexFactory {
    /**
     * @notice Emitted when a new pair is created
     * @param token0 Address of the first token
     * @param token1 Address of the second token
     * @param pair Address of the created pair
     * @param pairLength Total number of pairs created
     */
    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        uint256 pairLength
    );
    
    /**
     * @notice Get the pair address for two tokens
     * @param tokenA Address of the first token
     * @param tokenB Address of the second token
     * @return pair Address of the pair (0 if not exists)
     */
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    
    /**
     * @notice Get pair address by index
     * @param index Index of the pair
     * @return pair Address of the pair
     */
    function allPairs(uint256 index) external view returns (address pair);
    
    /**
     * @notice Get total number of pairs
     * @return Total number of pairs created
     */
    function allPairsLength() external view returns (uint256);
    
    /**
     * @notice Create a new trading pair
     * @param tokenA Address of the first token
     * @param tokenB Address of the second token
     * @return pair Address of the created pair
     */
    function createPair(address tokenA, address tokenB) external returns (address pair);
    
    /**
     * @notice Get the fee recipient address
     * @return Address that receives protocol fees
     */
    function feeTo() external view returns (address);
    
    /**
     * @notice Set the fee recipient address (owner only)
     * @param feeTo Address to receive protocol fees
     */
    function setFeeTo(address feeTo) external;
    
    /**
     * @notice Get the hash of the pair bytecode
     * @return Hash used for CREATE2 address calculation
     */
    function PAIR_CODE_HASH() external view returns (bytes32);
}
