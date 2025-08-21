// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HyperIndexPair.sol";

/**
 * @title HyperIndexFactory
 * @notice Factory contract for creating HyperIndex AMM pairs on HyperEVM
 * @dev Based on Uniswap V2 with HyperEVM optimizations
 */
contract HyperIndexFactory {
    address public feeTo;
    address public feeToSetter;
    
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    
    event PairCreated(
        address indexed token0, 
        address indexed token1, 
        address pair, 
        uint256
    );
    
    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }
    
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
    
    /**
     * @notice Create a new AMM pair for two tokens
     * @param tokenA Address of first token
     * @param tokenB Address of second token
     * @return pair Address of created pair contract
     */
    function createPair(address tokenA, address tokenB) 
        external 
        returns (address pair) 
    {
        require(tokenA != tokenB, "HyperIndex: IDENTICAL_ADDRESSES");
        
        (address token0, address token1) = tokenA < tokenB 
            ? (tokenA, tokenB) 
            : (tokenB, tokenA);
            
        require(token0 != address(0), "HyperIndex: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "HyperIndex: PAIR_EXISTS");
        
        // Create new pair contract
        bytes memory bytecode = type(HyperIndexPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        
        // Initialize the pair
        HyperIndexPair(pair).initialize(token0, token1);
        
        // Store pair addresses
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
    
    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "HyperIndex: FORBIDDEN");
        feeTo = _feeTo;
    }
    
    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "HyperIndex: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }
}