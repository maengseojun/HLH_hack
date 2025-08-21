// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TestSimple
 * @notice Simple test contract to verify deployment works
 */
contract TestSimple {
    string public name = "TestSimple";
    uint256 public value;
    
    event ValueSet(uint256 newValue);
    
    function setValue(uint256 _value) external {
        value = _value;
        emit ValueSet(_value);
    }
    
    function getValue() external view returns (uint256) {
        return value;
    }
}