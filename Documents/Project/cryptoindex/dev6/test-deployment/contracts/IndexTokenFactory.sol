// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SmartIndexVault.sol";
import "./SecurityManager.sol";
import "./interfaces/IPriceFeed.sol";
import "./LiquidityAnalyzer.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IndexTokenFactory - Enhanced with Dynamic Minimum System
 * @dev Factory with Aave V3 style dynamic minimums and Balancer V2 partial deposits
 */
contract IndexTokenFactory is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RECIPE_ROLE = keccak256("RECIPE_ROLE");
    
    struct FundInfo {
        bytes32 fundId;
        string name;
        string symbol;
        address creator;
        address indexToken;
        bool isActive;
        bool isIssued;
        uint256 createdAt;
        uint256 currentMinimum;  // Dynamic minimum at creation time
        uint256 totalValue;
        uint256 totalSupply;     // Total index tokens issued
    }
    
    struct ComponentInfo {
        address tokenAddress;
        uint32 hyperliquidAssetIndex;
        uint256 targetRatio;         // Target ratio (basis points)
        uint256 depositedAmount;     // Currently deposited amount
        uint256 currentRatio;        // Current actual ratio
    }
    
    struct DepositInfo {
        address user;
        uint256 amount;
        uint256 timestamp;
        uint256 indexTokensReceived;
    }
    
    // State variables
    mapping(bytes32 => FundInfo) public funds;
    mapping(bytes32 => ComponentInfo[]) public fundComponents;
    mapping(bytes32 => mapping(address => uint256)) public userDeposits;
    mapping(bytes32 => DepositInfo[]) public depositHistory;
    mapping(address => mapping(address => bool)) public authorizedTokens;
    mapping(address => bytes32[]) public userFunds;
    
    uint256 private _totalFundsCount;
    
    // Contract references
    address public immutable vaultTemplate;
    IPriceFeed public immutable priceFeed;
    SecurityManager public immutable securityManager;
    LiquidityAnalyzer public immutable liquidityAnalyzer;
    
    // Events
    event FundCreated(
        bytes32 indexed fundId,
        address indexed creator,
        string name,
        string symbol,
        uint256 dynamicMinimum,
        string liquidityTier
    );
    
    event PartialDeposit(
        bytes32 indexed fundId,
        address indexed user,
        address token,
        uint256 amount,
        uint256 newRatio
    );
    
    event IndexTokensIssued(
        bytes32 indexed fundId,
        address indexed user,
        uint256 indexTokens,
        uint256 totalValue,
        uint256 minimumMet
    );
    
    event DynamicMinimumRecalculated(
        bytes32 indexed fundId,
        uint256 oldMinimum,
        uint256 newMinimum,
        string reason
    );

    constructor(
        address _vaultTemplate,
        address _priceFeed,
        address _securityManager,
        address _liquidityAnalyzer
    ) {
        vaultTemplate = _vaultTemplate;
        priceFeed = IPriceFeed(_priceFeed);
        securityManager = SecurityManager(_securityManager);
        liquidityAnalyzer = LiquidityAnalyzer(_liquidityAnalyzer);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(RECIPE_ROLE, msg.sender);
    }
    
    // ✅ CORE FIX: Enhanced fund creation with dynamic minimum
    function createIndex(
        ComponentInfo[] memory components,
        string memory name,
        string memory symbol
    ) external nonReentrant returns (bytes32) {
        require(components.length > 0 && components.length <= 10, "Invalid component count");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Invalid name/symbol");
        require(securityManager.checkSecurity(msg.sender), "Security check failed");
        
        // Verify component ratios total 100%
        uint256 totalRatio = 0;
        for (uint256 i = 0; i < components.length; i++) {
            require(components[i].targetRatio > 0, "Invalid target ratio");
            totalRatio += components[i].targetRatio;
        }
        require(totalRatio == 10000, "Total ratio must be 100%");
        
        // ✅ Calculate dynamic minimum using market analysis
        (uint256 dynamicMinimum, string memory tierName) = liquidityAnalyzer.calculateDynamicMinimum();
        
        // Generate unique fund ID
        bytes32 fundId = keccak256(
            abi.encodePacked(
                msg.sender,
                name,
                symbol,
                block.timestamp,
                _totalFundsCount
            )
        );
        
        // Create fund with dynamic minimum
        funds[fundId] = FundInfo({
            fundId: fundId,
            name: name,
            symbol: symbol,
            creator: msg.sender,
            indexToken: address(0),
            isActive: true,
            isIssued: false,
            createdAt: block.timestamp,
            currentMinimum: dynamicMinimum,
            totalValue: 0,
            totalSupply: 0
        });
        
        // Store components with initial ratios
        for (uint256 i = 0; i < components.length; i++) {
            ComponentInfo memory component = components[i];
            component.currentRatio = 0; // Start with 0, will update on deposit
            fundComponents[fundId].push(component);
        }
        
        _totalFundsCount++;
        userFunds[msg.sender].push(fundId);
        
        emit FundCreated(fundId, msg.sender, name, symbol, dynamicMinimum, tierName);
        
        return fundId;
    }
    
    // ✅ CORE FIX: Partial deposit support (Balancer V2 style)
    function depositToFund(
        bytes32 fundId,
        address token,
        uint256 amount
    ) external nonReentrant {
        require(funds[fundId].isActive, "Fund not active");
        require(amount > 0, "Invalid amount");
        require(securityManager.checkSecurity(msg.sender), "Security check failed");
        
        // Find component for this token
        int256 componentIndex = _findComponentIndex(fundId, token);
        require(componentIndex >= 0, "Token not in fund components");
        
        uint256 index = uint256(componentIndex);
        ComponentInfo storage component = fundComponents[fundId][index];
        
        // Transfer tokens from user
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        // Update component state
        component.depositedAmount += amount;
        userDeposits[fundId][msg.sender] += amount;
        
        // Recalculate current ratio
        uint256 totalFundValue = calculateTotalFundValue(fundId);
        if (totalFundValue > 0) {
            uint256 tokenValue = _getTokenValue(token, component.depositedAmount);
            component.currentRatio = (tokenValue * 10000) / totalFundValue;
        }
        
        // Update fund total value
        funds[fundId].totalValue = totalFundValue;
        
        // Record deposit
        depositHistory[fundId].push(DepositInfo({
            user: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            indexTokensReceived: 0 // Will be set when tokens are issued
        }));
        
        emit PartialDeposit(fundId, msg.sender, token, amount, component.currentRatio);
    }
    
    // ✅ CORE FIX: Enhanced token issuance with partial deposits
    function issueIndexTokens(bytes32 fundId) external nonReentrant returns (uint256) {
        FundInfo storage fund = funds[fundId];
        require(fund.isActive, "Fund not active");
        require(securityManager.checkSecurity(msg.sender), "Security check failed");
        
        // Calculate current total value
        uint256 totalValue = calculateTotalFundValue(fundId);
        require(totalValue > 0, "No value deposited");
        
        // ✅ Check against CURRENT dynamic minimum (recalculate if needed)
        (uint256 currentMinimum, string memory tierName) = liquidityAnalyzer.calculateDynamicMinimum();
        
        // Update minimum if significantly changed
        if (_shouldUpdateMinimum(fund.currentMinimum, currentMinimum)) {
            emit DynamicMinimumRecalculated(fundId, fund.currentMinimum, currentMinimum, "Market conditions changed");
            fund.currentMinimum = currentMinimum;
        }
        
        // ✅ BREAKTHROUGH: Allow issuance even with partial deposits if minimum is met
        require(totalValue >= fund.currentMinimum, "Below dynamic minimum requirement");
        
        // ✅ Calculate proportional tokens to issue (Yearn V3 style)
        uint256 indexTokensToIssue;
        
        if (fund.totalSupply == 0) {
            // First issuance: 1:1 ratio with total value (scaled to 18 decimals)
            indexTokensToIssue = totalValue * 1e12; // Convert 6 decimals (USDC) to 18 decimals
        } else {
            // Subsequent issuance: proportional to existing supply
            uint256 userContribution = userDeposits[fundId][msg.sender];
            require(userContribution > 0, "No deposits from user");
            
            indexTokensToIssue = (fund.totalSupply * userContribution) / fund.totalValue;
        }
        
        // Update fund state
        fund.totalSupply += indexTokensToIssue;
        fund.totalValue = totalValue;
        fund.isIssued = true;
        
        // Update deposit history
        uint256 depositCount = depositHistory[fundId].length;
        for (uint256 i = 0; i < depositCount; i++) {
            if (depositHistory[fundId][i].user == msg.sender && 
                depositHistory[fundId][i].indexTokensReceived == 0) {
                depositHistory[fundId][i].indexTokensReceived = indexTokensToIssue;
                break;
            }
        }
        
        // ✅ In production, would mint actual ERC20 tokens
        // For now, track in storage (would integrate with index token contract)
        
        emit IndexTokensIssued(fundId, msg.sender, indexTokensToIssue, totalValue, fund.currentMinimum);
        
        return indexTokensToIssue;
    }
    
    // ✅ Enhanced value calculation with multiple tokens
    function calculateTotalFundValue(bytes32 fundId) public view returns (uint256) {
        ComponentInfo[] memory components = fundComponents[fundId];
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < components.length; i++) {
            if (components[i].depositedAmount > 0) {
                uint256 tokenValue = _getTokenValue(
                    components[i].tokenAddress, 
                    components[i].depositedAmount
                );
                totalValue += tokenValue;
            }
        }
        
        return totalValue;
    }
    
    // ✅ Get current dynamic minimum for fund
    function getCurrentMinimum(bytes32 fundId) external view returns (uint256, string memory) {
        require(funds[fundId].isActive, "Fund not active");
        return liquidityAnalyzer.calculateDynamicMinimum();
    }
    
    // Helper functions
    function _findComponentIndex(bytes32 fundId, address token) internal view returns (int256) {
        ComponentInfo[] memory components = fundComponents[fundId];
        for (uint256 i = 0; i < components.length; i++) {
            if (components[i].tokenAddress == token) {
                return int256(i);
            }
        }
        return -1;
    }
    
    function _getTokenValue(address token, uint256 amount) internal view returns (uint256) {
        // Mock implementation - would use actual price feed
        if (token == address(0x22188e16527bC31851794cC18885e38AA833b5b7)) { // Mock USDC
            return amount; // 1:1 for USDC (6 decimals)
        } else {
            // For other tokens, use price feed (simplified)
            return amount * 2000; // Mock price
        }
    }
    
    function _shouldUpdateMinimum(uint256 oldMinimum, uint256 newMinimum) internal pure returns (bool) {
        // Update if change is more than 20%
        uint256 threshold = oldMinimum / 5; // 20%
        return (newMinimum > oldMinimum + threshold) || (newMinimum < oldMinimum - threshold);
    }
    
    // Getters
    function totalFunds() external view returns (uint256) {
        return _totalFundsCount;
    }
    
    function getFundInfo(bytes32 fundId) external view returns (FundInfo memory) {
        return funds[fundId];
    }
    
    function getFundComponents(bytes32 fundId) external view returns (ComponentInfo[] memory) {
        return fundComponents[fundId];
    }
    
    function getUserDeposit(bytes32 fundId, address user) external view returns (uint256) {
        return userDeposits[fundId][user];
    }
    
    function getDepositHistory(bytes32 fundId) external view returns (DepositInfo[] memory) {
        return depositHistory[fundId];
    }
}