// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IChainVault.sol";

/**
 * @title ChainVault
 * @dev Implementation of chain-specific vault for native token management
 * @notice Manages native tokens across different chains for index fund redemptions
 */
contract ChainVault is AccessControl, ReentrancyGuard, IChainVault {
    using SafeERC20 for IERC20;
    
    // Role definitions
    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    bytes32 public constant REDEMPTION_MANAGER_ROLE = keccak256("REDEMPTION_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // State variables
    mapping(bytes32 => mapping(address => VaultBalance)) private vaultBalances;
    mapping(bytes32 => address[]) private fundTokens; // Track tokens per fund
    mapping(uint256 => ChainInfo) private chainInfo;
    uint256[] private supportedChains;
    
    // Emergency pause state
    bool public paused = false;
    
    modifier whenNotPaused() {
        require(!paused, "ChainVault: paused");
        _;
    }
    
    modifier validChain(uint256 chainId) {
        require(chainInfo[chainId].isActive, "ChainVault: chain not active");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VAULT_MANAGER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        // Initialize common chains
        _initializeDefaultChains();
    }
    
    /**
     * @dev Initialize default supported chains
     */
    function _initializeDefaultChains() internal {
        // Ethereum Mainnet
        chainInfo[1] = ChainInfo({
            chainId: 1,
            chainName: "Ethereum",
            vaultAddress: address(this),
            isActive: true,
            minBalance: 0.01 ether
        });
        supportedChains.push(1);
        
        // BNB Smart Chain
        chainInfo[56] = ChainInfo({
            chainId: 56,
            chainName: "BNB Smart Chain", 
            vaultAddress: address(this),
            isActive: true,
            minBalance: 0.001 ether
        });
        supportedChains.push(56);
        
        // Polygon
        chainInfo[137] = ChainInfo({
            chainId: 137,
            chainName: "Polygon",
            vaultAddress: address(this),
            isActive: true,
            minBalance: 1 ether
        });
        supportedChains.push(137);
    }
    
    /**
     * @dev Deposit native tokens to the vault for a specific fund
     */
    function depositTokens(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount
    ) external override onlyRole(VAULT_MANAGER_ROLE) whenNotPaused nonReentrant {
        require(fundId != bytes32(0), "ChainVault: invalid fund ID");
        require(tokenAddress != address(0), "ChainVault: invalid token address");
        require(amount > 0, "ChainVault: amount must be positive");
        
        // Transfer tokens to vault
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        
        VaultBalance storage balance = vaultBalances[fundId][tokenAddress];
        
        // Initialize if first deposit for this token
        if (balance.tokenAddress == address(0)) {
            balance.fundId = fundId;
            balance.tokenAddress = tokenAddress;
            balance.chainId = block.chainid;
            fundTokens[fundId].push(tokenAddress);
        }
        
        balance.totalBalance += amount;
        balance.availableBalance += amount;
        
        emit TokensDeposited(fundId, tokenAddress, amount, block.chainid);
    }
    
    /**
     * @dev Withdraw native tokens from vault for redemption
     */
    function withdrawTokens(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount,
        address recipient
    ) external override onlyRole(REDEMPTION_MANAGER_ROLE) whenNotPaused nonReentrant {
        require(fundId != bytes32(0), "ChainVault: invalid fund ID");
        require(tokenAddress != address(0), "ChainVault: invalid token address");
        require(amount > 0, "ChainVault: amount must be positive");
        require(recipient != address(0), "ChainVault: invalid recipient");
        
        VaultBalance storage balance = vaultBalances[fundId][tokenAddress];
        require(balance.availableBalance >= amount, "ChainVault: insufficient available balance");
        
        // Update balances
        balance.totalBalance -= amount;
        balance.availableBalance -= amount;
        
        // Transfer tokens to recipient
        IERC20(tokenAddress).safeTransfer(recipient, amount);
        
        emit TokensWithdrawn(fundId, tokenAddress, amount, recipient, block.chainid);
    }
    
    /**
     * @dev Get vault balance for a specific fund and token
     */
    function getVaultBalance(
        bytes32 fundId,
        address tokenAddress
    ) external view override returns (VaultBalance memory balance) {
        return vaultBalances[fundId][tokenAddress];
    }
    
    /**
     * @dev Check if sufficient balance is available for redemption
     */
    function hasSufficientBalance(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount
    ) external view override returns (bool sufficient) {
        VaultBalance storage balance = vaultBalances[fundId][tokenAddress];
        return balance.availableBalance >= amount;
    }
    
    /**
     * @dev Get all vault balances for a fund
     */
    function getFundVaultBalances(
        bytes32 fundId
    ) external view override returns (VaultBalance[] memory balances) {
        address[] memory tokens = fundTokens[fundId];
        balances = new VaultBalance[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = vaultBalances[fundId][tokens[i]];
        }
    }
    
    /**
     * @dev Get chain information
     */
    function getChainInfo(uint256 chainId) external view override returns (ChainInfo memory info) {
        return chainInfo[chainId];
    }
    
    /**
     * @dev Get all supported chains
     */
    function getSupportedChains() external view override returns (uint256[] memory chains) {
        return supportedChains;
    }
    
    /**
     * @dev Admin function to add/update chain vault
     */
    function setChainVault(
        uint256 chainId,
        string memory chainName,
        address vaultAddress,
        bool isActive,
        uint256 minBalance
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(chainId > 0, "ChainVault: invalid chain ID");
        require(bytes(chainName).length > 0, "ChainVault: invalid chain name");
        require(vaultAddress != address(0), "ChainVault: invalid vault address");
        
        bool isNewChain = (chainInfo[chainId].chainId == 0);
        
        chainInfo[chainId] = ChainInfo({
            chainId: chainId,
            chainName: chainName,
            vaultAddress: vaultAddress,
            isActive: isActive,
            minBalance: minBalance
        });
        
        // Add to supported chains if new
        if (isNewChain && isActive) {
            supportedChains.push(chainId);
        }
    }
    
    /**
     * @dev Admin function to set vault status
     */
    function setVaultStatus(uint256 chainId, bool active) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(chainInfo[chainId].chainId != 0, "ChainVault: chain not found");
        
        chainInfo[chainId].isActive = active;
        emit VaultStatusChanged(chainId, active);
    }
    
    /**
     * @dev Emergency function to lock/unlock balance
     */
    function lockBalance(
        bytes32 fundId,
        address tokenAddress,
        uint256 amount,
        bool lock
    ) external override onlyRole(EMERGENCY_ROLE) {
        require(fundId != bytes32(0), "ChainVault: invalid fund ID");
        require(tokenAddress != address(0), "ChainVault: invalid token address");
        require(amount > 0, "ChainVault: amount must be positive");
        
        VaultBalance storage balance = vaultBalances[fundId][tokenAddress];
        
        if (lock) {
            require(balance.availableBalance >= amount, "ChainVault: insufficient available balance");
            balance.availableBalance -= amount;
            balance.lockedBalance += amount;
        } else {
            require(balance.lockedBalance >= amount, "ChainVault: insufficient locked balance");
            balance.lockedBalance -= amount;
            balance.availableBalance += amount;
        }
    }
    
    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(EMERGENCY_ROLE) {
        paused = true;
    }
    
    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external onlyRole(EMERGENCY_ROLE) {
        paused = false;
    }
    
    /**
     * @dev Get fund tokens
     */
    function getFundTokens(bytes32 fundId) external view returns (address[] memory tokens) {
        return fundTokens[fundId];
    }
    
    /**
     * @dev Check if vault is paused
     */
    function isPaused() external view returns (bool) {
        return paused;
    }
}