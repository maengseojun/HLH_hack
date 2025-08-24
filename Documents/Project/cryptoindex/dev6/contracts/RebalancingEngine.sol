// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IHyperIndexVault.sol";
import "./interfaces/IMultiChainAggregator.sol";
import "./interfaces/IPriceFeed.sol";
import "./CrossChainVaultManager.sol";

/**
 * @title RebalancingEngine
 * @dev Advanced rebalancing system for HyperIndex vaults
 * @notice Handles automatic and manual rebalancing with multi-chain aggregator integration
 */
contract RebalancingEngine is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // Enhanced rebalancing parameters
    uint256 public rebalanceTolerance = 300; // 3% tolerance (adjustable)
    uint256 public minRebalanceAmount = 1000e18; // Minimum amount to trigger rebalance
    uint256 public maxSlippage = 50; // 0.5% max slippage (adjustable)
    uint256 public rebalanceCooldown = 1 hours; // Minimum time between rebalances
    uint256 public emergencyThreshold = 1000; // 10% emergency threshold
    
    // Contract references
    IMultiChainAggregator public immutable aggregator;
    IPriceFeed public priceFeed;
    CrossChainVaultManager public crossChainManager;
    
    // Enhanced tracking
    mapping(address => uint256) public lastRebalanceTime;
    mapping(address => RebalanceMetrics) public vaultMetrics;
    mapping(bytes32 => VaultStrategy) public vaultStrategies; // fundId => strategy
    mapping(address => bool) public emergencyMode;
    mapping(uint256 => GovernanceProposal) public governanceProposals;
    
    uint256 private nextProposalId = 1;
    uint256 public constant GOVERNANCE_DELAY = 2 days;
    uint256 public constant PROPOSAL_THRESHOLD = 7 days;
    
    struct RebalanceMetrics {
        uint256 totalRebalances;
        uint256 totalVolumeRebalanced;
        uint256 totalGasUsed;
        uint256 averageSlippage;
        uint256 lastRebalanceTimestamp;
        uint256 emergencyRebalances;
        uint256 crossChainRebalances;
    }
    
    struct VaultStrategy {
        RebalanceStrategy strategy;
        uint256 customTolerance;
        uint256 customMinAmount;
        bool crossChainEnabled;
        uint256[] allowedChains;
        bool autoRebalanceEnabled;
        uint256 lastStrategyUpdate;
    }
    
    struct GovernanceProposal {
        uint256 id;
        ProposalType proposalType;
        address target;
        bytes data;
        uint256 value;
        address proposer;
        uint256 startTime;
        uint256 endTime;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        mapping(address => bool) hasVoted;
    }
    
    enum RebalanceStrategy {
        CONSERVATIVE,    // Larger tolerance, less frequent
        AGGRESSIVE,      // Smaller tolerance, more frequent  
        ADAPTIVE,        // Dynamic based on market conditions
        CROSS_CHAIN,     // Include cross-chain opportunities
        EMERGENCY_ONLY   // Only emergency rebalances
    }
    
    enum ProposalType {
        UPDATE_TOLERANCE,
        UPDATE_STRATEGY,
        EMERGENCY_ACTION,
        PARAMETER_CHANGE
    }
    
    struct RebalanceParams {
        address vault;
        address fromToken;
        address toToken;
        uint256 amount;
        uint256 minAmountOut;
        bytes aggregatorCalldata;
    }
    
    struct AllocationData {
        address[] tokens;
        uint256[] currentBalances;
        uint256[] targetAllocations;
        uint256 totalValue;
    }
    
    // Events
    event AutoRebalanceExecuted(
        address indexed vault,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippage
    );
    
    event ManualRebalanceExecuted(
        address indexed vault,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        address executor
    );
    
    event RebalanceThresholdUpdated(
        address indexed vault,
        uint256 oldThreshold,
        uint256 newThreshold
    );
    
    event RebalanceFailed(
        address indexed vault,
        address indexed fromToken,
        address indexed toToken,
        uint256 amount,
        string reason
    );
    
    event StrategyUpdated(
        bytes32 indexed fundId,
        RebalanceStrategy oldStrategy,
        RebalanceStrategy newStrategy,
        uint256 tolerance
    );
    
    event EmergencyRebalanceTriggered(
        address indexed vault,
        uint256 deviation,
        uint256 amount
    );
    
    event CrossChainRebalanceInitiated(
        bytes32 indexed fundId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount
    );
    
    event GovernanceProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string description
    );
    
    event GovernanceProposalExecuted(
        uint256 indexed proposalId,
        bool success
    );
    
    constructor(
        address _aggregator,
        address _priceFeed,
        address _crossChainManager
    ) {
        require(_aggregator != address(0), "Invalid aggregator");
        require(_priceFeed != address(0), "Invalid price feed");
        
        aggregator = IMultiChainAggregator(_aggregator);
        priceFeed = IPriceFeed(_priceFeed);
        if (_crossChainManager != address(0)) {
            crossChainManager = CrossChainVaultManager(_crossChainManager);
        }
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
    }
    
    /**
     * @dev Check if vault needs rebalancing
     * @param vault Vault address to check
     * @return needed Whether rebalancing is needed
     * @return rebalanceParams Parameters for the rebalance
     */
    function checkRebalanceNeeded(address vault) 
        external 
        view 
        returns (bool needed, RebalanceParams memory rebalanceParams) 
    {
        require(vault != address(0), "RebalancingEngine: invalid vault");
        
        // Get allocation data
        AllocationData memory data = _getAllocationData(vault);
        
        // Check each token for deviation
        for (uint256 i = 0; i < data.tokens.length; i++) {
            uint256 currentRatio = (data.currentBalances[i] * 10000) / data.totalValue;
            uint256 targetRatio = data.targetAllocations[i];
            
            // Check if deviation exceeds tolerance
            if (currentRatio > targetRatio + rebalanceTolerance) {
                // Find best target token (most underweight)
                uint256 bestTargetIndex = _findBestRebalanceTarget(data, i);
                
                if (bestTargetIndex != i) {
                    uint256 excessAmount = ((currentRatio - targetRatio) * data.totalValue) / 10000;
                    
                    if (excessAmount >= minRebalanceAmount) {
                        // Get quote from aggregator
                        (uint256 amountOut, bytes memory calldata_) = _getSwapQuote(
                            data.tokens[i],
                            data.tokens[bestTargetIndex],
                            excessAmount
                        );
                        
                        uint256 minAmountOut = (amountOut * (10000 - maxSlippage)) / 10000;
                        
                        rebalanceParams = RebalanceParams({
                            vault: vault,
                            fromToken: data.tokens[i],
                            toToken: data.tokens[bestTargetIndex],
                            amount: excessAmount,
                            minAmountOut: minAmountOut,
                            aggregatorCalldata: calldata_
                        });
                        
                        needed = true;
                        break;
                    }
                }
            }
        }
    }
    
    /**
     * @dev Execute automatic rebalancing
     * @param vault Vault to rebalance
     */
    function executeAutoRebalance(address vault) 
        external 
        onlyRole(KEEPER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(vault != address(0), "RebalancingEngine: invalid vault");
        require(
            block.timestamp >= lastRebalanceTime[vault] + rebalanceCooldown,
            "RebalancingEngine: cooldown not met"
        );
        
        (bool needed, RebalanceParams memory params) = this.checkRebalanceNeeded(vault);
        require(needed, "RebalancingEngine: rebalance not needed");
        
        _executeRebalance(params, true);
        lastRebalanceTime[vault] = block.timestamp;
    }
    
    /**
     * @dev Execute manual rebalancing
     * @param params Rebalance parameters
     */
    function executeManualRebalance(RebalanceParams calldata params) 
        external 
        onlyRole(REBALANCER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(params.vault != address(0), "RebalancingEngine: invalid vault");
        require(params.amount > 0, "RebalancingEngine: invalid amount");
        
        _executeRebalance(params, false);
    }
    
    /**
     * @dev Internal function to execute rebalance
     * @param params Rebalance parameters
     * @param isAutomatic Whether this is an automatic rebalance
     */
    function _executeRebalance(RebalanceParams memory params, bool isAutomatic) internal {
        uint256 initialGas = gasleft();
        
        try this._performSwap(params) {
            // Update metrics
            RebalanceMetrics storage metrics = vaultMetrics[params.vault];
            metrics.totalRebalances++;
            metrics.lastRebalanceTimestamp = block.timestamp;
            metrics.totalGasUsed += (initialGas - gasleft());
            
            if (isAutomatic) {
                emit AutoRebalanceExecuted(
                    params.vault,
                    params.fromToken,
                    params.toToken,
                    params.amount,
                    params.minAmountOut,
                    0 // TODO: Calculate actual slippage
                );
            } else {
                emit ManualRebalanceExecuted(
                    params.vault,
                    params.fromToken,
                    params.toToken,
                    params.amount,
                    params.minAmountOut,
                    msg.sender
                );
            }
        } catch Error(string memory reason) {
            emit RebalanceFailed(
                params.vault,
                params.fromToken,
                params.toToken,
                params.amount,
                reason
            );
            revert(reason);
        }
    }
    
    /**
     * @dev Perform the actual swap through aggregator
     * @param params Rebalance parameters
     */
    function _performSwap(RebalanceParams calldata params) external {
        require(msg.sender == address(this), "RebalancingEngine: internal only");
        
        // Get tokens from vault
        IERC20(params.fromToken).safeTransferFrom(
            params.vault,
            address(this),
            params.amount
        );
        
        // Approve aggregator
        IERC20(params.fromToken).forceApprove(address(aggregator), params.amount);
        
        // Execute swap - temporarily mock implementation for compilation
        // uint256 amountOut = aggregator.swap(
        //     params.fromToken,
        //     params.toToken,
        //     params.amount,
        //     params.minAmountOut,
        //     params.aggregatorCalldata
        // );
        uint256 amountOut = params.amount; // Mock 1:1 swap for compilation
        
        // Send tokens back to vault
        IERC20(params.toToken).safeTransfer(params.vault, amountOut);
        
        // Clean up approvals
        IERC20(params.fromToken).forceApprove(address(aggregator), 0);
    }
    
    /**
     * @dev Get allocation data for a vault
     * @param vault Vault address
     * @return data AllocationData struct
     */
    function _getAllocationData(address vault) internal view returns (AllocationData memory data) {
        IHyperIndexVault vaultContract = IHyperIndexVault(vault);
        
        (
            address[] memory tokens,
            uint256[] memory currentRatios,
            uint256[] memory targetRatios
        ) = vaultContract.getAllocationRatios();
        
        data.tokens = tokens;
        data.targetAllocations = targetRatios;
        data.currentBalances = new uint256[](tokens.length);
        
        // Calculate current balances and total value
        for (uint256 i = 0; i < tokens.length; i++) {
            data.currentBalances[i] = IERC20(tokens[i]).balanceOf(vault);
            data.totalValue += data.currentBalances[i];
        }
    }
    
    /**
     * @dev Find the best token to rebalance to (most underweight)
     * @param data Allocation data
     * @param excludeIndex Index to exclude from consideration
     * @return bestIndex Index of best target token
     */
    function _findBestRebalanceTarget(AllocationData memory data, uint256 excludeIndex) 
        internal 
        pure 
        returns (uint256 bestIndex) 
    {
        uint256 maxUnderweight = 0;
        bestIndex = excludeIndex; // Default to same index
        
        for (uint256 i = 0; i < data.tokens.length; i++) {
            if (i == excludeIndex) continue;
            
            uint256 currentRatio = (data.currentBalances[i] * 10000) / data.totalValue;
            uint256 targetRatio = data.targetAllocations[i];
            
            if (targetRatio > currentRatio) {
                uint256 underweight = targetRatio - currentRatio;
                if (underweight > maxUnderweight) {
                    maxUnderweight = underweight;
                    bestIndex = i;
                }
            }
        }
    }
    
    /**
     * @dev Get swap quote from aggregator
     * @param fromToken Token to sell
     * @param toToken Token to buy
     * @param amount Amount to sell
     * @return amountOut Expected amount out
     * @return calldata_ Calldata for the swap
     */
    function _getSwapQuote(address fromToken, address toToken, uint256 amount) 
        internal 
        view 
        returns (uint256 amountOut, bytes memory calldata_) 
    {
        // return aggregator.getQuote(fromToken, toToken, amount);
        // Mock implementation for compilation
        return (amount, ""); // 1:1 quote with empty calldata
    }
    
    /**
     * @dev Get vault rebalancing metrics
     * @param vault Vault address
     * @return metrics RebalanceMetrics struct
     */
    function getVaultMetrics(address vault) external view returns (RebalanceMetrics memory metrics) {
        return vaultMetrics[vault];
    }
    
    /**
     * @dev Batch check rebalancing for multiple vaults
     * @param vaults Array of vault addresses
     * @return needsRebalance Array indicating which vaults need rebalancing
     */
    function batchCheckRebalanceNeeded(address[] calldata vaults) 
        external 
        view 
        returns (bool[] memory needsRebalance) 
    {
        needsRebalance = new bool[](vaults.length);
        
        for (uint256 i = 0; i < vaults.length; i++) {
            (needsRebalance[i], ) = this.checkRebalanceNeeded(vaults[i]);
        }
    }
    
    /**
     * @dev Set vault rebalancing strategy
     * @param fundId Fund identifier
     * @param strategy Rebalancing strategy
     * @param customTolerance Custom tolerance (0 for default)
     * @param crossChainEnabled Whether to enable cross-chain rebalancing
     * @param allowedChains Array of allowed chain IDs for cross-chain
     */
    function setVaultStrategy(
        bytes32 fundId,
        RebalanceStrategy strategy,
        uint256 customTolerance,
        bool crossChainEnabled,
        uint256[] memory allowedChains
    ) external onlyRole(GOVERNANCE_ROLE) {
        VaultStrategy storage vaultStrategy = vaultStrategies[fundId];
        
        RebalanceStrategy oldStrategy = vaultStrategy.strategy;
        vaultStrategy.strategy = strategy;
        vaultStrategy.customTolerance = customTolerance;
        vaultStrategy.crossChainEnabled = crossChainEnabled;
        vaultStrategy.allowedChains = allowedChains;
        vaultStrategy.autoRebalanceEnabled = (strategy != RebalanceStrategy.EMERGENCY_ONLY);
        vaultStrategy.lastStrategyUpdate = block.timestamp;
        
        emit StrategyUpdated(fundId, oldStrategy, strategy, customTolerance);
    }
    
    /**
     * @dev Enhanced rebalance check with strategy consideration
     * @param vault Vault address
     * @param fundId Fund identifier
     * @return needed Whether rebalancing is needed
     * @return params Rebalance parameters
     */
    function checkAdvancedRebalanceNeeded(
        address vault,
        bytes32 fundId
    ) external view returns (bool needed, RebalanceParams memory params) {
        VaultStrategy storage strategy = vaultStrategies[fundId];
        
        // Check if auto rebalancing is enabled
        if (!strategy.autoRebalanceEnabled) {
            return (false, params);
        }
        
        // Get effective tolerance based on strategy
        uint256 tolerance = _getEffectiveTolerance(strategy);
        
        // Check cooldown based on strategy
        uint256 cooldown = _getEffectiveCooldown(strategy);
        if (block.timestamp < lastRebalanceTime[vault] + cooldown) {
            return (false, params);
        }
        
        // Get allocation data with price-based valuation
        AllocationData memory data = _getEnhancedAllocationData(vault, fundId);
        
        // Apply strategy-specific logic
        return _checkRebalanceByStrategy(vault, fundId, strategy, tolerance, data);
    }
    
    /**
     * @dev Execute emergency rebalancing
     * @param vault Vault address
     * @param fundId Fund identifier
     */
    function executeEmergencyRebalance(
        address vault,
        bytes32 fundId
    ) external onlyRole(REBALANCER_ROLE) whenNotPaused {
        // Check if emergency conditions are met
        AllocationData memory data = _getEnhancedAllocationData(vault, fundId);
        uint256 maxDeviation = _getMaxDeviation(data);
        
        require(maxDeviation > emergencyThreshold, "Emergency threshold not met");
        
        // Set emergency mode
        emergencyMode[vault] = true;
        
        // Calculate emergency rebalance
        (bool needed, RebalanceParams memory params) = _calculateEmergencyRebalance(vault, data);
        
        if (needed) {
            // Use higher slippage tolerance for emergency
            params.minAmountOut = (params.minAmountOut * 9500) / 10000; // 5% emergency slippage
            
            _executeRebalance(params, true);
            
            // Update metrics
            vaultMetrics[vault].emergencyRebalances++;
            
            emit EmergencyRebalanceTriggered(vault, maxDeviation, params.amount);
        }
        
        // Reset emergency mode after successful rebalance
        emergencyMode[vault] = false;
    }
    
    /**
     * @dev Execute cross-chain rebalancing
     * @param fundId Fund identifier
     * @param fromChain Source chain
     * @param toChain Target chain
     * @param amount Amount to rebalance
     */
    function executeCrossChainRebalance(
        bytes32 fundId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount
    ) external onlyRole(KEEPER_ROLE) whenNotPaused {
        require(address(crossChainManager) != address(0), "Cross-chain manager not set");
        
        VaultStrategy storage strategy = vaultStrategies[fundId];
        require(strategy.crossChainEnabled, "Cross-chain rebalancing disabled");
        
        // Check if chains are allowed
        bool fromChainAllowed = false;
        bool toChainAllowed = false;
        
        for (uint i = 0; i < strategy.allowedChains.length; i++) {
            if (strategy.allowedChains[i] == fromChain) fromChainAllowed = true;
            if (strategy.allowedChains[i] == toChain) toChainAllowed = true;
        }
        
        require(fromChainAllowed && toChainAllowed, "Chain not allowed");
        
        // Check if cross-chain rebalance is beneficial
        (bool needed, uint256 fromChainVault, uint256 toChainVault, uint256 adjustedAmount) = 
            crossChainManager.checkRebalanceNeeded(fundId);
        
        require(needed, "Cross-chain rebalance not needed");
        require(adjustedAmount >= minRebalanceAmount, "Amount below minimum");
        
        // Execute cross-chain rebalance
        crossChainManager.executeAutoRebalance(fundId);
        
        // Update metrics
        RebalanceMetrics storage metrics = vaultMetrics[address(0)]; // Global metrics
        metrics.crossChainRebalances++;
        
        emit CrossChainRebalanceInitiated(fundId, fromChain, toChain, adjustedAmount);
    }
    
    /**
     * @dev Create governance proposal
     * @param proposalType Type of proposal
     * @param target Target address
     * @param data Call data
     * @param description Proposal description
     * @return proposalId Proposal identifier
     */
    function createGovernanceProposal(
        ProposalType proposalType,
        address target,
        bytes memory data,
        string memory description
    ) external onlyRole(GOVERNANCE_ROLE) returns (uint256 proposalId) {
        proposalId = nextProposalId++;
        
        GovernanceProposal storage proposal = governanceProposals[proposalId];
        proposal.id = proposalId;
        proposal.proposalType = proposalType;
        proposal.target = target;
        proposal.data = data;
        proposal.proposer = msg.sender;
        proposal.startTime = block.timestamp + GOVERNANCE_DELAY;
        proposal.endTime = block.timestamp + GOVERNANCE_DELAY + PROPOSAL_THRESHOLD;
        
        emit GovernanceProposalCreated(proposalId, msg.sender, proposalType, description);
    }
    
    /**
     * @dev Internal function to get effective tolerance based on strategy
     */
    function _getEffectiveTolerance(VaultStrategy storage strategy) internal view returns (uint256) {
        if (strategy.customTolerance > 0) {
            return strategy.customTolerance;
        }
        
        if (strategy.strategy == RebalanceStrategy.CONSERVATIVE) {
            return rebalanceTolerance * 2; // 6% for conservative
        } else if (strategy.strategy == RebalanceStrategy.AGGRESSIVE) {
            return rebalanceTolerance / 2; // 1.5% for aggressive
        } else if (strategy.strategy == RebalanceStrategy.ADAPTIVE) {
            // Dynamic tolerance based on market volatility
            return _calculateAdaptiveTolerance();
        }
        
        return rebalanceTolerance; // Default
    }
    
    /**
     * @dev Internal function to get effective cooldown based on strategy
     */
    function _getEffectiveCooldown(VaultStrategy storage strategy) internal view returns (uint256) {
        if (strategy.strategy == RebalanceStrategy.CONSERVATIVE) {
            return rebalanceCooldown * 4; // 4 hours for conservative
        } else if (strategy.strategy == RebalanceStrategy.AGGRESSIVE) {
            return rebalanceCooldown / 2; // 30 minutes for aggressive
        }
        
        return rebalanceCooldown; // Default
    }
    
    /**
     * @dev Calculate adaptive tolerance based on market conditions
     */
    function _calculateAdaptiveTolerance() internal view returns (uint256) {
        // Simple volatility-based tolerance calculation
        // In production, this would use more sophisticated volatility metrics
        return rebalanceTolerance; // Placeholder for now
    }
    
    /**
     * @dev Get enhanced allocation data with real-time pricing
     */
    function _getEnhancedAllocationData(
        address vault,
        bytes32 fundId
    ) internal view returns (AllocationData memory data) {
        IHyperIndexVault vaultContract = IHyperIndexVault(vault);
        
        (
            address[] memory tokens,
            uint256[] memory currentRatios,
            uint256[] memory targetRatios
        ) = vaultContract.getAllocationRatios();
        
        data.tokens = tokens;
        data.targetAllocations = targetRatios;
        data.currentBalances = new uint256[](tokens.length);
        
        // Calculate current balances with real-time pricing
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(vault);
            
            // Get real-time price if available
            if (address(priceFeed) != address(0)) {
                try priceFeed.getPrice(uint32(i)) returns (uint256 price) {
                    data.currentBalances[i] = balance * price / 1e18;
                } catch {
                    data.currentBalances[i] = balance; // Fallback to raw balance
                }
            } else {
                data.currentBalances[i] = balance;
            }
            
            data.totalValue += data.currentBalances[i];
        }
    }
    
    /**
     * @dev Check rebalance needs based on strategy
     */
    function _checkRebalanceByStrategy(
        address vault,
        bytes32 fundId,
        VaultStrategy storage strategy,
        uint256 tolerance,
        AllocationData memory data
    ) internal view returns (bool needed, RebalanceParams memory params) {
        uint256 maxDeviation = _getMaxDeviation(data);
        
        // Emergency check
        if (maxDeviation > emergencyThreshold) {
            return _calculateEmergencyRebalance(vault, data);
        }
        
        // Regular strategy-based check
        if (maxDeviation > tolerance) {
            (uint256 fromIndex, uint256 toIndex, uint256 amount) = _findOptimalRebalance(data, tolerance);
            
            if (amount >= (strategy.customMinAmount > 0 ? strategy.customMinAmount : minRebalanceAmount)) {
                params = RebalanceParams({
                    vault: vault,
                    fromToken: data.tokens[fromIndex],
                    toToken: data.tokens[toIndex],
                    amount: amount,
                    minAmountOut: _calculateMinAmountOut(amount),
                    aggregatorCalldata: ""
                });
                needed = true;
            }
        }
    }
    
    /**
     * @dev Get maximum deviation in the allocation
     */
    function _getMaxDeviation(AllocationData memory data) internal pure returns (uint256 maxDeviation) {
        if (data.totalValue == 0) return 0;
        
        for (uint i = 0; i < data.tokens.length; i++) {
            uint256 currentRatio = (data.currentBalances[i] * 10000) / data.totalValue;
            uint256 targetRatio = data.targetAllocations[i];
            
            uint256 deviation = currentRatio > targetRatio ? 
                currentRatio - targetRatio : 
                targetRatio - currentRatio;
            
            if (deviation > maxDeviation) {
                maxDeviation = deviation;
            }
        }
    }
    
    /**
     * @dev Calculate emergency rebalance parameters
     */
    function _calculateEmergencyRebalance(
        address vault,
        AllocationData memory data
    ) internal view returns (bool needed, RebalanceParams memory params) {
        (uint256 fromIndex, uint256 toIndex, uint256 amount) = _findOptimalRebalance(data, emergencyThreshold);
        
        if (amount > 0) {
            params = RebalanceParams({
                vault: vault,
                fromToken: data.tokens[fromIndex],
                toToken: data.tokens[toIndex],
                amount: amount,
                minAmountOut: _calculateMinAmountOut(amount),
                aggregatorCalldata: ""
            });
            needed = true;
        }
    }
    
    /**
     * @dev Find optimal rebalance between tokens
     */
    function _findOptimalRebalance(
        AllocationData memory data,
        uint256 threshold
    ) internal pure returns (uint256 fromIndex, uint256 toIndex, uint256 amount) {
        if (data.totalValue == 0) return (0, 0, 0);
        
        uint256 maxOverweight = 0;
        uint256 maxUnderweight = 0;
        
        // Find most overweight and underweight tokens
        for (uint i = 0; i < data.tokens.length; i++) {
            uint256 currentRatio = (data.currentBalances[i] * 10000) / data.totalValue;
            uint256 targetRatio = data.targetAllocations[i];
            
            if (currentRatio > targetRatio + threshold) {
                uint256 overweight = currentRatio - targetRatio;
                if (overweight > maxOverweight) {
                    maxOverweight = overweight;
                    fromIndex = i;
                }
            } else if (currentRatio < targetRatio - threshold) {
                uint256 underweight = targetRatio - currentRatio;
                if (underweight > maxUnderweight) {
                    maxUnderweight = underweight;
                    toIndex = i;
                }
            }
        }
        
        // Calculate rebalance amount
        if (maxOverweight > 0 && maxUnderweight > 0) {
            uint256 rebalanceRatio = maxOverweight < maxUnderweight ? maxOverweight : maxUnderweight;
            amount = (rebalanceRatio * data.totalValue) / 20000; // Move half the deviation
        }
    }
    
    /**
     * @dev Calculate minimum amount out with slippage
     */
    function _calculateMinAmountOut(uint256 amount) internal view returns (uint256) {
        return (amount * (10000 - maxSlippage)) / 10000;
    }
    
    /**
     * @dev Emergency function to force cooldown reset
     * @param vault Vault address
     */
    function resetRebalanceCooldown(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lastRebalanceTime[vault] = 0;
    }
    
    /**
     * @dev Update rebalancing parameters
     * @param newTolerance New rebalance tolerance
     * @param newMinAmount New minimum rebalance amount
     * @param newMaxSlippage New maximum slippage
     * @param newCooldown New cooldown period
     */
    function updateRebalancingParameters(
        uint256 newTolerance,
        uint256 newMinAmount,
        uint256 newMaxSlippage,
        uint256 newCooldown
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(newTolerance <= 2000, "Tolerance too high"); // Max 20%
        require(newMaxSlippage <= 1000, "Slippage too high"); // Max 10%
        
        rebalanceTolerance = newTolerance;
        minRebalanceAmount = newMinAmount;
        maxSlippage = newMaxSlippage;
        rebalanceCooldown = newCooldown;
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