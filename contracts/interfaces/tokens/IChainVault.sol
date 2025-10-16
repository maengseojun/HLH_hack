// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IChainVault
 * @notice Interface for Chain Vault (custody and management of index fund assets)
 * @dev Handles multi-chain asset storage and withdrawal
 */
interface IChainVault {
    /**
     * @notice Vault balance information
     */
    struct VaultBalance {
        uint256 totalBalance;        // Total deposited
        uint256 availableBalance;    // Available for withdrawal
        uint256 lockedBalance;       // Locked in pending operations
        uint256 lastUpdated;         // Last update timestamp
    }
    
    /**
     * @notice Deposit record
     */
    struct DepositRecord {
        bytes32 fundId;
        address tokenAddress;
        uint256 amount;
        uint256 timestamp;
        address depositor;
        uint256 chainId;
    }
    
    /**
     * @notice Withdrawal record
     */
    struct WithdrawalRecord {
        bytes32 fundId;
        address tokenAddress;
        uint256 amount;
        uint256 timestamp;
        address recipient;
        uint256 chainId;
        bool completed;
    }
    
    /**
     * @notice Events
     */
    event TokensDeposited(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 amount,
        address indexed depositor
    );
    
    event TokensWithdrawn(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 amount,
        address indexed recipient
    );
    
    event TokensLocked(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 amount,
        string reason
    );
    
    event TokensUnlocked(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 amount
    );
    
    /**
     * @notice Deposit tokens into vault
     * @param fundId Fund identifier
     * @param tokenAddress Token to deposit
     * @param amount Amount to deposit
     */
    function depositTokens(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount
    ) external;
    
    /**
     * @notice Withdraw tokens from vault
     * @param fundId Fund identifier
     * @param tokenAddress Token to withdraw
     * @param amount Amount to withdraw
     * @param recipient Address to receive tokens
     */
    function withdrawTokens(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount,
        address recipient
    ) external;
    
    /**
     * @notice Lock tokens (for pending operations)
     * @param fundId Fund identifier
     * @param tokenAddress Token to lock
     * @param amount Amount to lock
     * @param reason Reason for locking
     */
    function lockTokens(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount,
        string memory reason
    ) external;
    
    /**
     * @notice Unlock tokens
     * @param fundId Fund identifier
     * @param tokenAddress Token to unlock
     * @param amount Amount to unlock
     */
    function unlockTokens(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount
    ) external;
    
    /**
     * @notice Get vault balance for a fund's token
     * @param fundId Fund identifier
     * @param tokenAddress Token address
     * @return balance Vault balance details
     */
    function getVaultBalance(
        bytes32 fundId,
        address tokenAddress
    ) external view returns (VaultBalance memory balance);
    
    /**
     * @notice Check if vault has sufficient balance
     * @param fundId Fund identifier
     * @param tokenAddress Token address
     * @param amount Required amount
     * @return sufficient True if sufficient balance
     */
    function hasSufficientBalance(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount
    ) external view returns (bool sufficient);
    
    /**
     * @notice Get total value of fund in vault
     * @param fundId Fund identifier
     * @return totalValue Total value in USDC (scaled by 1e18)
     */
    function getTotalFundValue(bytes32 fundId) 
        external 
        view 
        returns (uint256 totalValue);
    
    /**
     * @notice Get deposit history for a fund
     * @param fundId Fund identifier
     * @param limit Maximum number of records
     * @param offset Starting offset
     * @return deposits Array of deposit records
     */
    function getDepositHistory(
        bytes32 fundId,
        uint256 limit,
        uint256 offset
    ) external view returns (DepositRecord[] memory deposits);
    
    /**
     * @notice Get withdrawal history for a fund
     * @param fundId Fund identifier
     * @param limit Maximum number of records
     * @param offset Starting offset
     * @return withdrawals Array of withdrawal records
     */
    function getWithdrawalHistory(
        bytes32 fundId,
        uint256 limit,
        uint256 offset
    ) external view returns (WithdrawalRecord[] memory withdrawals);
    
    /**
     * @notice Get all tokens held by a fund
     * @param fundId Fund identifier
     * @return tokenAddresses Array of token addresses
     * @return balances Array of balances
     */
    function getFundTokens(bytes32 fundId)
        external
        view
        returns (
            address[] memory tokenAddresses,
            uint256[] memory balances
        );
    
    /**
     * @notice Emergency withdraw (admin only)
     * @param fundId Fund identifier
     * @param tokenAddress Token to withdraw
     * @param recipient Emergency recipient
     */
    function emergencyWithdraw(
        bytes32 fundId,
        address tokenAddress,
        address recipient
    ) external;
    
    /**
     * @notice Pause vault operations
     */
    function pause() external;
    
    /**
     * @notice Unpause vault operations
     */
    function unpause() external;
    
    /**
     * @notice Check if vault is paused
     * @return True if paused
     */
    function isPaused() external view returns (bool);
}
