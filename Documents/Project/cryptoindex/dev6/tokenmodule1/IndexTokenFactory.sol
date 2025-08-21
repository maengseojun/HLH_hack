// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./IndexToken.sol";
import "./interfaces/IL1Read.sol";
import "./interfaces/IIndexTokenFactory.sol";

/**
 * @title IndexTokenFactory
 * @dev Main factory contract for creating and managing index token funds
 * @notice This contract acts as a custody platform for tokenized index funds
 */
contract IndexTokenFactory is AccessControl, ReentrancyGuard, IIndexTokenFactory {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    
    // Role definitions
    bytes32 public constant RECIPE_CREATOR_ROLE = keccak256("RECIPE_CREATOR_ROLE");
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
    
    // Hyperliquid L1 Precompile address
    address constant L1_READ = 0x0000000000000000000000000000000000000807;
    
    struct IndexFund {
        string name;                 // "K-Crypto Top 4"
        string symbol;               // "KTOP4"
        address creator;             // 기관 주소
        ComponentToken[] components; // 구성 토큰들
        address indexTokenAddress;   // 발행된 ERC-20 주소
        uint256 totalSupply;         // 발행된 인덱스 토큰 총량
        uint256 createdAt;
        uint256 lastFeeCollection;   // 마지막 수수료 징수 시점
        bool isActive;
        bool isIssued;              // 토큰 발행 여부
    }
    
    // State variables
    mapping(bytes32 => IndexFund) public funds;
    mapping(address => bytes32[]) public creatorFunds; // 기관별 생성한 펀드들
    mapping(address => bool) public authorizedTokens; // 허용된 토큰 목록
    
    // Fee configuration
    uint256 public annualManagementFee = 50;  // 0.5% (기준: 10000)
    uint256 public issuanceFee = 10;          // 0.1% 발행 수수료
    address public feeRecipient;              // 수수료 수취 주소
    
    // Constants
    uint256 public constant MAX_COMPONENTS = 10;        // 최대 구성 요소 수
    uint256 public constant MIN_FUND_VALUE = 1000e18;   // 최소 펀드 가치 (USDC)
    uint256 public constant RATIO_BASE = 10000;         // 100% = 10000
    uint256 public constant PRICE_DECIMALS = 18;        // Price scaling
    
    /**
     * @dev Constructor
     * @param _feeRecipient Address to receive platform fees
     */
    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Fee recipient cannot be zero");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PLATFORM_ADMIN_ROLE, msg.sender);
        feeRecipient = _feeRecipient;
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
    ) external onlyRole(RECIPE_CREATOR_ROLE) returns (bytes32) {
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Name and symbol required");
        require(components.length > 0 && components.length <= MAX_COMPONENTS, "Invalid component count");
        
        // Validate component ratios sum to 100%
        uint256 totalRatio = 0;
        for (uint i = 0; i < components.length; i++) {
            require(components[i].tokenAddress != address(0), "Invalid token address");
            require(components[i].targetRatio > 0, "Ratio must be positive");
            require(authorizedTokens[components[i].tokenAddress], "Token not authorized");
            totalRatio = totalRatio.add(components[i].targetRatio);
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
        
        emit FundCreated(fundId, name, msg.sender);
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
    ) external nonReentrant {
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
                    fund.components[j].depositedAmount = fund.components[j].depositedAmount.add(amounts[i]);
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
    ) external onlyRole(PLATFORM_ADMIN_ROLE) nonReentrant {
        IndexFund storage fund = funds[fundId];
        require(fund.isActive && !fund.isIssued, "Invalid fund state");
        require(tokenSupply > 0, "Token supply must be positive");
        require(_hasMinimumDeposits(fundId), "Insufficient deposits");
        
        // Check minimum fund value
        uint256 totalValue = _calculateTotalFundValue(fundId);
        require(totalValue >= MIN_FUND_VALUE, "Fund value below minimum");
        
        // Deploy index token contract
        IndexToken indexToken = new IndexToken(
            fund.name,
            fund.symbol,
            fundId,
            address(this)
        );
        
        // Mint tokens to this contract (platform custody)
        indexToken.mint(address(this), tokenSupply);
        
        // Update fund state
        fund.indexTokenAddress = address(indexToken);
        fund.totalSupply = tokenSupply;
        fund.isIssued = true;
        fund.lastFeeCollection = block.timestamp;
        
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
        return totalValueUSDC.mul(1e18).div(fund.totalSupply);
    }
    
    /**
     * @dev Collect annual management fees (platform admin only)
     * @param fundId The fund to collect fees from
     */
    function collectManagementFee(bytes32 fundId) external onlyRole(PLATFORM_ADMIN_ROLE) {
        IndexFund storage fund = funds[fundId];
        require(fund.isIssued, "Fund not issued");
        
        uint256 timeSinceLastCollection = block.timestamp.sub(fund.lastFeeCollection);
        uint256 yearlySeconds = 365 * 24 * 60 * 60;
        
        // Allow fee collection if at least a month has passed
        if (timeSinceLastCollection >= yearlySeconds.div(12)) {
            uint256 feeRatio = annualManagementFee.mul(timeSinceLastCollection).div(yearlySeconds).div(RATIO_BASE);
            
            // Collect fees from each component
            for (uint i = 0; i < fund.components.length; i++) {
                ComponentToken storage component = fund.components[i];
                if (component.depositedAmount > 0) {
                    uint256 feeAmount = component.depositedAmount.mul(feeRatio).div(RATIO_BASE);
                    
                    if (feeAmount > 0) {
                        component.depositedAmount = component.depositedAmount.sub(feeAmount);
                        IERC20(component.tokenAddress).safeTransfer(feeRecipient, feeAmount);
                    }
                }
            }
            
            fund.lastFeeCollection = block.timestamp;
            emit ManagementFeeCollected(fundId, feeRatio);
        }
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
    ) external onlyRole(PLATFORM_ADMIN_ROLE) nonReentrant {
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
            fund.indexTokenAddress,
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
                // Get real-time price from Hyperliquid
                uint256 priceUSDC = IL1Read(L1_READ).getSpotPrice(component.hyperliquidAssetIndex);
                uint256 componentValueUSDC = component.depositedAmount.mul(priceUSDC).div(1e18);
                totalValueUSDC = totalValueUSDC.add(componentValueUSDC);
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
     * @dev Set fee parameters
     */
    function setFees(uint256 _managementFee, uint256 _issuanceFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_managementFee <= 200, "Management fee too high"); // Max 2%
        require(_issuanceFee <= 50, "Issuance fee too high"); // Max 0.5%
        
        annualManagementFee = _managementFee;
        issuanceFee = _issuanceFee;
    }
    
    /**
     * @dev Set fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Emergency pause/unpause fund
     */
    function setFundActive(bytes32 fundId, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        funds[fundId].isActive = active;
    }
}
