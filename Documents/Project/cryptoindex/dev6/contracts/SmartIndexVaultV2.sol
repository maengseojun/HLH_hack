// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SmartIndexVaultV2
 * @dev Upgradeable version of SmartIndexVault using UUPS proxy pattern
 * @notice ERC-4626 compliant tokenized vault with upgrade capability
 */
contract SmartIndexVaultV2 is 
    Initializable,
    ERC4626Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20 for IERC20;
    
    // Role definitions
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // State variables (use storage gaps for upgradeability)
    uint256 public managementFee;
    uint256 public performanceFee;
    uint256 public lastHarvestTime;
    uint256 public lastTotalAssets;
    uint256 public highWaterMark;
    address public emergencyWithdrawalRecipient;
    
    // Constants
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MAX_MANAGEMENT_FEE = 500;
    uint256 public constant MAX_PERFORMANCE_FEE = 3000;
    
    // Storage gap for future upgrades
    uint256[44] private __gap;
    
    // Events
    event Harvest(uint256 profit, uint256 performanceFeeAmount, uint256 timestamp);
    event ManagementFeeUpdated(uint256 oldFee, uint256 newFee);
    event PerformanceFeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyWithdrawal(address token, uint256 amount, address recipient);
    event StrategyExecuted(string strategyName, uint256 timestamp);
    event VaultUpgraded(address implementation, uint256 version);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the vault (replaces constructor)
     * @param _asset The underlying asset token
     * @param _name Vault share token name
     * @param _symbol Vault share token symbol
     */
    function initialize(
        IERC20 _asset,
        string memory _name,
        string memory _symbol
    ) public initializer {
        __ERC4626_init(_asset);
        __ERC20_init(_name, _symbol);
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        managementFee = 200; // 2% annual
        performanceFee = 2000; // 20% of profits
        lastHarvestTime = block.timestamp;
        lastTotalAssets = 0;
        highWaterMark = 0;
        emergencyWithdrawalRecipient = msg.sender;
    }
    
    /**
     * @dev Authorize upgrade (only UPGRADER_ROLE)
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {
        emit VaultUpgraded(newImplementation, block.timestamp);
    }
    
    /**
     * @dev Returns the total assets under management
     */
    function totalAssets() public view override returns (uint256) {
        uint256 baseAssets = super.totalAssets();
        uint256 accruedFees = _calculateAccruedManagementFee();
        return baseAssets > accruedFees ? baseAssets - accruedFees : 0;
    }
    
    /**
     * @dev Deposit with reentrancy and pause protection
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        return super.deposit(assets, receiver);
    }
    
    /**
     * @dev Mint with reentrancy and pause protection
     */
    function mint(uint256 shares, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        return super.mint(shares, receiver);
    }
    
    /**
     * @dev Withdraw with reentrancy protection
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }
    
    /**
     * @dev Redeem with reentrancy protection
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }
    
    /**
     * @dev Harvest yields and collect fees
     */
    function harvest() external onlyRole(MANAGER_ROLE) {
        uint256 currentAssets = totalAssets();
        uint256 profit = 0;
        
        if (currentAssets > highWaterMark) {
            profit = currentAssets - highWaterMark;
            highWaterMark = currentAssets;
        }
        
        uint256 performanceFeeAmount = 0;
        if (profit > 0) {
            performanceFeeAmount = (profit * performanceFee) / FEE_DENOMINATOR;
            IERC20(asset()).safeTransfer(msg.sender, performanceFeeAmount);
        }
        
        uint256 managementFeeAmount = _calculateAccruedManagementFee();
        if (managementFeeAmount > 0) {
            IERC20(asset()).safeTransfer(msg.sender, managementFeeAmount);
        }
        
        lastHarvestTime = block.timestamp;
        lastTotalAssets = currentAssets - performanceFeeAmount - managementFeeAmount;
        
        emit Harvest(profit, performanceFeeAmount, block.timestamp);
    }
    
    /**
     * @dev Calculate accrued management fee
     */
    function _calculateAccruedManagementFee() private view returns (uint256) {
        uint256 timePassed = block.timestamp - lastHarvestTime;
        uint256 currentAssets = super.totalAssets();
        
        uint256 feeAmount = (currentAssets * managementFee * timePassed) / 
                           (FEE_DENOMINATOR * SECONDS_PER_YEAR);
        
        return feeAmount;
    }
    
    /**
     * @dev Update management fee
     */
    function setManagementFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_MANAGEMENT_FEE, "Fee too high");
        uint256 oldFee = managementFee;
        managementFee = newFee;
        emit ManagementFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Update performance fee
     */
    function setPerformanceFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_PERFORMANCE_FEE, "Fee too high");
        uint256 oldFee = performanceFee;
        performanceFee = newFee;
        emit PerformanceFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Execute yield strategy
     */
    function executeStrategy(string memory strategyName) 
        external 
        onlyRole(STRATEGIST_ROLE) 
        whenNotPaused 
    {
        // Strategy implementation would go here
        emit StrategyExecuted(strategyName, block.timestamp);
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause operations
     */
    function unpause() external onlyRole(EMERGENCY_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Emergency withdrawal of stuck tokens
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        require(token != asset(), "Cannot withdraw vault asset");
        IERC20(token).safeTransfer(emergencyWithdrawalRecipient, amount);
        emit EmergencyWithdrawal(token, amount, emergencyWithdrawalRecipient);
    }
    
    /**
     * @dev Set emergency withdrawal recipient
     */
    function setEmergencyRecipient(address recipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(recipient != address(0), "Invalid recipient");
        emergencyWithdrawalRecipient = recipient;
    }
    
    /**
     * @dev Returns contract version for upgrade tracking
     */
    function version() public pure returns (string memory) {
        return "2.0.0";
    }
    
    /**
     * @dev Max deposit when paused returns 0
     */
    function maxDeposit(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }
    
    /**
     * @dev Max mint when paused returns 0
     */
    function maxMint(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }
    
    /**
     * @dev Max withdraw when paused returns 0
     */
    function maxWithdraw(address owner) public view override returns (uint256) {
        return paused() ? 0 : super.maxWithdraw(owner);
    }
    
    /**
     * @dev Max redeem when paused returns 0
     */
    function maxRedeem(address owner) public view override returns (uint256) {
        return paused() ? 0 : super.maxRedeem(owner);
    }
}
