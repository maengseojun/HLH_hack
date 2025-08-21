// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// SafeMath not needed in Solidity 0.8+

import "../interfaces/IHyperCore.sol";
import "../interfaces/IComposer.sol";
import "../interfaces/IBridgeManager.sol";

/**
 * @title HyperliquidBridge
 * @dev Bridge contract for Hyperliquid native asset transfers with precision handling
 * Manages dust through Composer and handles evmExtraWeiDecimals for precise calculations
 */
contract HyperliquidBridge is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    // SafeMath usage removed (Solidity 0.8+ has built-in overflow checks)
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRIDGE_OPERATOR_ROLE = keccak256("BRIDGE_OPERATOR_ROLE");
    bytes32 public constant DUST_MANAGER_ROLE = keccak256("DUST_MANAGER_ROLE");
    
    // Core contracts
    IHyperCore public immutable hyperCore;
    IComposer public immutable composer;
    IBridgeManager public bridgeManager;
    
    // evmExtraWeiDecimals configuration (Hyperliquid native precision)
    mapping(address => uint8) public evmExtraWeiDecimals;
    mapping(address => uint32) public tokenAssetIndexMapping;
    mapping(bytes32 => uint256) public fundDustBalance;
    
    // Bridge tracking
    uint256 private _transferIdCounter;
    mapping(bytes32 => BridgeTransfer) private _bridgeTransfers;
    mapping(address => bytes32[]) private _userTransfers;
    
    // Configuration
    uint256 public dustThreshold = 1e12; // Minimum dust value worth processing
    uint256 public platformFeeRate = 100; // 1% in basis points
    address public feeRecipient;
    
    // Structs
    struct BridgeTransfer {
        bytes32 id;
        address token;
        address recipient;
        uint256 amount;
        uint256 adjustedAmount;
        uint256 dustAmount;
        uint32 assetIndex;
        uint256 timestamp;
        BridgeStatus status;
        uint256 fee;
        string failureReason;
    }
    
    enum BridgeStatus {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        CANCELLED
    }
    
    // Events
    event AssetTransferred(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 adjustedAmount,
        uint256 dustAmount
    );
    
    event DustProcessed(
        address indexed token,
        uint256 dustAmount,
        uint8 strategy,
        address recipient
    );
    
    event BridgeTransferInitiated(
        bytes32 indexed transferId,
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    event BridgeTransferCompleted(
        bytes32 indexed transferId,
        uint256 actualAmount,
        uint256 fee
    );
    
    event EVMExtraWeiDecimalsUpdated(
        address indexed token,
        uint8 oldDecimals,
        uint8 newDecimals
    );
    
    event FundDustAccumulated(
        bytes32 indexed fundId,
        uint256 dustValue
    );
    
    /**
     * @dev Constructor
     */
    constructor(
        address _hyperCore,
        address _composer,
        address _feeRecipient
    ) {
        require(_hyperCore != address(0), "HyperCore cannot be zero address");
        require(_composer != address(0), "Composer cannot be zero address");
        require(_feeRecipient != address(0), "Fee recipient cannot be zero address");
        
        hyperCore = IHyperCore(_hyperCore);
        composer = IComposer(_composer);
        feeRecipient = _feeRecipient;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_OPERATOR_ROLE, msg.sender);
        _grantRole(DUST_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @dev Transfer assets with Hyperliquid native precision handling
     */
    function transferAssetsWithPrecision(
        address[] memory tokens,
        uint256[] memory amounts,
        address recipient
    ) external whenNotPaused nonReentrant returns (bytes32 transferId) {
        require(tokens.length == amounts.length, "Array length mismatch");
        require(tokens.length > 0, "No tokens to transfer");
        require(recipient != address(0), "Invalid recipient");
        
        transferId = _generateTransferId();
        uint256 totalDust = 0;
        
        for (uint i = 0; i < tokens.length; i++) {
            if (amounts[i] > 0) {
                uint256 dustAmount = _transferWithPrecision(tokens[i], amounts[i], recipient);
                totalDust = totalDust.add(dustAmount);
                
                emit AssetTransferred(
                    tokens[i],
                    recipient,
                    amounts[i],
                    amounts[i].sub(dustAmount),
                    dustAmount
                );
            }
        }
        
        // Record bridge transfer
        _bridgeTransfers[transferId] = BridgeTransfer({
            id: transferId,
            token: tokens[0], // Primary token for reference
            recipient: recipient,
            amount: amounts[0], // Primary amount for reference
            adjustedAmount: amounts[0].sub(totalDust),
            dustAmount: totalDust,
            assetIndex: tokenAssetIndexMapping[tokens[0]],
            timestamp: block.timestamp,
            status: BridgeStatus.COMPLETED,
            fee: 0,
            failureReason: ""
        });
        
        _userTransfers[recipient].push(transferId);
        
        emit BridgeTransferCompleted(transferId, amounts[0].sub(totalDust), 0);
        
        return transferId;
    }
    
    /**
     * @dev Internal precision transfer with dust handling
     */
    function _transferWithPrecision(
        address token,
        uint256 amount,
        address recipient
    ) internal returns (uint256 dustAmount) {
        uint8 extraDecimals = evmExtraWeiDecimals[token];
        uint256 adjustedAmount = amount;
        
        if (extraDecimals > 0) {
            // Apply Hyperliquid precision adjustment
            uint256 divisor = 10 ** extraDecimals;
            adjustedAmount = amount.div(divisor).mul(divisor);
        }
        
        // Transfer the adjusted amount
        if (adjustedAmount > 0) {
            IERC20(token).safeTransfer(recipient, adjustedAmount);
        }
        
        // Calculate and handle dust
        dustAmount = amount.sub(adjustedAmount);
        if (dustAmount > 0 && dustAmount >= dustThreshold) {
            composer.handleDust(token, dustAmount, recipient);
        }
        
        return dustAmount;
    }
    
    /**
     * @dev Convert dust to HYPE token through Composer
     */
    function convertDustToHYPE(
        uint256 dustValue,
        address recipient
    ) external whenNotPaused onlyRole(DUST_MANAGER_ROLE) returns (uint256 hypeAmount) {
        require(dustValue > 0, "Dust value must be positive");
        require(recipient != address(0), "Invalid recipient");
        
        if (composer.isDustProcessingWorthwhile(dustValue)) {
            hypeAmount = composer.convertToHYPE(dustValue, recipient);
            emit DustProcessed(address(0), dustValue, 0, recipient);
        }
        
        return hypeAmount;
    }
    
    /**
     * @dev Accumulate dust for fund management
     */
    function accumulateDust(
        bytes32 fundId,
        uint256 dustValue
    ) external whenNotPaused onlyRole(DUST_MANAGER_ROLE) {
        require(fundId != bytes32(0), "Invalid fund ID");
        require(dustValue > 0, "Dust value must be positive");
        
        fundDustBalance[fundId] = fundDustBalance[fundId].add(dustValue);
        composer.accumulateDustForFund(fundId, dustValue);
        
        emit FundDustAccumulated(fundId, dustValue);
    }
    
    /**
     * @dev Convert dust to platform fee
     */
    function convertDustToPlatformFee(
        uint256 dustValue
    ) external whenNotPaused onlyRole(DUST_MANAGER_ROLE) returns (uint256 feeAmount) {
        require(dustValue > 0, "Dust value must be positive");
        
        feeAmount = composer.convertDustToPlatformFee(dustValue);
        emit DustProcessed(address(0), dustValue, 2, feeRecipient);
        
        return feeAmount;
    }
    
    /**
     * @dev Batch process dust with different strategies
     */
    function batchProcessDust(
        address[] memory tokens,
        uint256[] memory dustAmounts,
        address[] memory recipients,
        uint8[] memory strategies
    ) external whenNotPaused onlyRole(DUST_MANAGER_ROLE) returns (uint256[] memory processedAmounts) {
        require(
            tokens.length == dustAmounts.length &&
            dustAmounts.length == recipients.length &&
            recipients.length == strategies.length,
            "Array length mismatch"
        );
        
        processedAmounts = composer.batchProcessDust(tokens, dustAmounts, recipients, strategies);
        
        for (uint i = 0; i < tokens.length; i++) {
            emit DustProcessed(tokens[i], dustAmounts[i], strategies[i], recipients[i]);
        }
        
        return processedAmounts;
    }
    
    /**
     * @dev Distribute accumulated fund dust to participants
     */
    function distributeFundDust(
        bytes32 fundId,
        address[] memory participants,
        uint256[] memory shares
    ) external whenNotPaused onlyRole(DUST_MANAGER_ROLE) returns (uint256 totalDistributed) {
        require(fundId != bytes32(0), "Invalid fund ID");
        require(participants.length == shares.length, "Array length mismatch");
        require(fundDustBalance[fundId] > 0, "No dust to distribute");
        
        totalDistributed = composer.distributeFundDust(fundId, participants, shares);
        
        if (totalDistributed > 0) {
            fundDustBalance[fundId] = fundDustBalance[fundId].sub(
                totalDistributed > fundDustBalance[fundId] ? fundDustBalance[fundId] : totalDistributed
            );
        }
        
        return totalDistributed;
    }
    
    /**
     * @dev Calculate gas savings from precision handling
     */
    function calculateGasSavings(uint256 assetCount) external view returns (uint256 gasSaved) {
        // Estimate gas savings from precision handling and batch operations
        // This is a simplified calculation - real implementation would be more complex
        uint256 baseGasPerAsset = 21000; // Base gas cost per transfer
        uint256 precisionGasSavings = 5000; // Estimated savings per asset from precision handling
        
        gasSaved = assetCount.mul(precisionGasSavings);
        return gasSaved;
    }
    
    // View functions
    
    /**
     * @dev Get bridge transfer details
     */
    function getBridgeTransfer(bytes32 transferId) external view returns (BridgeTransfer memory) {
        return _bridgeTransfers[transferId];
    }
    
    /**
     * @dev Get user's bridge transfers
     */
    function getUserTransfers(address user) external view returns (bytes32[] memory) {
        return _userTransfers[user];
    }
    
    /**
     * @dev Get fund dust balance
     */
    function getFundDustBalance(bytes32 fundId) external view returns (uint256) {
        return fundDustBalance[fundId];
    }
    
    /**
     * @dev Check if precision adjustment is needed for token
     */
    function needsPrecisionAdjustment(address token) external view returns (bool) {
        return evmExtraWeiDecimals[token] > 0;
    }
    
    /**
     * @dev Calculate adjusted amount after precision handling
     */
    function calculateAdjustedAmount(
        address token,
        uint256 amount
    ) external view returns (uint256 adjustedAmount, uint256 dustAmount) {
        uint8 extraDecimals = evmExtraWeiDecimals[token];
        
        if (extraDecimals > 0) {
            uint256 divisor = 10 ** extraDecimals;
            adjustedAmount = amount.div(divisor).mul(divisor);
            dustAmount = amount.sub(adjustedAmount);
        } else {
            adjustedAmount = amount;
            dustAmount = 0;
        }
        
        return (adjustedAmount, dustAmount);
    }
    
    // Admin functions
    
    /**
     * @dev Set evmExtraWeiDecimals for a token
     */
    function setEVMExtraWeiDecimals(
        address token,
        uint8 decimals
    ) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        require(decimals <= 18, "Decimals too high");
        
        uint8 oldDecimals = evmExtraWeiDecimals[token];
        evmExtraWeiDecimals[token] = decimals;
        
        emit EVMExtraWeiDecimalsUpdated(token, oldDecimals, decimals);
    }
    
    /**
     * @dev Set token to asset index mapping
     */
    function setTokenAssetMapping(
        address token,
        uint32 assetIndex
    ) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        tokenAssetIndexMapping[token] = assetIndex;
    }
    
    /**
     * @dev Set bridge manager contract
     */
    function setBridgeManager(address _bridgeManager) external onlyRole(ADMIN_ROLE) {
        require(_bridgeManager != address(0), "Invalid bridge manager");
        bridgeManager = IBridgeManager(_bridgeManager);
    }
    
    /**
     * @dev Set dust threshold
     */
    function setDustThreshold(uint256 _threshold) external onlyRole(ADMIN_ROLE) {
        dustThreshold = _threshold;
    }
    
    /**
     * @dev Set platform fee rate
     */
    function setPlatformFeeRate(uint256 _rate) external onlyRole(ADMIN_ROLE) {
        require(_rate <= 1000, "Fee rate too high"); // Max 10%
        platformFeeRate = _rate;
    }
    
    /**
     * @dev Set fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyRole(ADMIN_ROLE) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Emergency pause
     */
    function emergencyPause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Emergency unpause
     */
    function emergencyUnpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Emergency withdraw accumulated dust
     */
    function emergencyWithdrawDust(
        bytes32 fundId,
        address recipient
    ) external onlyRole(ADMIN_ROLE) returns (uint256 withdrawnAmount) {
        require(recipient != address(0), "Invalid recipient");
        
        withdrawnAmount = composer.emergencyWithdrawDust(fundId, recipient);
        
        if (withdrawnAmount > 0) {
            fundDustBalance[fundId] = fundDustBalance[fundId].sub(
                withdrawnAmount > fundDustBalance[fundId] ? fundDustBalance[fundId] : withdrawnAmount
            );
        }
        
        return withdrawnAmount;
    }
    
    // Private functions
    
    /**
     * @dev Generate unique transfer ID
     */
    function _generateTransferId() private returns (bytes32) {
        _transferIdCounter++;
        return keccak256(abi.encodePacked(
            block.timestamp,
            block.difficulty,
            msg.sender,
            _transferIdCounter
        ));
    }
}