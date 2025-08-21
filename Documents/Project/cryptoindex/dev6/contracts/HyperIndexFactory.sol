// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HyperIndexPair.sol";

/**
 * @title HyperIndexFactory
 * @notice Factory contract for creating AMM pairs on HyperEVM
 * @dev OpenZeppelin v5 compatible implementation
 */
contract HyperIndexFactory is Ownable {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    
    address public feeTo;
    
    bytes32 public constant PAIR_CODE_HASH = keccak256(abi.encodePacked(type(HyperIndexPair).creationCode));
    
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 pairLength);
    
    constructor(address _owner) Ownable(_owner) {}
    
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
    
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "HyperIndexFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "HyperIndexFactory: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "HyperIndexFactory: PAIR_EXISTS");
        
        bytes memory bytecode = type(HyperIndexPair).creationCode;
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

interface IHyperIndexPair {
    function initialize(address token0, address token1) external;
}