// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIndexToken
 * @notice Interface for Index Token (ERC20 representing index fund shares)
 */
interface IIndexToken {
    /**
     * @notice Get the fund ID this token represents
     * @return Fund identifier
     */
    function fundId() external view returns (bytes32);
    
    /**
     * @notice Get the factory address
     * @return Factory contract address
     */
    function factory() external view returns (address);
    
    /**
     * @notice Mint new tokens (factory only)
     * @param to Address to receive tokens
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @notice Burn tokens (factory only)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external;
    
    /**
     * @notice Get NAV (Net Asset Value) per token
     * @return NAV per token in USDC (scaled by 1e18)
     */
    function getNavPerToken() external view returns (uint256);
    
    /**
     * @notice Initialize token (proxy pattern)
     * @param name Token name
     * @param symbol Token symbol
     * @param factory Factory address
     * @param fundId Fund identifier
     */
    function initialize(
        string memory name,
        string memory symbol,
        address factory,
        bytes32 fundId
    ) external;
}
