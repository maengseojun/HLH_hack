// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IChainVault
 * @dev Interface for managing native tokens in chain-specific vaults
 * @notice Each chain has its own vault that holds native tokens for index funds
 */
interface IChainVault {
    
    // Events
    event TokensDeposited(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 amount,
        uint256 chainId
    );
    
    event TokensWithdrawn(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 amount,
        address recipient,
        uint256 chainId
    );
    
    event VaultStatusChanged(
        uint256 indexed chainId,
        bool active
    );
    
    // Structs
    struct VaultBalance {
        bytes32 fundId;           // Fund identifier
        address tokenAddress;     // Native token address
        uint256 totalBalance;     // Total balance in vault
        uint256 availableBalance; // Available for redemption
        uint256 lockedBalance;    // Locked/reserved balance
        uint256 chainId;          // Chain where vault operates
    }
    
    struct ChainInfo {
        uint256 chainId;          // Chain identifier
        string chainName;         // Chain name (e.g., "Ethereum", "Solana", "BNB")
        address vaultAddress;     // Vault contract address on that chain
        bool isActive;           // Whether the vault is active
        uint256 minBalance;      // Minimum balance required
    }
    
    /**
     * @dev Deposit native tokens to the vault for a specific fund
     * @param fundId The fund identifier
     * @param tokenAddress Native token address
     * @param amount Amount to deposit
     */
    function depositTokens(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount
    ) external;
    
    /**
     * @dev Withdraw native tokens from vault for redemption
     * @param fundId The fund identifier
     * @param tokenAddress Native token address
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
     * @dev Get vault balance for a specific fund and token
     * @param fundId The fund identifier
     * @param tokenAddress Native token address
     * @return balance VaultBalance struct
     */
    function getVaultBalance(
        bytes32 fundId,
        address tokenAddress
    ) external view returns (VaultBalance memory balance);
    
    /**
     * @dev Check if sufficient balance is available for redemption
     * @param fundId The fund identifier
     * @param tokenAddress Native token address
     * @param amount Amount needed
     * @return sufficient Whether sufficient balance exists
     */
    function hasSufficientBalance(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount
    ) external view returns (bool sufficient);
    
    /**
     * @dev Get all vault balances for a fund
     * @param fundId The fund identifier
     * @return balances Array of vault balances
     */
    function getFundVaultBalances(
        bytes32 fundId
    ) external view returns (VaultBalance[] memory balances);
    
    /**
     * @dev Get chain information
     * @param chainId The chain identifier
     * @return info ChainInfo struct
     */
    function getChainInfo(uint256 chainId) external view returns (ChainInfo memory info);
    
    /**
     * @dev Get all supported chains
     * @return chains Array of supported chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory chains);
    
    /**
     * @dev Admin function to add/update chain vault
     * @param chainId Chain identifier
     * @param chainName Chain name
     * @param vaultAddress Vault address on that chain
     * @param isActive Whether the vault is active
     * @param minBalance Minimum balance required
     */
    function setChainVault(
        uint256 chainId,
        string memory chainName,
        address vaultAddress,
        bool isActive,
        uint256 minBalance
    ) external;
    
    /**
     * @dev Admin function to set vault status
     * @param chainId Chain identifier
     * @param active Whether the vault should be active
     */
    function setVaultStatus(uint256 chainId, bool active) external;
    
    /**
     * @dev Emergency function to lock/unlock balance
     * @param fundId The fund identifier
     * @param tokenAddress Native token address
     * @param amount Amount to lock/unlock
     * @param lock Whether to lock (true) or unlock (false)
     */
    function lockBalance(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount,
        bool lock
    ) external;
}