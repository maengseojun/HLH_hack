// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IHyperIndexPair.sol";

/**
 * @title HyperIndexFactoryLite
 * @notice Lightweight Factory contract for creating AMM pairs on HyperEVM
 * @dev Optimized for deployment gas costs
 */
contract HyperIndexFactoryLite is Ownable {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    
    address public feeTo;
    address public pairImplementation; // Reference to deployed HyperIndexPair
    
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 pairLength);
    
    constructor(address _owner) Ownable(_owner) {}
    
    function setPairImplementation(address _pairImplementation) external onlyOwner {
        require(_pairImplementation != address(0), "Invalid implementation");
        pairImplementation = _pairImplementation;
    }
    
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
    
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(pairImplementation != address(0), "Implementation not set");
        require(tokenA != tokenB, "HyperIndexFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "HyperIndexFactory: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "HyperIndexFactory: PAIR_EXISTS");
        
        // Clone the pair implementation using minimal proxy pattern
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            pairImplementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        
        IHyperIndexPair(pair).initialize(token0, token1);
        
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
    
    function setFeeTo(address _feeTo) external onlyOwner {
        feeTo = _feeTo;
    }
}