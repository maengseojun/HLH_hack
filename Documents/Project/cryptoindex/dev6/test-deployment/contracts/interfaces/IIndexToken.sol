// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IIndexToken
 * @dev Interface for Index Token contracts
 */
interface IIndexToken is IERC20 {
    /**
     * @dev Returns the fund ID this index token represents
     */
    function fundId() external view returns (bytes32);
    
    /**
     * @dev Returns the factory contract address
     */
    function factory() external view returns (address);
    
    /**
     * @dev Get current NAV per token in USDC
     */
    function getNavPerToken() external view returns (uint256);
    
    /**
     * @dev Mint tokens (only factory)
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @dev Burn tokens (only factory)
     */
    function burn(address from, uint256 amount) external;
}
