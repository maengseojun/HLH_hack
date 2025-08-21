// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IHyperIndexVault.sol";
import "./interfaces/IMultiChainAggregator.sol";

/**
 * @title RebalancingEngine
 * @dev Advanced rebalancing system for HyperIndex vaults
 * @notice Handles automatic and manual rebalancing with multi-chain aggregator integration
 */
contract RebalancingEngine is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    
    // Rebalancing parameters
    uint256 public constant REBALANCE_TOLERANCE_BPS = 300; // 3% tolerance
    uint256 public constant MIN_REBALANCE_AMOUNT = 1000; // Minimum amount to trigger rebalance
    uint256 public constant MAX_SLIPPAGE_BPS = 50; // 0.5% max slippage
    uint256 public constant REBALANCE_COOLDOWN = 1 hours; // Minimum time between rebalances
    
    // Aggregator for optimal swapping
    IMultiChainAggregator public immutable aggregator;
    
    // Rebalancing tracking
    mapping(address => uint256) public lastRebalanceTime;
    mapping(address => RebalanceMetrics) public vaultMetrics;
    
    struct RebalanceMetrics {
        uint256 totalRebalances;
        uint256 totalVolumeRebalanced;
        uint256 totalGasUsed;
        uint256 averageSlippage;
        uint256 lastRebalanceTimestamp;
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
    
    constructor(address _aggregator) {
        require(_aggregator != address(0), "RebalancingEngine: invalid aggregator");
        
        aggregator = IMultiChainAggregator(_aggregator);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
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
            if (currentRatio > targetRatio + REBALANCE_TOLERANCE_BPS) {
                // Find best target token (most underweight)
                uint256 bestTargetIndex = _findBestRebalanceTarget(data, i);
                
                if (bestTargetIndex != i) {
                    uint256 excessAmount = ((currentRatio - targetRatio) * data.totalValue) / 10000;
                    
                    if (excessAmount >= MIN_REBALANCE_AMOUNT) {
                        // Get quote from aggregator
                        (uint256 amountOut, bytes memory calldata_) = _getSwapQuote(
                            data.tokens[i],
                            data.tokens[bestTargetIndex],
                            excessAmount
                        );
                        
                        uint256 minAmountOut = (amountOut * (10000 - MAX_SLIPPAGE_BPS)) / 10000;
                        
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
            block.timestamp >= lastRebalanceTime[vault] + REBALANCE_COOLDOWN,
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
     * @dev Emergency function to force cooldown reset
     * @param vault Vault address
     */
    function resetRebalanceCooldown(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lastRebalanceTime[vault] = 0;
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