// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
// SafeMath is not needed in Solidity 0.8+
import "./IndexToken.sol";
import "../interfaces/tokens/IPriceFeed.sol";
import "../interfaces/tokens/IIndexTokenFactory.sol";

/**
 * @title IndexTokenFactory
 * @dev Main factory contract for creating and managing index token funds
 * @notice This contract acts as a custody platform for tokenized index funds
 */
contract IndexTokenFactory is AccessControl, ReentrancyGuard, Pausable, IIndexTokenFactory {
    using SafeERC20 for IERC20;
    // SafeMath usage removed (Solidity 0.8+ has built-in overflow checks)
    
    // Role definitions
    bytes32 public constant RECIPE_CREATOR_ROLE = keccak256("RECIPE_CREATOR_ROLE");
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
    
    // Unified Price Feed Interface (replaces L1_READ)
    IPriceFeed public priceFeed;
    
    struct IndexFund {
        string name;                 // "K-Crypto Top 4"
        string symbol;               // "KTOP4"
        address creator;             // 기관 주소
        ComponentToken[] components; // 구성 토큰들
        address indexTokenAddress;   // 발행된 ERC-20 주소
        uint256 totalSupply;         // 발행된 인덱스 토큰 총량
        uint256 createdAt;
        bool isActive;
        bool isIssued;              // 토큰 발행 여부
    }
    
    // State variables
    mapping(bytes32 => IndexFund) public funds;
    mapping(address => bytes32[]) public creatorFunds; // 기관별 생성한 펀드들
    mapping(address => bool) public authorizedTokens; // 허용된 토큰 목록
    mapping(bytes32 => address) public fundIndexTokens; // fundId -> IndexToken 주소 매핑
    
    // IndexToken 템플릿 주소
    address public indexTokenImplementation;
    
    
    // Constants
    uint256 public constant MAX_COMPONENTS = 10;        // 최대 구성 요소 수
    uint256 public constant MIN_FUND_VALUE = 1000e18;   // 최소 펀드 가치 (USDC)
    uint256 public constant RATIO_BASE = 10000;         // 100% = 10000
    uint256 public constant PRICE_DECIMALS = 18;        // Price scaling
    
    /**
     * @dev Constructor
     * @param _priceFeed Address of the unified price feed contract
     */
    constructor(address _priceFeed) {
        require(_priceFeed != address(0), "Price feed cannot be zero");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PLATFORM_ADMIN_ROLE, msg.sender);
        priceFeed = IPriceFeed(_priceFeed);
        
        // Deploy IndexToken template for cloning
        indexTokenImplementation = address(new IndexToken());
    }
    
    /**
     * @dev Create a new index fund recipe (institutions only)
     * @param name Fund name
     * @param symbol Fund symbol
     * @param components Array of component tokens with ratios
     * @return fundId The unique identifier for the created fund
     */
    function createIndexFund(
        string memory name,
        string memory symbol,
        ComponentToken[] memory components
    ) external onlyRole(RECIPE_CREATOR_ROLE) whenNotPaused returns (bytes32) {
        // 1단계: 명시적 pause 상태 체크 (가장 먼저)
        require(!paused(), "IndexTokenFactory: Contract is paused");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Name and symbol required");
        require(components.length > 0 && components.length <= MAX_COMPONENTS, "Invalid component count");
        
        // Validate component ratios sum to 100%
        uint256 totalRatio = 0;
        for (uint i = 0; i < components.length; i++) {
            require(components[i].tokenAddress != address(0), "Invalid token address");
            require(components[i].targetRatio > 0, "Ratio must be positive");
            require(authorizedTokens[components[i].tokenAddress], "Token not authorized");
            totalRatio = totalRatio + components[i].targetRatio;
        }
        require(totalRatio == RATIO_BASE, "Total ratio must be 100%");
        
        // Generate unique fund ID
        bytes32 fundId = keccak256(abi.encodePacked(name, symbol, msg.sender, block.timestamp));
        require(funds[fundId].creator == address(0), "Fund ID already exists");
        
        // Initialize fund
        IndexFund storage fund = funds[fundId];
        fund.name = name;
        fund.symbol = symbol;
        fund.creator = msg.sender;
        fund.createdAt = block.timestamp;
        fund.isActive = true;
        fund.isIssued = false;
        
        // Copy components (depositedAmount starts at 0)
        for (uint i = 0; i < components.length; i++) {
            fund.components.push(ComponentToken({
                tokenAddress: components[i].tokenAddress,
                hyperliquidAssetIndex: components[i].hyperliquidAssetIndex,
                targetRatio: components[i].targetRatio,
                depositedAmount: 0
            }));
        }
        
        creatorFunds[msg.sender].push(fundId);
        
        // Create IndexToken using Clones pattern
        address indexTokenClone = Clones.clone(indexTokenImplementation);
        
        // Initialize the IndexToken
        IndexToken(indexTokenClone).initialize(
            name,
            symbol,
            address(this),
            fundId
        );
        
        // Store the mapping
        fundIndexTokens[fundId] = indexTokenClone;
        
        emit FundCreated(fundId, name, msg.sender);
        emit IndexTokenCreated(fundId, indexTokenClone, name, symbol);
        return fundId;
    }
    
    /**
     * @dev Deposit component tokens to the fund (creator only)
     * @param fundId The fund to deposit to
     * @param tokenAddresses Array of token addresses to deposit
     * @param amounts Array of amounts to deposit
     */
    function depositComponentTokens(
        bytes32 fundId,
        address[] memory tokenAddresses,
        uint256[] memory amounts
    ) external nonReentrant whenNotPaused {
        // 1단계: 명시적 pause 상태 체크
        require(!paused(), "IndexTokenFactory: Contract is paused");
        IndexFund storage fund = funds[fundId];
        require(fund.creator == msg.sender, "Only fund creator can deposit");
        require(fund.isActive && !fund.isIssued, "Invalid fund state");
        require(tokenAddresses.length == amounts.length, "Array length mismatch");
        require(tokenAddresses.length > 0, "No tokens to deposit");
        
        for (uint i = 0; i < tokenAddresses.length; i++) {
            require(amounts[i] > 0, "Amount must be positive");
            
            // Find matching component
            bool found = false;
            for (uint j = 0; j < fund.components.length; j++) {
                if (fund.components[j].tokenAddress == tokenAddresses[i]) {
                    // Transfer tokens to this contract
                    IERC20(tokenAddresses[i]).safeTransferFrom(msg.sender, address(this), amounts[i]);
                    fund.components[j].depositedAmount = fund.components[j].depositedAmount + amounts[i];
                    found = true;
                    break;
                }
            }
            require(found, "Token not in fund components");
            
            emit TokensDeposited(fundId, tokenAddresses[i], amounts[i]);
        }
    }
    
    /**
     * @dev Issue index tokens based on deposited assets (platform admin only)
     * @param fundId The fund to issue tokens for
     * @param tokenSupply Number of index tokens to issue
     */
    function issueIndexToken(
        bytes32 fundId,
        uint256 tokenSupply
    ) external onlyRole(PLATFORM_ADMIN_ROLE) nonReentrant whenNotPaused {
        // 1단계: 명시적 pause 상태 체크
        require(!paused(), "IndexTokenFactory: Contract is paused");
        IndexFund storage fund = funds[fundId];
        require(fund.isActive && !fund.isIssued, "Invalid fund state");
        require(tokenSupply > 0, "Token supply must be positive");
        require(_hasMinimumDeposits(fundId), "Insufficient deposits");
        
        // Check minimum fund value
        uint256 totalValue = _calculateTotalFundValue(fundId);
        require(totalValue >= MIN_FUND_VALUE, "Fund value below minimum");
        
        // Use existing IndexToken if already created, or create new one
        address indexTokenAddress = fundIndexTokens[fundId];
        if (indexTokenAddress == address(0)) {
            // Create IndexToken using Clones pattern
            indexTokenAddress = Clones.clone(indexTokenImplementation);
            
            // Initialize the IndexToken
            IndexToken(indexTokenAddress).initialize(
                fund.name,
                fund.symbol,
                address(this),
                fundId
            );
            
            // Store the mapping
            fundIndexTokens[fundId] = indexTokenAddress;
            emit IndexTokenCreated(fundId, indexTokenAddress, fund.name, fund.symbol);
        }
        
        IndexToken indexToken = IndexToken(indexTokenAddress);
        
        // Mint tokens to this contract (platform custody)
        indexToken.mint(address(this), tokenSupply);
        
        // Update fund state
        fund.indexTokenAddress = address(indexToken);
        fund.totalSupply = tokenSupply;
        fund.isIssued = true;
        
        emit IndexTokenIssued(fundId, address(indexToken), tokenSupply);
    }
    
    /**
     * @dev Calculate NAV per token in USDC
     * @param fundId The fund to calculate NAV for
     * @return NAV per token (scaled by 1e18)
     */
    function calculateNAV(bytes32 fundId) public view override returns (uint256) {
        IndexFund storage fund = funds[fundId];
        require(fund.isIssued, "Fund not issued yet");
        require(fund.totalSupply > 0, "No tokens issued");
        
        uint256 totalValueUSDC = _calculateTotalFundValue(fundId);
        return totalValueUSDC * 1e18 / fund.totalSupply;
    }
    
    
    /**
     * @dev Transfer index tokens from platform to recipient
     * @param fundId The fund to transfer tokens for
     * @param to Recipient address
     * @param amount Amount of tokens to transfer
     */
    function transferIndexTokens(
        bytes32 fundId,
        address to,
        uint256 amount
    ) external onlyRole(PLATFORM_ADMIN_ROLE) nonReentrant whenNotPaused {
        // 1단계: 명시적 pause 상태 체크
        require(!paused(), "IndexTokenFactory: Contract is paused");
        IndexFund storage fund = funds[fundId];
        require(fund.isIssued, "Fund not issued");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        
        IERC20(fund.indexTokenAddress).safeTransfer(to, amount);
    }
    
    /**
     * @dev Get fund information
     */
    function getFundInfo(bytes32 fundId) external view override returns (
        string memory name,
        string memory symbol,
        address creator,
        address indexToken,
        uint256 totalSupply,
        uint256 nav,
        bool isActive,
        bool isIssued
    ) {
        IndexFund storage fund = funds[fundId];
        uint256 navValue = fund.isIssued ? calculateNAV(fundId) : 0;
        
        return (
            fund.name,
            fund.symbol,
            fund.creator,
            fundIndexTokens[fundId],
            fund.totalSupply,
            navValue,
            fund.isActive,
            fund.isIssued
        );
    }
    
    /**
     * @dev Get fund components
     */
    function getFundComponents(bytes32 fundId) external view override returns (ComponentToken[] memory) {
        return funds[fundId].components;
    }
    
    /**
     * @dev Get funds created by an address
     */
    function getCreatorFunds(address creator) external view returns (bytes32[] memory) {
        return creatorFunds[creator];
    }
    
    /**
     * @dev Calculate total fund value in USDC
     */
    function _calculateTotalFundValue(bytes32 fundId) internal view returns (uint256) {
        IndexFund storage fund = funds[fundId];
        uint256 totalValueUSDC = 0;
        
        for (uint i = 0; i < fund.components.length; i++) {
            ComponentToken storage component = fund.components[i];
            if (component.depositedAmount > 0) {
                // Get real-time price from unified price feed
                uint256 priceUSDC = priceFeed.getPrice(component.hyperliquidAssetIndex);
                uint256 componentValueUSDC = component.depositedAmount * priceUSDC / 1e18;
                totalValueUSDC = totalValueUSDC + componentValueUSDC;
            }
        }
        
        return totalValueUSDC;
    }
    
    /**
     * @dev Check if fund has minimum deposits for all components
     */
    function _hasMinimumDeposits(bytes32 fundId) internal view returns (bool) {
        IndexFund storage fund = funds[fundId];
        
        for (uint i = 0; i < fund.components.length; i++) {
            if (fund.components[i].depositedAmount == 0) {
                return false;
            }
        }
        return true;
    }
    
    // Admin functions
    
    /**
     * @dev Grant recipe creator role
     */
    function grantRecipeCreatorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RECIPE_CREATOR_ROLE, account);
    }
    
    /**
     * @dev Authorize token for use in funds
     */
    function authorizeToken(address tokenAddress, bool authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddress != address(0), "Invalid token address");
        authorizedTokens[tokenAddress] = authorized;
    }
    
    
    /**
     * @dev Set price feed address for system upgrades
     */
    function setPriceFeedAddress(address _priceFeed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_priceFeed != address(0), "Invalid price feed address");
        address oldPriceFeed = address(priceFeed);
        priceFeed = IPriceFeed(_priceFeed);
        
        emit PriceFeedUpdated(oldPriceFeed, _priceFeed);
    }
    
    /**
     * @dev Check liquidity availability before issuing tokens
     */
    function checkLiquidityRequirements(bytes32 fundId) external view returns (bool sufficient, string memory reason) {
        IndexFund storage fund = funds[fundId];
        require(fund.isActive, "Fund not active");
        
        for (uint i = 0; i < fund.components.length; i++) {
            ComponentToken storage component = fund.components[i];
            
            // Check if asset is supported and has valid price
            (bool isSupported, bool hasValidPrice) = priceFeed.isAssetSupported(component.hyperliquidAssetIndex);
            if (!isSupported || !hasValidPrice) {
                return (false, "Asset not supported or price unavailable");
            }
            
            // Check liquidity info
            IPriceFeed.LiquidityInfo memory liquidityInfo = priceFeed.getLiquidityInfo(component.hyperliquidAssetIndex);
            if (liquidityInfo.totalLiquidity < component.depositedAmount) {
                return (false, "Insufficient liquidity for redemption");
            }
        }
        
        return (true, "");
    }
    
    /**
     * @dev Emergency pause/unpause fund
     */
    function setFundActive(bytes32 fundId, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        funds[fundId].isActive = active;
    }
    
    /**
     * @dev Authorize a token for use in index funds
     * @param tokenAddress Address of the token to authorize
     */
    function authorizeToken(address tokenAddress) external onlyRole(PLATFORM_ADMIN_ROLE) {
        require(tokenAddress != address(0), "Token address cannot be zero");
        authorizedTokens[tokenAddress] = true;
        emit TokenAuthorized(tokenAddress, msg.sender);
    }
    
    /**
     * @dev Revoke authorization for a token
     * @param tokenAddress Address of the token to revoke
     */
    function revokeToken(address tokenAddress) external onlyRole(PLATFORM_ADMIN_ROLE) {
        require(tokenAddress != address(0), "Token address cannot be zero");
        authorizedTokens[tokenAddress] = false;
        emit TokenRevoked(tokenAddress, msg.sender);
    }
    
    // Emergency pause/unpause functions
    
    /**
     * @dev Emergency pause all contract operations
     * Only DEFAULT_ADMIN_ROLE can pause
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Unpause contract operations
     * Only DEFAULT_ADMIN_ROLE can unpause
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Check if contract is currently paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
    
    // Additional Events for new functionality
    event PriceFeedUpdated(address indexed oldPriceFeed, address indexed newPriceFeed);
    event LiquidityCheckFailed(bytes32 indexed fundId, string reason);
    event TokenAuthorized(address indexed tokenAddress, address indexed authorizer);
    event TokenRevoked(address indexed tokenAddress, address indexed revoker);
    event EmergencyPaused(address indexed admin, uint256 timestamp);
    event EmergencyUnpaused(address indexed admin, uint256 timestamp);
}
