// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./LayerZeroMessaging.sol";
import "./SmartIndexVault.sol";
import "./interfaces/IHyperIndexVault.sol";

/**
 * @title CrossChainVaultManager
 * @dev Manages cross-chain vault operations with LayerZero integration
 * @notice Coordinates deposits, withdrawals, and rebalancing across multiple chains
 */
contract CrossChainVaultManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    bytes32 public constant CROSS_CHAIN_EXECUTOR_ROLE = keccak256("CROSS_CHAIN_EXECUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // Core contracts
    LayerZeroMessaging public immutable lzMessaging;
    
    // Cross-chain vault mappings
    mapping(bytes32 => mapping(uint256 => address)) public vaultsByChain; // fundId => chainId => vault
    mapping(bytes32 => VaultCluster) public vaultClusters;
    mapping(uint256 => CrossChainOperation) public pendingOperations;
    mapping(address => bool) public authorizedVaults;
    
    uint256 private nextOperationId = 1;
    uint256 public operationTimeout = 3600; // 1 hour
    
    struct VaultCluster {
        bytes32 fundId;
        string name;
        address primaryVault; // Main vault on primary chain
        uint256 primaryChainId;
        ChainVault[] chainVaults;
        ClusterConfig config;
        uint256 createdAt;
        bool isActive;
    }
    
    struct ChainVault {
        uint256 chainId;
        address vaultAddress;
        uint256 targetAllocation; // Basis points (10000 = 100%)
        uint256 currentBalance;
        bool isActive;
    }
    
    struct ClusterConfig {
        uint256 rebalanceThreshold; // Basis points deviation to trigger rebalance
        uint256 minOperationAmount; // Minimum amount for cross-chain operations
        uint256 maxSlippage; // Maximum slippage for cross-chain swaps
        bool autoRebalance; // Whether to enable automatic rebalancing
    }
    
    struct CrossChainOperation {
        uint256 id;
        OperationType opType;
        bytes32 fundId;
        uint256 sourceChain;
        uint256 targetChain;
        address sourceVault;
        address targetVault;
        uint256 amount;
        address user;
        OperationStatus status;
        uint256 timestamp;
        uint256 deadline;
        bytes32 lzTxHash;
    }
    
    enum OperationType {
        DEPOSIT,
        WITHDRAWAL,
        REBALANCE,
        HARVEST,
        EMERGENCY_EXIT
    }
    
    enum OperationStatus {
        PENDING,
        EXECUTING,
        COMPLETED,
        FAILED,
        EXPIRED
    }
    
    // Events
    event VaultClusterCreated(
        bytes32 indexed fundId,
        string name,
        address indexed primaryVault,
        uint256 primaryChainId
    );
    
    event CrossChainOperationInitiated(
        uint256 indexed operationId,
        bytes32 indexed fundId,
        OperationType opType,
        uint256 sourceChain,
        uint256 targetChain,
        uint256 amount,
        address indexed user
    );
    
    event CrossChainOperationCompleted(
        uint256 indexed operationId,
        bytes32 indexed fundId,
        uint256 finalAmount,
        address indexed user
    );
    
    event VaultRebalanced(
        bytes32 indexed fundId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount
    );
    
    event ClusterConfigUpdated(
        bytes32 indexed fundId,
        uint256 rebalanceThreshold,
        bool autoRebalance
    );
    
    constructor(address _lzMessaging) {
        require(_lzMessaging != address(0), "Invalid LayerZero messaging contract");
        
        lzMessaging = LayerZeroMessaging(payable(_lzMessaging));
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VAULT_MANAGER_ROLE, msg.sender);
        _grantRole(CROSS_CHAIN_EXECUTOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new vault cluster for cross-chain operations
     * @param fundId Unique identifier for the fund
     * @param name Cluster name
     * @param primaryVault Address of the primary vault
     * @param primaryChainId Chain ID where primary vault is deployed
     * @param config Cluster configuration
     */
    function createVaultCluster(
        bytes32 fundId,
        string memory name,
        address primaryVault,
        uint256 primaryChainId,
        ClusterConfig memory config
    ) external onlyRole(VAULT_MANAGER_ROLE) whenNotPaused {
        require(fundId != bytes32(0), "Invalid fund ID");
        require(bytes(name).length > 0, "Name required");
        require(primaryVault != address(0), "Invalid primary vault");
        require(!vaultClusters[fundId].isActive, "Cluster already exists");
        
        VaultCluster storage cluster = vaultClusters[fundId];
        cluster.fundId = fundId;
        cluster.name = name;
        cluster.primaryVault = primaryVault;
        cluster.primaryChainId = primaryChainId;
        cluster.config = config;
        cluster.createdAt = block.timestamp;
        cluster.isActive = true;
        
        // Add primary vault to chain vaults
        cluster.chainVaults.push(ChainVault({
            chainId: primaryChainId,
            vaultAddress: primaryVault,
            targetAllocation: 10000, // 100% initially
            currentBalance: 0,
            isActive: true
        }));
        
        // Register vault mappings
        vaultsByChain[fundId][primaryChainId] = primaryVault;
        authorizedVaults[primaryVault] = true;
        
        emit VaultClusterCreated(fundId, name, primaryVault, primaryChainId);
    }
    
    /**
     * @dev Add a vault to an existing cluster
     * @param fundId Fund identifier
     * @param chainId Target chain ID
     * @param vaultAddress Vault address on target chain
     * @param targetAllocation Target allocation percentage
     */
    function addVaultToCluster(
        bytes32 fundId,
        uint256 chainId,
        address vaultAddress,
        uint256 targetAllocation
    ) external onlyRole(VAULT_MANAGER_ROLE) whenNotPaused {
        require(vaultClusters[fundId].isActive, "Cluster not found");
        require(vaultAddress != address(0), "Invalid vault address");
        require(targetAllocation > 0 && targetAllocation <= 10000, "Invalid allocation");
        require(vaultsByChain[fundId][chainId] == address(0), "Vault already exists on chain");
        
        VaultCluster storage cluster = vaultClusters[fundId];
        
        // Add to chain vaults
        cluster.chainVaults.push(ChainVault({
            chainId: chainId,
            vaultAddress: vaultAddress,
            targetAllocation: targetAllocation,
            currentBalance: 0,
            isActive: true
        }));
        
        // Update mappings
        vaultsByChain[fundId][chainId] = vaultAddress;
        authorizedVaults[vaultAddress] = true;
        
        // Rebalance allocations to maintain 100% total
        _rebalanceAllocations(fundId);
    }
    
    /**
     * @dev Execute cross-chain deposit
     * @param fundId Fund identifier
     * @param targetChainId Target chain for deposit
     * @param amount Amount to deposit
     * @param user User address
     * @return operationId Operation identifier
     */
    function executeCrossChainDeposit(
        bytes32 fundId,
        uint256 targetChainId,
        uint256 amount,
        address user
    ) external onlyRole(CROSS_CHAIN_EXECUTOR_ROLE) whenNotPaused nonReentrant returns (uint256 operationId) {
        require(vaultClusters[fundId].isActive, "Cluster not found");
        require(amount > 0, "Invalid amount");
        require(user != address(0), "Invalid user");
        
        address targetVault = vaultsByChain[fundId][targetChainId];
        require(targetVault != address(0), "Target vault not found");
        
        operationId = nextOperationId++;
        
        // Create operation record
        CrossChainOperation storage operation = pendingOperations[operationId];
        operation.id = operationId;
        operation.opType = OperationType.DEPOSIT;
        operation.fundId = fundId;
        operation.sourceChain = block.chainid;
        operation.targetChain = targetChainId;
        operation.targetVault = targetVault;
        operation.amount = amount;
        operation.user = user;
        operation.status = OperationStatus.PENDING;
        operation.timestamp = block.timestamp;
        operation.deadline = block.timestamp + operationTimeout;
        
        // Send cross-chain message if needed
        if (targetChainId != block.chainid) {
            bytes32 txHash = _sendCrossChainMessage(operation);
            operation.lzTxHash = txHash;
            operation.status = OperationStatus.EXECUTING;
        } else {
            // Local execution
            _executeLocalOperation(operation);
        }
        
        emit CrossChainOperationInitiated(
            operationId,
            fundId,
            OperationType.DEPOSIT,
            block.chainid,
            targetChainId,
            amount,
            user
        );
    }
    
    /**
     * @dev Execute cross-chain withdrawal
     * @param fundId Fund identifier
     * @param sourceChainId Source chain for withdrawal
     * @param amount Amount to withdraw
     * @param user User address
     * @return operationId Operation identifier
     */
    function executeCrossChainWithdrawal(
        bytes32 fundId,
        uint256 sourceChainId,
        uint256 amount,
        address user
    ) external onlyRole(CROSS_CHAIN_EXECUTOR_ROLE) whenNotPaused nonReentrant returns (uint256 operationId) {
        require(vaultClusters[fundId].isActive, "Cluster not found");
        require(amount > 0, "Invalid amount");
        require(user != address(0), "Invalid user");
        
        address sourceVault = vaultsByChain[fundId][sourceChainId];
        require(sourceVault != address(0), "Source vault not found");
        
        operationId = nextOperationId++;
        
        // Create operation record
        CrossChainOperation storage operation = pendingOperations[operationId];
        operation.id = operationId;
        operation.opType = OperationType.WITHDRAWAL;
        operation.fundId = fundId;
        operation.sourceChain = sourceChainId;
        operation.targetChain = block.chainid;
        operation.sourceVault = sourceVault;
        operation.amount = amount;
        operation.user = user;
        operation.status = OperationStatus.PENDING;
        operation.timestamp = block.timestamp;
        operation.deadline = block.timestamp + operationTimeout;
        
        // Send cross-chain message if needed
        if (sourceChainId != block.chainid) {
            bytes32 txHash = _sendCrossChainMessage(operation);
            operation.lzTxHash = txHash;
            operation.status = OperationStatus.EXECUTING;
        } else {
            // Local execution
            _executeLocalOperation(operation);
        }
        
        emit CrossChainOperationInitiated(
            operationId,
            fundId,
            OperationType.WITHDRAWAL,
            sourceChainId,
            block.chainid,
            amount,
            user
        );
    }
    
    /**
     * @dev Check if cluster needs rebalancing
     * @param fundId Fund identifier
     * @return needed Whether rebalancing is needed
     * @return fromChain Source chain for rebalance
     * @return toChain Target chain for rebalance
     * @return amount Amount to rebalance
     */
    function checkRebalanceNeeded(
        bytes32 fundId
    ) external view returns (
        bool needed,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount
    ) {
        VaultCluster storage cluster = vaultClusters[fundId];
        require(cluster.isActive, "Cluster not found");
        
        // Calculate current allocations vs target
        uint256 totalBalance = _getTotalClusterBalance(fundId);
        if (totalBalance == 0) return (false, 0, 0, 0);
        
        uint256 maxDeviation = 0;
        uint256 maxDeviationChain = 0;
        uint256 minDeviationChain = 0;
        
        for (uint i = 0; i < cluster.chainVaults.length; i++) {
            ChainVault memory vault = cluster.chainVaults[i];
            if (!vault.isActive) continue;
            
            uint256 currentRatio = (vault.currentBalance * 10000) / totalBalance;
            
            if (currentRatio > vault.targetAllocation) {
                uint256 deviation = currentRatio - vault.targetAllocation;
                if (deviation > maxDeviation) {
                    maxDeviation = deviation;
                    maxDeviationChain = vault.chainId;
                }
            } else if (currentRatio < vault.targetAllocation) {
                uint256 deviation = vault.targetAllocation - currentRatio;
                if (deviation > maxDeviation) {
                    maxDeviation = deviation;
                    minDeviationChain = vault.chainId;
                }
            }
        }
        
        if (maxDeviation > cluster.config.rebalanceThreshold) {
            needed = true;
            fromChain = maxDeviationChain;
            toChain = minDeviationChain;
            amount = (maxDeviation * totalBalance) / 20000; // Move half the deviation
        }
    }
    
    /**
     * @dev Execute automatic rebalancing
     * @param fundId Fund identifier
     */
    function executeAutoRebalance(
        bytes32 fundId
    ) external onlyRole(CROSS_CHAIN_EXECUTOR_ROLE) whenNotPaused {
        VaultCluster storage cluster = vaultClusters[fundId];
        require(cluster.isActive, "Cluster not found");
        require(cluster.config.autoRebalance, "Auto rebalance disabled");
        
        (bool needed, uint256 fromChain, uint256 toChain, uint256 amount) = 
            this.checkRebalanceNeeded(fundId);
        
        if (needed && amount >= cluster.config.minOperationAmount) {
            _executeRebalance(fundId, fromChain, toChain, amount);
        }
    }
    
    /**
     * @dev Internal function to send cross-chain message
     */
    function _sendCrossChainMessage(
        CrossChainOperation memory operation
    ) internal returns (bytes32 txHash) {
        // Prepare message payload
        bytes memory payload = abi.encode(
            operation.id,
            operation.opType,
            operation.fundId,
            operation.amount,
            operation.user,
            block.timestamp
        );
        
        // Send via LayerZero messaging
        try lzMessaging.sendDepositMessage{value: msg.value}(
            operation.targetVault,
            uint256(operation.fundId),
            operation.amount,
            operation.amount, // shares = amount for now
            operation.user
        ) {
            txHash = keccak256(payload);
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Cross-chain send failed: ", reason)));
        }
    }
    
    /**
     * @dev Internal function to execute local operation
     */
    function _executeLocalOperation(CrossChainOperation storage operation) internal {
        if (operation.opType == OperationType.DEPOSIT) {
            // Execute local deposit
            SmartIndexVault vault = SmartIndexVault(operation.targetVault);
            vault.deposit(operation.amount, operation.user);
        } else if (operation.opType == OperationType.WITHDRAWAL) {
            // Execute local withdrawal
            SmartIndexVault vault = SmartIndexVault(operation.sourceVault);
            vault.withdraw(operation.amount, operation.user, operation.user);
        }
        
        operation.status = OperationStatus.COMPLETED;
        
        emit CrossChainOperationCompleted(
            operation.id,
            operation.fundId,
            operation.amount,
            operation.user
        );
    }
    
    /**
     * @dev Internal function to execute rebalancing
     */
    function _executeRebalance(
        bytes32 fundId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount
    ) internal {
        // Create rebalance operation
        uint256 operationId = nextOperationId++;
        
        CrossChainOperation storage operation = pendingOperations[operationId];
        operation.id = operationId;
        operation.opType = OperationType.REBALANCE;
        operation.fundId = fundId;
        operation.sourceChain = fromChain;
        operation.targetChain = toChain;
        operation.sourceVault = vaultsByChain[fundId][fromChain];
        operation.targetVault = vaultsByChain[fundId][toChain];
        operation.amount = amount;
        operation.status = OperationStatus.PENDING;
        operation.timestamp = block.timestamp;
        operation.deadline = block.timestamp + operationTimeout;
        
        // Execute based on chain requirements
        if (fromChain != block.chainid || toChain != block.chainid) {
            // Cross-chain rebalance
            operation.lzTxHash = _sendCrossChainMessage(operation);
            operation.status = OperationStatus.EXECUTING;
        } else {
            // Local rebalance
            _executeLocalRebalance(operation);
        }
        
        emit VaultRebalanced(fundId, fromChain, toChain, amount);
    }
    
    /**
     * @dev Internal function to execute local rebalancing
     */
    function _executeLocalRebalance(CrossChainOperation storage operation) internal {
        // Withdraw from source vault
        SmartIndexVault sourceVault = SmartIndexVault(operation.sourceVault);
        sourceVault.withdraw(operation.amount, address(this), address(this));
        
        // Deposit to target vault
        SmartIndexVault targetVault = SmartIndexVault(operation.targetVault);
        targetVault.deposit(operation.amount, address(this));
        
        operation.status = OperationStatus.COMPLETED;
    }
    
    /**
     * @dev Internal function to rebalance target allocations
     */
    function _rebalanceAllocations(bytes32 fundId) internal {
        VaultCluster storage cluster = vaultClusters[fundId];
        
        // Calculate total allocation
        uint256 totalAllocation = 0;
        uint256 activeVaults = 0;
        
        for (uint i = 0; i < cluster.chainVaults.length; i++) {
            if (cluster.chainVaults[i].isActive) {
                totalAllocation += cluster.chainVaults[i].targetAllocation;
                activeVaults++;
            }
        }
        
        // If over 100%, proportionally reduce
        if (totalAllocation > 10000) {
            for (uint i = 0; i < cluster.chainVaults.length; i++) {
                if (cluster.chainVaults[i].isActive) {
                    cluster.chainVaults[i].targetAllocation = 
                        (cluster.chainVaults[i].targetAllocation * 10000) / totalAllocation;
                }
            }
        }
    }
    
    /**
     * @dev Get total balance across all vaults in cluster
     */
    function _getTotalClusterBalance(bytes32 fundId) internal view returns (uint256 totalBalance) {
        VaultCluster storage cluster = vaultClusters[fundId];
        
        for (uint i = 0; i < cluster.chainVaults.length; i++) {
            if (cluster.chainVaults[i].isActive) {
                totalBalance += cluster.chainVaults[i].currentBalance;
            }
        }
    }
    
    /**
     * @dev Get vault cluster information
     * @param fundId Fund identifier
     * @return cluster Complete cluster information
     */
    function getVaultCluster(
        bytes32 fundId
    ) external view returns (VaultCluster memory cluster) {
        return vaultClusters[fundId];
    }
    
    /**
     * @dev Get cross-chain operation information
     * @param operationId Operation identifier
     * @return operation Complete operation information
     */
    function getCrossChainOperation(
        uint256 operationId
    ) external view returns (CrossChainOperation memory operation) {
        return pendingOperations[operationId];
    }
    
    /**
     * @dev Update cluster configuration
     * @param fundId Fund identifier
     * @param config New configuration
     */
    function updateClusterConfig(
        bytes32 fundId,
        ClusterConfig memory config
    ) external onlyRole(VAULT_MANAGER_ROLE) {
        require(vaultClusters[fundId].isActive, "Cluster not found");
        
        vaultClusters[fundId].config = config;
        
        emit ClusterConfigUpdated(
            fundId,
            config.rebalanceThreshold,
            config.autoRebalance
        );
    }
    
    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external onlyRole(EMERGENCY_ROLE) {
        _unpause();
    }
}