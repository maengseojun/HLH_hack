// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IHyperIndexVault.sol";
import "./RebalancingEngine.sol";

// Chainlink Keeper interface
interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData);
        
    function performUpkeep(bytes calldata performData) external;
}

/**
 * @title ChainlinkKeepers
 * @dev Chainlink Keepers integration for automated vault health checks and rebalancing
 * @notice Monitors vault health and triggers rebalancing when needed
 */
contract ChainlinkKeepers is AccessControl, Pausable, AutomationCompatibleInterface {
    
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    
    RebalancingEngine public immutable rebalancingEngine;
    
    // Keeper configuration
    struct KeeperConfig {
        uint256 checkInterval;        // Minimum seconds between checks
        uint256 maxVaultsPerUpkeep;   // Maximum vaults to process per upkeep
        uint256 gasLimit;             // Gas limit for upkeep
        bool isActive;                // Whether keeper is active
    }
    
    KeeperConfig public keeperConfig;
    
    // Vault tracking
    address[] public managedVaults;
    mapping(address => VaultHealth) public vaultHealthData;
    mapping(address => uint256) public lastCheckTime;
    uint256 public lastProcessedIndex; // For batch processing
    
    struct VaultHealth {
        bool isHealthy;
        uint256 lastHealthCheck;
        uint256 totalChecks;
        uint256 failedChecks;
        string lastError;
    }
    
    struct UpkeepData {
        address[] vaultsToRebalance;
        string[] reasons;
        uint256 timestamp;
    }
    
    // Events
    event VaultAdded(address indexed vault, address indexed manager);
    event VaultRemoved(address indexed vault);
    event HealthCheckPerformed(
        address indexed vault,
        bool isHealthy,
        string reason
    );
    event UpkeepPerformed(
        uint256 vaultsProcessed,
        uint256 rebalancesExecuted,
        uint256 gasUsed
    );
    event KeeperConfigUpdated(
        uint256 checkInterval,
        uint256 maxVaultsPerUpkeep,
        uint256 gasLimit,
        bool isActive
    );
    
    constructor(address _rebalancingEngine) {
        require(_rebalancingEngine != address(0), "ChainlinkKeepers: invalid rebalancing engine");
        
        rebalancingEngine = RebalancingEngine(_rebalancingEngine);
        
        // Default keeper configuration
        keeperConfig = KeeperConfig({
            checkInterval: 300,      // 5 minutes
            maxVaultsPerUpkeep: 10,  // Process up to 10 vaults per upkeep
            gasLimit: 2000000,       // 2M gas limit
            isActive: true
        });
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
        _grantRole(VAULT_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @dev Chainlink Keeper checkUpkeep function
     * @param checkData Encoded data for upkeep check
     * @return upkeepNeeded Whether upkeep is needed
     * @return performData Data to pass to performUpkeep
     */
    function checkUpkeep(bytes calldata checkData)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (!keeperConfig.isActive || paused()) {
            return (false, bytes(""));
        }
        
        uint256 vaultCount = managedVaults.length;
        if (vaultCount == 0) {
            return (false, bytes(""));
        }
        
        // Determine which vaults to check
        uint256 startIndex = lastProcessedIndex;
        uint256 endIndex = startIndex + keeperConfig.maxVaultsPerUpkeep;
        if (endIndex > vaultCount) {
            endIndex = vaultCount;
        }
        
        address[] memory vaultsToCheck = new address[](endIndex - startIndex);
        string[] memory reasons = new string[](endIndex - startIndex);
        uint256 foundCount = 0;
        
        // Check each vault
        for (uint256 i = startIndex; i < endIndex; i++) {
            address vault = managedVaults[i];
            
            // Skip if recently checked
            if (block.timestamp < lastCheckTime[vault] + keeperConfig.checkInterval) {
                continue;
            }
            
            // Check if vault needs attention
            (bool needsRebalance, string memory reason) = _checkVaultHealth(vault);
            
            if (needsRebalance) {
                vaultsToCheck[foundCount] = vault;
                reasons[foundCount] = reason;
                foundCount++;
            }
        }
        
        if (foundCount > 0) {
            // Trim arrays to actual size
            address[] memory vaultsToProcess = new address[](foundCount);
            string[] memory processReasons = new string[](foundCount);
            
            for (uint256 i = 0; i < foundCount; i++) {
                vaultsToProcess[i] = vaultsToCheck[i];
                processReasons[i] = reasons[i];
            }
            
            UpkeepData memory upkeepData = UpkeepData({
                vaultsToRebalance: vaultsToProcess,
                reasons: processReasons,
                timestamp: block.timestamp
            });
            
            upkeepNeeded = true;
            performData = abi.encode(upkeepData);
        }
    }
    
    /**
     * @dev Chainlink Keeper performUpkeep function
     * @param performData Encoded data from checkUpkeep
     */
    function performUpkeep(bytes calldata performData) external override onlyRole(KEEPER_ROLE) {
        require(!paused(), "ChainlinkKeepers: paused");
        
        UpkeepData memory upkeepData = abi.decode(performData, (UpkeepData));
        uint256 initialGas = gasleft();
        uint256 rebalancesExecuted = 0;
        
        for (uint256 i = 0; i < upkeepData.vaultsToRebalance.length; i++) {
            address vault = upkeepData.vaultsToRebalance[i];
            
            try this._performVaultUpkeep(vault) {
                rebalancesExecuted++;
                
                // Update health data
                vaultHealthData[vault] = VaultHealth({
                    isHealthy: true,
                    lastHealthCheck: block.timestamp,
                    totalChecks: vaultHealthData[vault].totalChecks + 1,
                    failedChecks: vaultHealthData[vault].failedChecks,
                    lastError: ""
                });
                
                emit HealthCheckPerformed(vault, true, "Rebalance executed successfully");
                
            } catch Error(string memory reason) {
                // Update health data with error
                VaultHealth storage health = vaultHealthData[vault];
                health.isHealthy = false;
                health.lastHealthCheck = block.timestamp;
                health.totalChecks += 1;
                health.failedChecks += 1;
                health.lastError = reason;
                
                emit HealthCheckPerformed(vault, false, reason);
            }
            
            lastCheckTime[vault] = block.timestamp;
        }
        
        // Update processed index for next batch
        uint256 newIndex = lastProcessedIndex + keeperConfig.maxVaultsPerUpkeep;
        if (newIndex >= managedVaults.length) {
            newIndex = 0; // Reset to beginning
        }
        lastProcessedIndex = newIndex;
        
        uint256 gasUsed = initialGas - gasleft();
        
        emit UpkeepPerformed(
            upkeepData.vaultsToRebalance.length,
            rebalancesExecuted,
            gasUsed
        );
    }
    
    /**
     * @dev Perform upkeep for a specific vault
     * @param vault Vault address
     */
    function _performVaultUpkeep(address vault) external {
        require(msg.sender == address(this), "ChainlinkKeepers: internal only");
        
        // Execute rebalancing
        rebalancingEngine.executeAutoRebalance(vault);
    }
    
    /**
     * @dev Check vault health and determine if action is needed
     * @param vault Vault address to check
     * @return needsAction Whether the vault needs attention
     * @return reason Reason why action is needed
     */
    function _checkVaultHealth(address vault) internal view returns (bool needsAction, string memory reason) {
        try IHyperIndexVault(vault).getVaultMetadata() returns (
            uint256 indexTokenId,
            uint256 totalAssets,
            uint256 totalShares,
            bool isPaused,
            uint256 managementFeeBps,
            uint256 performanceFeeBps
        ) {
            // Check if vault is paused
            if (isPaused) {
                return (false, "Vault is paused");
            }
            
            // Check if vault has assets
            if (totalAssets == 0) {
                return (false, "Vault has no assets");
            }
            
            // Check if rebalancing is needed
            try rebalancingEngine.checkRebalanceNeeded(vault) returns (
                bool needed,
                RebalancingEngine.RebalanceParams memory params
            ) {
                if (needed) {
                    return (true, "Rebalancing needed");
                }
            } catch {
                return (false, "Unable to check rebalance status");
            }
            
            return (false, "Vault is healthy");
            
        } catch Error(string memory err) {
            return (false, string(abi.encodePacked("Health check failed: ", err)));
        } catch {
            return (false, "Health check failed: unknown error");
        }
    }
    
    /**
     * @dev Add vault to managed list
     * @param vault Vault address to add
     */
    function addManagedVault(address vault) external onlyRole(VAULT_MANAGER_ROLE) {
        require(vault != address(0), "ChainlinkKeepers: invalid vault");
        require(!_isVaultManaged(vault), "ChainlinkKeepers: vault already managed");
        
        managedVaults.push(vault);
        
        // Initialize health data
        vaultHealthData[vault] = VaultHealth({
            isHealthy: true,
            lastHealthCheck: block.timestamp,
            totalChecks: 0,
            failedChecks: 0,
            lastError: ""
        });
        
        emit VaultAdded(vault, msg.sender);
    }
    
    /**
     * @dev Remove vault from managed list
     * @param vault Vault address to remove
     */
    function removeManagedVault(address vault) external onlyRole(VAULT_MANAGER_ROLE) {
        require(vault != address(0), "ChainlinkKeepers: invalid vault");
        
        // Find and remove vault
        for (uint256 i = 0; i < managedVaults.length; i++) {
            if (managedVaults[i] == vault) {
                managedVaults[i] = managedVaults[managedVaults.length - 1];
                managedVaults.pop();
                
                // Clean up data
                delete vaultHealthData[vault];
                delete lastCheckTime[vault];
                
                emit VaultRemoved(vault);
                return;
            }
        }
        
        revert("ChainlinkKeepers: vault not found");
    }
    
    /**
     * @dev Check if vault is managed
     * @param vault Vault address to check
     * @return managed Whether vault is managed
     */
    function _isVaultManaged(address vault) internal view returns (bool managed) {
        for (uint256 i = 0; i < managedVaults.length; i++) {
            if (managedVaults[i] == vault) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Update keeper configuration
     * @param checkInterval New check interval
     * @param maxVaultsPerUpkeep New max vaults per upkeep
     * @param gasLimit New gas limit
     * @param isActive New active status
     */
    function updateKeeperConfig(
        uint256 checkInterval,
        uint256 maxVaultsPerUpkeep,
        uint256 gasLimit,
        bool isActive
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(checkInterval >= 60, "ChainlinkKeepers: interval too short"); // Minimum 1 minute
        require(maxVaultsPerUpkeep > 0, "ChainlinkKeepers: max vaults must be positive");
        require(gasLimit >= 100000, "ChainlinkKeepers: gas limit too low");
        
        keeperConfig = KeeperConfig({
            checkInterval: checkInterval,
            maxVaultsPerUpkeep: maxVaultsPerUpkeep,
            gasLimit: gasLimit,
            isActive: isActive
        });
        
        emit KeeperConfigUpdated(checkInterval, maxVaultsPerUpkeep, gasLimit, isActive);
    }
    
    /**
     * @dev Get managed vaults list
     * @return vaults Array of managed vault addresses
     */
    function getManagedVaults() external view returns (address[] memory vaults) {
        return managedVaults;
    }
    
    /**
     * @dev Get vault health data
     * @param vault Vault address
     * @return health VaultHealth struct
     */
    function getVaultHealth(address vault) external view returns (VaultHealth memory health) {
        return vaultHealthData[vault];
    }
    
    /**
     * @dev Get keeper statistics
     * @return totalVaults Total managed vaults
     * @return healthyVaults Number of healthy vaults
     * @return nextCheckTime Time of next scheduled check
     */
    function getKeeperStats() external view returns (
        uint256 totalVaults,
        uint256 healthyVaults,
        uint256 nextCheckTime
    ) {
        totalVaults = managedVaults.length;
        
        for (uint256 i = 0; i < managedVaults.length; i++) {
            if (vaultHealthData[managedVaults[i]].isHealthy) {
                healthyVaults++;
            }
        }
        
        // Calculate next check time based on oldest vault
        uint256 oldestCheck = block.timestamp;
        for (uint256 i = 0; i < managedVaults.length; i++) {
            uint256 vaultLastCheck = lastCheckTime[managedVaults[i]];
            if (vaultLastCheck < oldestCheck) {
                oldestCheck = vaultLastCheck;
            }
        }
        
        nextCheckTime = oldestCheck + keeperConfig.checkInterval;
        if (nextCheckTime <= block.timestamp) {
            nextCheckTime = block.timestamp;
        }
    }
    
    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}