// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IWHYPE
 * @notice Interface for Wrapped HYPE token
 * @dev Similar to WETH - wraps native HYPE token into ERC20
 */
interface IWHYPE {
    /**
     * @notice Emitted when HYPE is deposited
     * @param dst Address that deposited
     * @param wad Amount deposited
     */
    event Deposit(address indexed dst, uint256 wad);
    
    /**
     * @notice Emitted when HYPE is withdrawn
     * @param src Address that withdrew
     * @param wad Amount withdrawn
     */
    event Withdrawal(address indexed src, uint256 wad);
    
    /**
     * @notice Deposit HYPE and receive WHYPE
     */
    function deposit() external payable;
    
    /**
     * @notice Withdraw HYPE by burning WHYPE
     * @param wad Amount of WHYPE to burn
     */
    function withdraw(uint256 wad) external;
    
    /**
     * @notice Get total supply of WHYPE
     * @return Total supply
     */
    function totalSupply() external view returns (uint256);
    
    /**
     * @notice Get WHYPE balance of an account
     * @param account Address to check
     * @return Balance of the account
     */
    function balanceOf(address account) external view returns (uint256);
    
    /**
     * @notice Transfer WHYPE tokens
     * @param to Recipient address
     * @param value Amount to transfer
     * @return success True if transfer succeeded
     */
    function transfer(address to, uint256 value) external returns (bool success);
    
    /**
     * @notice Approve spending of WHYPE tokens
     * @param spender Address allowed to spend
     * @param value Amount approved
     * @return success True if approval succeeded
     */
    function approve(address spender, uint256 value) external returns (bool success);
    
    /**
     * @notice Transfer tokens from another account
     * @param from Source address
     * @param to Recipient address
     * @param value Amount to transfer
     * @return success True if transfer succeeded
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool success);
}
