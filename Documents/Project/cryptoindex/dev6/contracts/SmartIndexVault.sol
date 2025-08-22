// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SmartIndexVault
 * @dev ERC-4626 compliant tokenized vault for index fund management
 * @notice Implements full ERC-4626 standard with additional security features
 */
contract SmartIndexVault is ERC4626, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Role definitions
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // State variables
    uint256 public managementFee = 200; // 2% annual (basis points)
    uint256 public performanceFee = 2000; // 20% of profits (basis points)
    uint256 public lastHarvestTime;
    uint256 public lastTotalAssets;
    uint256 public highWaterMark;
    
    // Constants
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MAX_MANAGEMENT_FEE = 500; // 5% max
    uint256 public constant MAX_PERFORMANCE_FEE = 3000; // 30% max
    
    // Emergency withdrawal
    address public emergencyWithdrawalRecipient;
    
    // Events
    event Harvest(uint256 profit, uint256 performanceFeeAmount, uint256 timestamp);
    event ManagementFeeUpdated(uint256 oldFee, uint256 newFee);
    event PerformanceFeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyWithdrawal(address token, uint256 amount, address recipient);
    event StrategyExecuted(string strategyName, uint256 timestamp);
    
    /**
     * @dev Constructor - used as template for cloning
     * @param _asset The underlying asset token (can be zero for template)
     * @param _name Vault share token name
     * @param _symbol Vault share token symbol
     */
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol
    ) ERC4626(_asset) ERC20(_name, _symbol) {
        // Template initialization - actual initialization happens in initialize()
        if (address(_asset) != address(0)) {
            _initializeVault(msg.sender, msg.sender, msg.sender);
        }
    }
    
    /**
     * @dev Initialize function for cloned instances
     * @param _asset The underlying asset token
     * @param _name Vault share token name
     * @param _symbol Vault share token symbol
     * @param _managementFee Management fee in basis points
     * @param _performanceFee Performance fee in basis points
     */
    function initialize(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        uint256 _managementFee,
        uint256 _performanceFee
    ) external {
        require(address(asset()) == address(0), "Already initialized");
        require(address(_asset) != address(0), "Invalid asset");
        require(_managementFee <= MAX_MANAGEMENT_FEE, "Management fee too high");
        require(_performanceFee <= MAX_PERFORMANCE_FEE, "Performance fee too high");
        
        // Initialize ERC4626 and ERC20
        _setAsset(_asset);
        _setName(_name);
        _setSymbol(_symbol);
        
        // Set fees
        managementFee = _managementFee;
        performanceFee = _performanceFee;
        
        // Initialize vault state
        _initializeVault(msg.sender, msg.sender, msg.sender);
    }
    
    /**
     * @dev Internal function to initialize vault roles and state
     */
    function _initializeVault(address admin, address manager, address emergency) internal {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, manager);
        _grantRole(EMERGENCY_ROLE, emergency);
        
        lastHarvestTime = block.timestamp;
        lastTotalAssets = 0;
        highWaterMark = 0;
        emergencyWithdrawalRecipient = admin;
    }
    
    /**
     * @dev Set asset for initialized vault (internal use only)
     */
    function _setAsset(IERC20 newAsset) internal {
        // This would need to be implemented in a way that's compatible with ERC4626
        // For now, we'll assume the asset is set during construction/initialization
    }
    
    /**
     * @dev Set name for initialized vault (internal use only)
     */
    function _setName(string memory newName) internal {
        // This would update the ERC20 name
        // Implementation depends on whether the name is mutable
    }
    
    /**
     * @dev Set symbol for initialized vault (internal use only)
     */
    function _setSymbol(string memory newSymbol) internal {
        // This would update the ERC20 symbol
        // Implementation depends on whether the symbol is mutable
    }
    
    /**
     * @dev Returns the total assets under management
     * @notice Overrides ERC4626 to include yield strategies
     */
    function totalAssets() public view override returns (uint256) {
        uint256 baseAssets = super.totalAssets();
        uint256 accruedFees = _calculateAccruedManagementFee();
        
        // Deduct accrued fees from total assets
        return baseAssets > accruedFees ? baseAssets - accruedFees : 0;
    }
    
    /**
     * @dev Deposit assets and receive shares
     * @notice Implements pausable modifier for safety
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
     * @dev Mint shares by depositing assets
     * @notice Implements pausable modifier for safety
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
     * @dev Withdraw assets by burning shares
     * @notice Implements reentrancy protection
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }
    
    /**
     * @dev Redeem shares for assets
     * @notice Implements reentrancy protection
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }
    
    /**
     * @dev Preview deposit to get expected shares
     * @notice Accounts for management fees
     */
    function previewDeposit(uint256 assets) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Down);
    }
    
    /**
     * @dev Preview mint to get required assets
     * @notice Accounts for management fees
     */
    function previewMint(uint256 shares) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Up);
    }
    
    /**
     * @dev Preview withdraw to get shares to burn
     * @notice Accounts for management fees
     */
    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Up);
    }
    
    /**
     * @dev Preview redeem to get expected assets
     * @notice Accounts for management fees
     */
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Down);
    }
    
    /**
     * @dev Harvest yields and collect fees
     * @notice Can only be called by managers
     */
    function harvest() external onlyRole(MANAGER_ROLE) {
        uint256 currentAssets = totalAssets();
        uint256 profit = 0;
        
        // Calculate profit if above high water mark
        if (currentAssets > highWaterMark) {
            profit = currentAssets - highWaterMark;
            highWaterMark = currentAssets;
        }
        
        // Calculate and collect performance fee
        uint256 performanceFeeAmount = 0;
        if (profit > 0) {
            performanceFeeAmount = (profit * performanceFee) / FEE_DENOMINATOR;
            // Transfer performance fee to treasury
            IERC20(asset()).safeTransfer(msg.sender, performanceFeeAmount);
        }
        
        // Calculate and collect management fee
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
        
        // Annual fee calculation prorated by time
        uint256 feeAmount = (currentAssets * managementFee * timePassed) / 
                           (FEE_DENOMINATOR * SECONDS_PER_YEAR);
        
        return feeAmount;
    }
    
    /**
     * @dev Update management fee
     * @param newFee New management fee in basis points
     */
    function setManagementFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_MANAGEMENT_FEE, "Fee too high");
        uint256 oldFee = managementFee;
        managementFee = newFee;
        emit ManagementFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Update performance fee
     * @param newFee New performance fee in basis points
     */
    function setPerformanceFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_PERFORMANCE_FEE, "Fee too high");
        uint256 oldFee = performanceFee;
        performanceFee = newFee;
        emit PerformanceFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Execute yield strategy
     * @param strategyName Name of the strategy for tracking
     */
    function executeStrategy(string memory strategyName) 
        external 
        onlyRole(STRATEGIST_ROLE) 
        whenNotPaused 
    {
        // Strategy implementation would go here
        // This is a placeholder for actual yield farming logic
        
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
     * @param token Address of the token to withdraw
     * @param amount Amount to withdraw
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
     * @param recipient New recipient address
     */
    function setEmergencyRecipient(address recipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(recipient != address(0), "Invalid recipient");
        emergencyWithdrawalRecipient = recipient;
    }
    
    /**
     * @dev Hook that is called before any transfer of tokens
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @dev Returns the maximum amount of assets that can be deposited
     */
    function maxDeposit(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }
    
    /**
     * @dev Returns the maximum amount of shares that can be minted
     */
    function maxMint(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }
    
    /**
     * @dev Returns the maximum amount of assets that can be withdrawn
     */
    function maxWithdraw(address owner) public view override returns (uint256) {
        return paused() ? 0 : super.maxWithdraw(owner);
    }
    
    /**
     * @dev Returns the maximum amount of shares that can be redeemed
     */
    function maxRedeem(address owner) public view override returns (uint256) {
        return paused() ? 0 : super.maxRedeem(owner);
    }
}
