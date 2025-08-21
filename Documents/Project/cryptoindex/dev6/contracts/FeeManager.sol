// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IHyperIndexVault.sol";

/**
 * @title FeeManager
 * @dev Manages fee collection and distribution for HyperIndex vaults
 * @notice Handles management fees (0.25% annual) and performance fees (0%)
 */
contract FeeManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    // Fee configuration
    uint256 public constant MANAGEMENT_FEE_BPS = 25;    // 0.25% annually
    uint256 public constant PERFORMANCE_FEE_BPS = 0;     // 0%
    uint256 public constant SECONDS_PER_YEAR = 31536000; // 365 days
    uint256 public constant BASIS_POINTS = 10000;
    
    // Fee recipients
    address public treasury;
    address public protocolTreasury;
    
    // Fee distribution ratios (in basis points)
    uint256 public treasuryShare = 7000;    // 70% to main treasury
    uint256 public protocolShare = 3000;    // 30% to protocol treasury
    
    // Vault fee tracking
    mapping(address => VaultFeeData) public vaultFees;
    mapping(address => bool) public authorizedVaults;
    
    struct VaultFeeData {
        uint256 lastFeeCollection;      // Timestamp of last fee collection
        uint256 totalManagementFees;    // Total management fees collected
        uint256 totalPerformanceFees;   // Total performance fees collected
        uint256 accruedFees;            // Fees accrued but not yet collected
        bool isActive;                  // Whether fee collection is active for this vault
    }
    
    struct FeeBreakdown {
        uint256 managementFee;
        uint256 performanceFee;
        uint256 totalFee;
        uint256 treasuryAmount;
        uint256 protocolAmount;
    }
    
    // Events
    event FeeCollected(
        address indexed vault,
        uint256 managementFee,
        uint256 performanceFee,
        uint256 totalFee,
        uint256 timestamp
    );
    
    event FeeDistributed(
        address indexed vault,
        address indexed treasury,
        address indexed protocolTreasury,
        uint256 treasuryAmount,
        uint256 protocolAmount
    );
    
    event VaultAuthorized(address indexed vault, bool authorized);
    
    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury,
        address oldProtocolTreasury,
        address newProtocolTreasury
    );
    
    event FeeRatiosUpdated(
        uint256 oldTreasuryShare,
        uint256 newTreasuryShare,
        uint256 oldProtocolShare,
        uint256 newProtocolShare
    );
    
    constructor(address _treasury, address _protocolTreasury) {
        require(_treasury != address(0), "FeeManager: invalid treasury");
        require(_protocolTreasury != address(0), "FeeManager: invalid protocol treasury");
        
        treasury = _treasury;
        protocolTreasury = _protocolTreasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_COLLECTOR_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
    }
    
    /**
     * @dev Calculate management fee for a vault
     * @param vault Vault address
     * @param totalAssets Current total assets in vault
     * @return fee Management fee amount
     */
    function calculateManagementFee(address vault, uint256 totalAssets) 
        public 
        view 
        returns (uint256 fee) 
    {
        VaultFeeData storage vaultData = vaultFees[vault];
        
        if (!vaultData.isActive || totalAssets == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - vaultData.lastFeeCollection;
        
        if (timeElapsed == 0) {
            return 0;
        }
        
        // Annual fee rate applied pro-rata based on time elapsed
        fee = (totalAssets * MANAGEMENT_FEE_BPS * timeElapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);
    }
    
    /**
     * @dev Calculate performance fee (currently 0%)
     * @param vault Vault address
     * @param performance Performance amount (profits)
     * @return fee Performance fee amount
     */
    function calculatePerformanceFee(address vault, uint256 performance) 
        public 
        pure 
        returns (uint256 fee) 
    {
        // Performance fee is currently 0%
        return 0;
    }
    
    /**
     * @dev Calculate total fees for a vault
     * @param vault Vault address
     * @return breakdown FeeBreakdown struct with detailed fee information
     */
    function calculateTotalFees(address vault) 
        external 
        view 
        returns (FeeBreakdown memory breakdown) 
    {
        require(authorizedVaults[vault], "FeeManager: vault not authorized");
        
        // Get vault metadata
        (
            ,
            uint256 totalAssets,
            ,
            ,
            ,
        ) = IHyperIndexVault(vault).getVaultMetadata();
        
        breakdown.managementFee = calculateManagementFee(vault, totalAssets);
        breakdown.performanceFee = calculatePerformanceFee(vault, 0); // No performance tracking yet
        breakdown.totalFee = breakdown.managementFee + breakdown.performanceFee;
        
        // Calculate distribution
        breakdown.treasuryAmount = (breakdown.totalFee * treasuryShare) / BASIS_POINTS;
        breakdown.protocolAmount = (breakdown.totalFee * protocolShare) / BASIS_POINTS;
    }
    
    /**
     * @dev Collect fees from a vault
     * @param vault Vault address
     * @return feesCollected Total fees collected
     */
    function collectFees(address vault) 
        external 
        onlyRole(FEE_COLLECTOR_ROLE) 
        whenNotPaused 
        nonReentrant 
        returns (uint256 feesCollected) 
    {
        require(authorizedVaults[vault], "FeeManager: vault not authorized");
        
        VaultFeeData storage vaultData = vaultFees[vault];
        require(vaultData.isActive, "FeeManager: fee collection inactive for vault");
        
        // Calculate fees
        FeeBreakdown memory breakdown = this.calculateTotalFees(vault);
        
        if (breakdown.totalFee == 0) {
            return 0;
        }
        
        // Get vault's underlying asset
        address asset = _getVaultAsset(vault);
        
        // Collect fees from vault (vault should transfer fees to this contract)
        // Note: Vault implementation should handle the actual fee deduction
        try IHyperIndexVault(vault).collectManagementFees() {
            // Fees should now be in this contract
            uint256 contractBalance = IERC20(asset).balanceOf(address(this));
            require(contractBalance >= breakdown.totalFee, "FeeManager: insufficient fees received");
            
            // Distribute fees
            _distributeFees(vault, asset, breakdown);
            
            // Update vault fee data
            vaultData.lastFeeCollection = block.timestamp;
            vaultData.totalManagementFees += breakdown.managementFee;
            vaultData.totalPerformanceFees += breakdown.performanceFee;
            vaultData.accruedFees = 0;
            
            feesCollected = breakdown.totalFee;
            
            emit FeeCollected(
                vault,
                breakdown.managementFee,
                breakdown.performanceFee,
                breakdown.totalFee,
                block.timestamp
            );
            
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("FeeManager: fee collection failed - ", reason)));
        }
    }
    
    /**
     * @dev Distribute collected fees to treasuries
     * @param vault Vault address
     * @param asset Asset to distribute
     * @param breakdown Fee breakdown
     */
    function _distributeFees(
        address vault, 
        address asset, 
        FeeBreakdown memory breakdown
    ) internal {
        if (breakdown.treasuryAmount > 0) {
            IERC20(asset).safeTransfer(treasury, breakdown.treasuryAmount);
        }
        
        if (breakdown.protocolAmount > 0) {
            IERC20(asset).safeTransfer(protocolTreasury, breakdown.protocolAmount);
        }
        
        emit FeeDistributed(
            vault,
            treasury,
            protocolTreasury,
            breakdown.treasuryAmount,
            breakdown.protocolAmount
        );
    }
    
    /**
     * @dev Get vault's underlying asset address
     * @param vault Vault address
     * @return asset Asset address
     */
    function _getVaultAsset(address vault) internal view returns (address asset) {
        // This would need to be implemented based on vault interface
        // For now, assuming ERC4626 standard
        try IERC20(vault).totalSupply() returns (uint256) {
            // Vault is ERC20-like, need to get underlying asset
            // This is a placeholder - actual implementation would call vault.asset()
            revert("FeeManager: asset retrieval not implemented");
        } catch {
            revert("FeeManager: invalid vault");
        }
    }
    
    /**
     * @dev Authorize a vault for fee collection
     * @param vault Vault address
     * @param authorized Whether to authorize
     */
    function authorizeVault(address vault, bool authorized) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(vault != address(0), "FeeManager: invalid vault");
        
        authorizedVaults[vault] = authorized;
        
        if (authorized && !vaultFees[vault].isActive) {
            // Initialize vault fee data
            vaultFees[vault] = VaultFeeData({
                lastFeeCollection: block.timestamp,
                totalManagementFees: 0,
                totalPerformanceFees: 0,
                accruedFees: 0,
                isActive: true
            });
        } else if (!authorized) {
            // Deactivate fee collection
            vaultFees[vault].isActive = false;
        }
        
        emit VaultAuthorized(vault, authorized);
    }
    
    /**
     * @dev Batch collect fees from multiple vaults
     * @param vaults Array of vault addresses
     * @return totalFeesCollected Total fees collected from all vaults
     */
    function batchCollectFees(address[] calldata vaults) 
        external 
        onlyRole(FEE_COLLECTOR_ROLE) 
        returns (uint256 totalFeesCollected) 
    {
        for (uint256 i = 0; i < vaults.length; i++) {
            try this.collectFees(vaults[i]) returns (uint256 fees) {
                totalFeesCollected += fees;
            } catch {
                // Continue with next vault if one fails
                continue;
            }
        }
    }
    
    /**
     * @dev Update treasury addresses
     * @param _treasury New main treasury address
     * @param _protocolTreasury New protocol treasury address
     */
    function updateTreasuries(address _treasury, address _protocolTreasury) 
        external 
        onlyRole(TREASURY_ROLE) 
    {
        require(_treasury != address(0), "FeeManager: invalid treasury");
        require(_protocolTreasury != address(0), "FeeManager: invalid protocol treasury");
        
        address oldTreasury = treasury;
        address oldProtocolTreasury = protocolTreasury;
        
        treasury = _treasury;
        protocolTreasury = _protocolTreasury;
        
        emit TreasuryUpdated(oldTreasury, _treasury, oldProtocolTreasury, _protocolTreasury);
    }
    
    /**
     * @dev Update fee distribution ratios
     * @param _treasuryShare New treasury share (in basis points)
     * @param _protocolShare New protocol share (in basis points)
     */
    function updateFeeRatios(uint256 _treasuryShare, uint256 _protocolShare) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_treasuryShare + _protocolShare == BASIS_POINTS, "FeeManager: ratios must sum to 100%");
        require(_treasuryShare > 0 && _protocolShare > 0, "FeeManager: ratios must be positive");
        
        uint256 oldTreasuryShare = treasuryShare;
        uint256 oldProtocolShare = protocolShare;
        
        treasuryShare = _treasuryShare;
        protocolShare = _protocolShare;
        
        emit FeeRatiosUpdated(oldTreasuryShare, _treasuryShare, oldProtocolShare, _protocolShare);
    }
    
    /**
     * @dev Get vault fee data
     * @param vault Vault address
     * @return data VaultFeeData struct
     */
    function getVaultFeeData(address vault) external view returns (VaultFeeData memory data) {
        return vaultFees[vault];
    }
    
    /**
     * @dev Get fee manager configuration
     * @return mgmtFeeBps Management fee in basis points
     * @return perfFeeBps Performance fee in basis points
     * @return treasuryAddr Treasury address
     * @return protocolTreasuryAddr Protocol treasury address
     * @return treasuryShareBps Treasury share in basis points
     * @return protocolShareBps Protocol share in basis points
     */
    function getFeeConfig() external view returns (
        uint256 mgmtFeeBps,
        uint256 perfFeeBps,
        address treasuryAddr,
        address protocolTreasuryAddr,
        uint256 treasuryShareBps,
        uint256 protocolShareBps
    ) {
        return (
            MANAGEMENT_FEE_BPS,
            PERFORMANCE_FEE_BPS,
            treasury,
            protocolTreasury,
            treasuryShare,
            protocolShare
        );
    }
    
    /**
     * @dev Emergency withdrawal of stuck tokens
     * @param token Token address
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function emergencyWithdraw(address token, uint256 amount, address recipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(recipient != address(0), "FeeManager: invalid recipient");
        IERC20(token).safeTransfer(recipient, amount);
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