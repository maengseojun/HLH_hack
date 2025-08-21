// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// SafeMath not needed in Solidity 0.8+

import "./AutoCheckValidator.sol";
import "./PrecisionCalculator.sol";
import "./HyperliquidBridge.sol";
import "../interfaces/IRedemptionManager.sol";
import "../IndexTokenFactory.sol";
import "../IndexToken.sol";
import "../libraries/PrecisionMath.sol";

/**
 * @title RedemptionManager
 * @dev Main contract for managing institutional token redemption with Hyperliquid bridge integration
 */
contract RedemptionManager is IRedemptionManager, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    // SafeMath usage removed (Solidity 0.8+ has built-in overflow checks)
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Core contracts
    IndexTokenFactory public immutable factory;
    AutoCheckValidator public checklistValidator;
    PrecisionCalculator public precisionCalculator;
    HyperliquidBridge public hyperliquidBridge;
    
    // State variables
    uint256 private _requestIdCounter;
    mapping(uint256 => RedemptionRequest) private _redemptionRequests;
    mapping(address => uint256[]) private _userRequests;
    mapping(address => uint256) private _minimumRedemptionAmounts;
    mapping(address => uint256) private _maximumRedemptionAmounts;
    
    // Dust handling strategies
    enum DustStrategy {
        INSTANT_REFUND,    // Composer를 통해 즉시 HYPE로 환불
        ACCUMULATE,        // dust 누적 (나중에 일괄 분배)
        PLATFORM_FEE       // 플랫폼 수수료로 처리
    }
    
    // Extended result structure
    struct RedemptionResult {
        address[] assetTokens;
        uint256[] assetAmounts;
        uint256 dustRefund;
        uint256 totalGasSaved;
    }
    
    // Events
    event DustProcessed(
        bytes32 indexed fundId,
        uint256 dustValue,
        DustStrategy strategy
    );
    
    event RedemptionExecutedNative(
        bytes32 indexed fundId,
        address indexed requester,
        RedemptionResult result
    );
    
    /**
     * @dev Constructor
     */
    constructor(
        address _factory,
        address _validator,
        address _calculator,
        address _bridge
    ) {
        require(_factory != address(0), "Factory cannot be zero address");
        require(_validator != address(0), "Validator cannot be zero address");
        require(_calculator != address(0), "Calculator cannot be zero address");
        require(_bridge != address(0), "Bridge cannot be zero address");
        
        factory = IndexTokenFactory(_factory);
        checklistValidator = AutoCheckValidator(_validator);
        precisionCalculator = PrecisionCalculator(_calculator);
        hyperliquidBridge = HyperliquidBridge(_bridge);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Modifier to check if user is authorized to redeem tokens for a fund
     */
    modifier onlyAuthorizedRedeemer(bytes32 fundId) {
        (, , address creator, , , , bool isActive, bool isIssued) = factory.getFundInfo(fundId);
        require(creator == msg.sender, "Only fund creator can redeem");
        require(isActive && isIssued, "Fund not active or not issued");
        _;
    }
    
    /**
     * @dev Request token redemption (IRedemptionManager interface implementation)
     */
    function requestRedemption(
        address tokenAddress,
        uint256 tokenAmount
    ) external override whenNotPaused nonReentrant returns (uint256 requestId) {
        require(tokenAddress != address(0), "Invalid token address");
        require(tokenAmount > 0, "Amount must be positive");
        
        // Find fundId from token address
        bytes32 fundId = _findFundIdByToken(tokenAddress);
        require(fundId != bytes32(0), "Token not found in any fund");
        
        // Check eligibility
        (bool eligible, string memory reason) = isEligibleForRedemption(msg.sender, tokenAddress, tokenAmount);
        require(eligible, reason);
        
        // Create redemption request
        requestId = ++_requestIdCounter;
        
        _redemptionRequests[requestId] = RedemptionRequest({
            id: requestId,
            requester: msg.sender,
            tokenAddress: tokenAddress,
            tokenAmount: tokenAmount,
            underlyingAssetAmount: 0, // Will be calculated during execution
            timestamp: block.timestamp,
            status: RedemptionStatus.PENDING,
            bridgeTransactionHash: bytes32(0),
            failureReason: ""
        });
        
        _userRequests[msg.sender].push(requestId);
        
        emit RedemptionRequested(msg.sender, tokenAddress, tokenAmount, requestId, block.timestamp);
        
        return requestId;
    }
    
    /**
     * @dev Execute redemption (IRedemptionManager interface implementation)
     */
    function executeRedemption(
        uint256 requestId
    ) external override whenNotPaused nonReentrant returns (bool success) {
        RedemptionRequest storage request = _redemptionRequests[requestId];
        require(request.id != 0, "Request not found");
        require(request.status == RedemptionStatus.PENDING, "Invalid request status");
        require(
            request.requester == msg.sender || hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized to execute"
        );
        
        // Find fundId
        bytes32 fundId = _findFundIdByToken(request.tokenAddress);
        require(fundId != bytes32(0), "Fund not found");
        
        try this._executeRedemptionInternal(requestId, fundId) {
            request.status = RedemptionStatus.COMPLETED;
            return true;
        } catch Error(string memory reason) {
            request.status = RedemptionStatus.FAILED;
            request.failureReason = reason;
            emit RedemptionFailed(requestId, reason, block.timestamp);
            return false;
        }
    }
    
    /**
     * @dev Internal execution function
     */
    function _executeRedemptionInternal(uint256 requestId, bytes32 fundId) external {
        require(msg.sender == address(this), "Internal function");
        
        RedemptionRequest storage request = _redemptionRequests[requestId];
        request.status = RedemptionStatus.EXECUTING;
        
        // 1. Validate redemption
        require(
            checklistValidator.validateRedemption(fundId, request.tokenAmount, request.requester),
            "Validation failed"
        );
        
        // 2. Calculate precise redemption amounts
        (
            address[] memory assetTokens,
            uint256[] memory preciseAmounts,
            uint256 dustValue
        ) = precisionCalculator.calculatePreciseRedemption(fundId, request.tokenAmount);
        
        // Store total asset amount for the request
        uint256 totalAssetAmount = 0;
        for (uint i = 0; i < preciseAmounts.length; i++) {
            totalAssetAmount = totalAssetAmount.add(preciseAmounts[i]);
        }
        request.underlyingAssetAmount = totalAssetAmount;
        
        // 3. Burn index tokens
        IndexToken(request.tokenAddress).burn(request.requester, request.tokenAmount);
        
        // 4. Transfer assets through bridge
        bytes32 txHash = hyperliquidBridge.transferAssetsWithPrecision(
            assetTokens,
            preciseAmounts,
            request.requester
        );
        request.bridgeTransactionHash = txHash;
        
        // 5. Handle dust with default strategy (INSTANT_REFUND)
        uint256 dustRefund = _processDustStrategy(fundId, dustValue, DustStrategy.INSTANT_REFUND);
        
        // 6. Emit completion event
        emit RedemptionExecuted(
            requestId,
            request.tokenAddress,
            request.tokenAmount,
            request.underlyingAssetAmount,
            txHash
        );
    }
    
    /**
     * @dev Hyperliquid native redemption method (from your example)
     */
    function redeemTokensNative(
        bytes32 fundId,
        uint256 tokenAmount,
        DustStrategy dustStrategy
    ) external onlyAuthorizedRedeemer(fundId) whenNotPaused nonReentrant returns (RedemptionResult memory) {
        
        // 1. Auto checklist validation
        require(
            checklistValidator.validateRedemption(fundId, tokenAmount, msg.sender),
            "Validation failed"
        );
        
        // 2. Hyperliquid precision calculation
        (
            address[] memory assetTokens,
            uint256[] memory preciseAmounts,
            uint256 dustValue
        ) = precisionCalculator.calculatePreciseRedemption(fundId, tokenAmount);
        
        // 3. Burn ERC-20 tokens
        (, , , address indexTokenAddress, , , , ) = factory.getFundInfo(fundId);
        IndexToken(indexTokenAddress).burn(msg.sender, tokenAmount);
        
        // 4. Transfer assets through Hyperliquid Bridge
        hyperliquidBridge.transferAssetsWithPrecision(
            assetTokens,
            preciseAmounts,
            msg.sender
        );
        
        // 5. Process dust through Composer
        uint256 dustRefund = _processDustStrategy(fundId, dustValue, dustStrategy);
        
        // 6. Return result
        RedemptionResult memory result = RedemptionResult({
            assetTokens: assetTokens,
            assetAmounts: preciseAmounts,
            dustRefund: dustRefund,
            totalGasSaved: precisionCalculator.calculateGasSavings(assetTokens.length)
        });
        
        emit RedemptionExecutedNative(fundId, msg.sender, result);
        return result;
    }
    
    /**
     * @dev Process dust handling strategy
     */
    function _processDustStrategy(
        bytes32 fundId,
        uint256 dustValue,
        DustStrategy strategy
    ) internal returns (uint256 refundAmount) {
        if (dustValue == 0) return 0;
        
        if (strategy == DustStrategy.INSTANT_REFUND) {
            // Convert dust to HYPE through Composer
            refundAmount = hyperliquidBridge.convertDustToHYPE(dustValue, msg.sender);
        } else if (strategy == DustStrategy.ACCUMULATE) {
            // Accumulate dust for later batch distribution
            hyperliquidBridge.accumulateDust(fundId, dustValue);
        } else if (strategy == DustStrategy.PLATFORM_FEE) {
            // Convert dust to platform fee
            hyperliquidBridge.convertDustToPlatformFee(dustValue);
        }
        
        emit DustProcessed(fundId, dustValue, strategy);
        return refundAmount;
    }
    
    /**
     * @dev Batch redemption for gas optimization
     */
    function batchRedeemTokens(
        bytes32[] memory fundIds,
        uint256[] memory tokenAmounts,
        DustStrategy dustStrategy
    ) external whenNotPaused returns (RedemptionResult[] memory) {
        require(fundIds.length == tokenAmounts.length, "Array length mismatch");
        require(fundIds.length > 0, "No tokens to redeem");
        
        RedemptionResult[] memory results = new RedemptionResult[](fundIds.length);
        
        for (uint i = 0; i < fundIds.length; i++) {
            results[i] = redeemTokensNative(fundIds[i], tokenAmounts[i], dustStrategy);
        }
        
        return results;
    }
    
    /**
     * @dev Cancel redemption request
     */
    function cancelRedemption(
        uint256 requestId
    ) external override returns (bool success) {
        RedemptionRequest storage request = _redemptionRequests[requestId];
        require(request.id != 0, "Request not found");
        require(request.requester == msg.sender, "Not authorized");
        require(
            request.status == RedemptionStatus.PENDING || request.status == RedemptionStatus.VALIDATING,
            "Cannot cancel request"
        );
        
        request.status = RedemptionStatus.CANCELLED;
        return true;
    }
    
    // View functions implementation
    
    function getRedemptionRequest(
        uint256 requestId
    ) external view override returns (RedemptionRequest memory) {
        return _redemptionRequests[requestId];
    }
    
    function getActiveRedemptions(
        address user
    ) external view override returns (uint256[] memory requestIds) {
        uint256[] memory userRequests = _userRequests[user];
        uint256 activeCount = 0;
        
        // Count active requests
        for (uint i = 0; i < userRequests.length; i++) {
            RedemptionStatus status = _redemptionRequests[userRequests[i]].status;
            if (status != RedemptionStatus.COMPLETED && 
                status != RedemptionStatus.FAILED && 
                status != RedemptionStatus.CANCELLED) {
                activeCount++;
            }
        }
        
        // Build active requests array
        requestIds = new uint256[](activeCount);
        uint256 index = 0;
        for (uint i = 0; i < userRequests.length; i++) {
            RedemptionStatus status = _redemptionRequests[userRequests[i]].status;
            if (status != RedemptionStatus.COMPLETED && 
                status != RedemptionStatus.FAILED && 
                status != RedemptionStatus.CANCELLED) {
                requestIds[index] = userRequests[i];
                index++;
            }
        }
        
        return requestIds;
    }
    
    function calculateUnderlyingAmount(
        address tokenAddress,
        uint256 tokenAmount
    ) external view override returns (uint256 underlyingAmount) {
        bytes32 fundId = _findFundIdByToken(tokenAddress);
        require(fundId != bytes32(0), "Token not found");
        
        (, , uint256 totalValue) = precisionCalculator.calculatePreciseRedemption(fundId, tokenAmount);
        return totalValue;
    }
    
    function isEligibleForRedemption(
        address user,
        address tokenAddress,
        uint256 tokenAmount
    ) public view override returns (bool eligible, string memory reason) {
        // Check if token exists in any fund
        bytes32 fundId = _findFundIdByToken(tokenAddress);
        if (fundId == bytes32(0)) {
            return (false, "Token not found in any fund");
        }
        
        // Check fund status
        (, , , , , , bool isActive, bool isIssued) = factory.getFundInfo(fundId);
        if (!isActive) {
            return (false, "Fund is not active");
        }
        if (!isIssued) {
            return (false, "Fund tokens not issued yet");
        }
        
        // Check user balance
        uint256 userBalance = IERC20(tokenAddress).balanceOf(user);
        if (userBalance < tokenAmount) {
            return (false, "Insufficient token balance");
        }
        
        // Check minimum/maximum amounts
        uint256 minAmount = _minimumRedemptionAmounts[tokenAddress];
        uint256 maxAmount = _maximumRedemptionAmounts[tokenAddress];
        
        if (minAmount > 0 && tokenAmount < minAmount) {
            return (false, "Amount below minimum");
        }
        if (maxAmount > 0 && tokenAmount > maxAmount) {
            return (false, "Amount above maximum");
        }
        
        return (true, "");
    }
    
    // Token to fund mapping (should be updated when funds are created)
    mapping(address => bytes32) private _tokenToFundMapping;
    
    // Helper function to find fundId by token address
    function _findFundIdByToken(address tokenAddress) internal view returns (bytes32) {
        return _tokenToFundMapping[tokenAddress];
    }
    
    /**
     * @dev Register token to fund mapping (called by factory or admin)
     */
    function registerTokenMapping(
        address tokenAddress,
        bytes32 fundId
    ) external onlyRole(ADMIN_ROLE) {
        require(tokenAddress != address(0), "Invalid token address");
        require(fundId != bytes32(0), "Invalid fund ID");
        _tokenToFundMapping[tokenAddress] = fundId;
    }
    
    // Admin functions implementation
    
    function setChecklistValidator(address validator) external override onlyRole(ADMIN_ROLE) {
        require(validator != address(0), "Invalid validator address");
        checklistValidator = AutoCheckValidator(validator);
    }
    
    function setPrecisionCalculator(address calculator) external override onlyRole(ADMIN_ROLE) {
        require(calculator != address(0), "Invalid calculator address");
        precisionCalculator = PrecisionCalculator(calculator);
    }
    
    function setHyperliquidBridge(address bridge) external override onlyRole(ADMIN_ROLE) {
        require(bridge != address(0), "Invalid bridge address");
        hyperliquidBridge = HyperliquidBridge(bridge);
    }
    
    function setMinimumRedemptionAmount(
        address token,
        uint256 amount
    ) external override onlyRole(ADMIN_ROLE) {
        _minimumRedemptionAmounts[token] = amount;
    }
    
    function setMaximumRedemptionAmount(
        address token,
        uint256 amount
    ) external override onlyRole(ADMIN_ROLE) {
        _maximumRedemptionAmounts[token] = amount;
    }
    
    function emergencyPause() external override onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function emergencyUnpause() external override onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // State view functions implementation
    
    function isPaused() external view override returns (bool) {
        return paused();
    }
    
    function getChecklistValidator() external view override returns (address) {
        return address(checklistValidator);
    }
    
    function getPrecisionCalculator() external view override returns (address) {
        return address(precisionCalculator);
    }
    
    function getHyperliquidBridge() external view override returns (address) {
        return address(hyperliquidBridge);
    }
    
    function getMinimumRedemptionAmount(address token) external view override returns (uint256) {
        return _minimumRedemptionAmounts[token];
    }
    
    function getMaximumRedemptionAmount(address token) external view override returns (uint256) {
        return _maximumRedemptionAmounts[token];
    }
    
    function getTotalRedemptions() external view override returns (uint256) {
        return _requestIdCounter;
    }
}