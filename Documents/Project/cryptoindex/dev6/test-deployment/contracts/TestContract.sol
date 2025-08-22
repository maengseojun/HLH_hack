// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TestContract
 * @dev Simple contract for testing HyperEVM testnet deployment
 */
contract TestContract {
    uint256 public value;
    address public owner;
    
    event ValueUpdated(uint256 newValue);
    
    constructor() {
        owner = msg.sender;
        value = 42;
    }
    
    function setValue(uint256 _value) external {
        value = _value;
        emit ValueUpdated(_value);
    }
    
    function getValue() external view returns (uint256) {
        return value;
    }
    
    function getOwner() external view returns (address) {
        return owner;
    }
}