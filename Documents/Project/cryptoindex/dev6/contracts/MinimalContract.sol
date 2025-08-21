// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// HyperEVM에 최적화된 초경량 컨트랙트
contract MinimalContract {
    uint256 public constant VERSION = 1;
    
    function test() external pure returns (bool) {
        return true;
    }
}
