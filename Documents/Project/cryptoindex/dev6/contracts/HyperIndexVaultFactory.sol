// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./SmartIndexVault.sol";
import "./IndexTokenFactory.sol";
import "./interfaces/IHyperIndexVault.sol";
import "./interfaces/IPriceFeed.sol";

/**
 * @title HyperIndexVaultFactory
 * @dev Enhanced factory that integrates IndexToken creation with ERC-4626 vault deployment
 * @notice Creates unified index products combining token issuance with yield-bearing vault functionality
 */
contract HyperIndexVaultFactory is AccessControl, ReentrancyGuard, Pausable {
    using Clones for address;
    
    // Role definitions
    bytes32 public constant VAULT_CREATOR_ROLE = keccak256("VAULT_CREATOR_ROLE");
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Contract references
    IndexTokenFactory public immutable indexTokenFactory;
    IPriceFeed public priceFeed;
    
    // Template contracts for cloning
    address public immutable implementation;
    address public smartIndexVaultImplementation;
    
    // State mappings - Enhanced for unified products
    mapping(bytes32 => HyperIndexProduct) public hyperIndexProducts;
    mapping(address => bytes32[]) public creatorProducts;
    mapping(bytes32 => address) public productVaults; // fundId -> vault address
    mapping(uint256 => mapping(uint256 => address)) public vaults; // Legacy mapping
    mapping(address => VaultMetadata) public vaultMetadata; // Legacy mapping
    address[] public allVaults; // Legacy array
    
    // Configuration
    uint256 public constant MAX_COMPONENTS = 10;
    uint256 public constant MIN_INITIAL_DEPOSIT = 1000e6; // 1000 USDC minimum
    uint256 public managementFeeLimit = 500; // 5% max annual fee
    uint256 public performanceFeeLimit = 3000; // 30% max performance fee

    struct HyperIndexProduct {
        bytes32 fundId;
        address indexToken;
        address vault;
        address creator;
        string name;
        string symbol;
        HyperIndexComponent[] components;
        VaultConfig vaultConfig;
        uint256 createdAt;
        ProductStatus status;
    }
    
    struct HyperIndexComponent {
        address tokenAddress;
        uint32 hyperliquidAssetIndex;
        uint256 targetRatio; // basis points (10000 = 100%)
        uint256 depositedAmount;
    }
    
    struct VaultConfig {
        uint256 managementFee; // basis points
        uint256 performanceFee; // basis points
        uint256 maxTotalAssets; // Maximum assets the vault can hold
        bool publicAccess; // Whether public deposits are allowed
        address[] authorizedUsers; // Users allowed to deposit (if not public)
    }
    
    enum ProductStatus {
        Created,      // Product created, awaiting initial deposit
        Funded,       // Initial deposit made, tokens issued
        Active,       // Vault active and accepting deposits
        Paused,       // Temporarily paused
        Closed        // Permanently closed
    }

    // Legacy struct for backward compatibility
    struct VaultMetadata {
        uint256 indexTokenId;
        uint256 chainId;
        address asset;
        string name;
        string symbol;
        address creator;
        uint256 createdAt;
        bool isActive;
    }

    // Enhanced events for unified products
    event HyperIndexProductCreated(
        bytes32 indexed fundId,
        address indexed creator,
        address indexed vault,
        address indexToken,
        string name,
        string symbol
    );
    
    event InitialDepositCompleted(
        bytes32 indexed fundId,
        address indexed vault,
        uint256 totalDeposited,
        uint256 indexTokensIssued
    );
    
    event ProductStatusChanged(
        bytes32 indexed fundId,
        ProductStatus oldStatus,
        ProductStatus newStatus
    );
    
    event VaultConfigUpdated(
        bytes32 indexed fundId,
        uint256 managementFee,
        uint256 performanceFee
    );

    // Legacy events for backward compatibility
    event VaultCreated(
        uint256 indexed indexTokenId,
        uint256 indexed chainId,
        address indexed vault,
        address asset,
        string name,
        string symbol,
        address creator
    );

    event VaultStatusChanged(
        address indexed vault,
        uint256 indexed indexTokenId,
        bool active
    );

    event ImplementationUpgraded(
        address indexed oldImplementation,
        address indexed newImplementation
    );

    constructor(
        address _implementation,
        address _indexTokenFactory,
        address _priceFeed
    ) {
        require(_implementation != address(0), "Invalid implementation");
        require(_indexTokenFactory != address(0), "Invalid index token factory");
        require(_priceFeed != address(0), "Invalid price feed");
        
        implementation = _implementation;
        indexTokenFactory = IndexTokenFactory(_indexTokenFactory);
        priceFeed = IPriceFeed(_priceFeed);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PLATFORM_ADMIN_ROLE, msg.sender);
        _grantRole(VAULT_CREATOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        // Deploy template contracts
        smartIndexVaultImplementation = address(new SmartIndexVault(
            IERC20(address(0)), // Will be set during initialization
            "",
            ""
        ));
    }

    /**
     * @dev Create a new HyperIndex product with integrated token and vault
     * @param name Product name (e.g., "HyperCrypto Top 5 Index")
     * @param symbol Product symbol (e.g., "HYPER5")
     * @param components Array of component tokens with target ratios
     * @param vaultConfig Configuration for the vault
     * @return fundId Unique identifier for the created product
     */
    function createHyperIndexProduct(
        string memory name,
        string memory symbol,
        HyperIndexComponent[] memory components,
        VaultConfig memory vaultConfig
    ) external onlyRole(VAULT_CREATOR_ROLE) whenNotPaused returns (bytes32 fundId) {
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");
        require(components.length > 0 && components.length <= MAX_COMPONENTS, "Invalid component count");
        require(vaultConfig.managementFee <= managementFeeLimit, "Management fee too high");
        require(vaultConfig.performanceFee <= performanceFeeLimit, "Performance fee too high");
        
        // Validate components and ratios
        _validateComponents(components);
        
        // Create index fund in the factory
        IIndexTokenFactory.ComponentToken[] memory factoryComponents = 
            new IIndexTokenFactory.ComponentToken[](components.length);
            
        for (uint i = 0; i < components.length; i++) {
            factoryComponents[i] = IIndexTokenFactory.ComponentToken({
                tokenAddress: components[i].tokenAddress,
                hyperliquidAssetIndex: components[i].hyperliquidAssetIndex,
                targetRatio: components[i].targetRatio,
                depositedAmount: 0
            });
        }
        
        fundId = indexTokenFactory.createIndexFund(
            name,
            symbol,
            factoryComponents
        );
        
        // Get the created index token address
        (,,,address indexTokenAddress,,,,) = indexTokenFactory.getFundInfo(fundId);
        require(indexTokenAddress != address(0), "Index token creation failed");
        
        // Clone and initialize vault
        address vaultClone = Clones.clone(smartIndexVaultImplementation);
        SmartIndexVault(vaultClone).initialize(
            IERC20(indexTokenAddress),
            string.concat("Vault ", name),
            string.concat("v", symbol),
            vaultConfig.managementFee,
            vaultConfig.performanceFee
        );
        
        // Store product information
        HyperIndexProduct storage product = hyperIndexProducts[fundId];
        product.fundId = fundId;
        product.indexToken = indexTokenAddress;
        product.vault = vaultClone;
        product.creator = msg.sender;
        product.name = name;
        product.symbol = symbol;
        product.vaultConfig = vaultConfig;
        product.createdAt = block.timestamp;
        product.status = ProductStatus.Created;
        
        // Store components
        for (uint i = 0; i < components.length; i++) {
            product.components.push(components[i]);
        }
        
        // Update mappings
        creatorProducts[msg.sender].push(fundId);
        productVaults[fundId] = vaultClone;
        
        emit HyperIndexProductCreated(
            fundId,
            msg.sender,
            vaultClone,
            indexTokenAddress,
            name,
            symbol
        );
    }

    /**
     * @dev Creates a new HyperIndexVault instance using Clone pattern (Legacy function)
     * @param asset The underlying ERC20 token address
     * @param indexTokenId Unique identifier for the index token
     * @param chainId Target chain ID for the vault
     * @param name_ Vault name
     * @param symbol_ Vault symbol
     * @param lzEndpoint LayerZero endpoint address for cross-chain messaging
     * @param tokens_ Array of token addresses that the vault will manage
     * @param targetAllocations_ Target allocation percentages for each token (in basis points)
     * @return vault Address of the created vault
     */
    function createVault(
        address asset,
        uint256 indexTokenId,
        uint256 chainId,
        string calldata name_,
        string calldata symbol_,
        address lzEndpoint,
        address[] calldata tokens_,
        uint256[] calldata targetAllocations_
    ) external onlyRole(VAULT_CREATOR_ROLE) returns (address vault) {
        require(asset != address(0), "HyperIndexVaultFactory: invalid asset");
        require(indexTokenId > 0, "HyperIndexVaultFactory: invalid index token ID");
        require(chainId > 0, "HyperIndexVaultFactory: invalid chain ID");
        require(bytes(name_).length > 0, "HyperIndexVaultFactory: invalid name");
        require(bytes(symbol_).length > 0, "HyperIndexVaultFactory: invalid symbol");
        require(lzEndpoint != address(0), "HyperIndexVaultFactory: invalid LayerZero endpoint");
        require(tokens_.length > 0, "HyperIndexVaultFactory: no tokens provided");
        require(tokens_.length == targetAllocations_.length, "HyperIndexVaultFactory: length mismatch");
        require(vaults[indexTokenId][chainId] == address(0), "HyperIndexVaultFactory: vault already exists");

        // Validate allocations sum to 10000 (100%)
        uint256 totalAllocation = 0;
        for (uint256 i = 0; i < targetAllocations_.length; i++) {
            totalAllocation += targetAllocations_[i];
        }
        require(totalAllocation == 10000, "HyperIndexVaultFactory: allocations must sum to 100%");

        // Clone the implementation contract
        vault = implementation.clone();

        // Initialize the vault
        IHyperIndexVault(vault).initialize(
            asset,
            indexTokenId,
            msg.sender, // vault manager
            name_,
            symbol_,
            lzEndpoint,
            tokens_,
            targetAllocations_
        );

        // Store vault metadata
        vaults[indexTokenId][chainId] = vault;
        vaultMetadata[vault] = VaultMetadata({
            indexTokenId: indexTokenId,
            chainId: chainId,
            asset: asset,
            name: name_,
            symbol: symbol_,
            creator: msg.sender,
            createdAt: block.timestamp,
            isActive: true
        });

        allVaults.push(vault);

        emit VaultCreated(
            indexTokenId,
            chainId,
            vault,
            asset,
            name_,
            symbol_,
            msg.sender
        );

        return vault;
    }

    /**
     * @dev Complete initial funding of the product
     * @param fundId Product identifier
     * @param tokenAddresses Array of token addresses to deposit
     * @param amounts Array of amounts to deposit
     * @param indexTokenSupply Amount of index tokens to issue initially
     */
    function completeInitialFunding(
        bytes32 fundId,
        address[] memory tokenAddresses,
        uint256[] memory amounts,
        uint256 indexTokenSupply
    ) external nonReentrant whenNotPaused {
        HyperIndexProduct storage product = hyperIndexProducts[fundId];
        require(product.creator == msg.sender, "Only creator can fund");
        require(product.status == ProductStatus.Created, "Invalid status for funding");
        require(tokenAddresses.length == amounts.length, "Array length mismatch");
        
        // Validate total value meets minimum
        uint256 totalValueUSD = _calculateTotalValueUSD(tokenAddresses, amounts);
        require(totalValueUSD >= MIN_INITIAL_DEPOSIT, "Below minimum deposit");
        
        // Deposit tokens to index factory
        indexTokenFactory.depositComponentTokens(fundId, tokenAddresses, amounts);
        
        // Issue index tokens
        indexTokenFactory.issueIndexToken(fundId, indexTokenSupply);
        
        // Update product status
        product.status = ProductStatus.Funded;
        
        emit InitialDepositCompleted(
            fundId,
            product.vault,
            totalValueUSD,
            indexTokenSupply
        );
    }
    
    /**
     * @dev Activate product for public deposits
     * @param fundId Product identifier
     */
    function activateProduct(
        bytes32 fundId
    ) external onlyRole(PLATFORM_ADMIN_ROLE) {
        HyperIndexProduct storage product = hyperIndexProducts[fundId];
        require(product.status == ProductStatus.Funded, "Product must be funded first");
        
        ProductStatus oldStatus = product.status;
        product.status = ProductStatus.Active;
        
        emit ProductStatusChanged(fundId, oldStatus, ProductStatus.Active);
    }

    /**
     * @dev Get vault address for specific index token and chain
     * @param indexTokenId Index token identifier
     * @param chainId Chain identifier
     * @return vault Vault address (zero if not exists)
     */
    function getVault(uint256 indexTokenId, uint256 chainId) external view returns (address vault) {
        return vaults[indexTokenId][chainId];
    }

    /**
     * @dev Get vault metadata
     * @param vault Vault address
     * @return metadata VaultMetadata struct
     */
    function getVaultMetadata(address vault) external view returns (VaultMetadata memory metadata) {
        return vaultMetadata[vault];
    }

    /**
     * @dev Get all vaults for a specific index token
     * @param indexTokenId Index token identifier
     * @return vaultAddresses Array of vault addresses
     * @return chainIds Array of corresponding chain IDs
     */
    function getVaultsForIndex(uint256 indexTokenId) 
        external 
        view 
        returns (address[] memory vaultAddresses, uint256[] memory chainIds) 
    {
        // Count active vaults for this index
        uint256 count = 0;
        for (uint256 i = 0; i < allVaults.length; i++) {
            if (vaultMetadata[allVaults[i]].indexTokenId == indexTokenId && 
                vaultMetadata[allVaults[i]].isActive) {
                count++;
            }
        }

        vaultAddresses = new address[](count);
        chainIds = new uint256[](count);

        uint256 index = 0;
        for (uint256 i = 0; i < allVaults.length; i++) {
            VaultMetadata memory metadata = vaultMetadata[allVaults[i]];
            if (metadata.indexTokenId == indexTokenId && metadata.isActive) {
                vaultAddresses[index] = allVaults[i];
                chainIds[index] = metadata.chainId;
                index++;
            }
        }
    }

    /**
     * @dev Get total number of vaults created
     * @return count Total vault count
     */
    function getTotalVaultCount() external view returns (uint256 count) {
        return allVaults.length;
    }

    /**
     * @dev Get all vaults (paginated)
     * @param offset Starting index
     * @param limit Number of vaults to return
     * @return vaultAddresses Array of vault addresses
     * @return hasMore Whether there are more vaults
     */
    function getAllVaults(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory vaultAddresses, bool hasMore) 
    {
        uint256 totalCount = allVaults.length;
        require(offset < totalCount, "HyperIndexVaultFactory: offset out of bounds");

        uint256 end = offset + limit;
        if (end > totalCount) {
            end = totalCount;
        }

        uint256 length = end - offset;
        vaultAddresses = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            vaultAddresses[i] = allVaults[offset + i];
        }

        hasMore = end < totalCount;
    }

    /**
     * @dev Admin function to set vault status (active/inactive)
     * @param vault Vault address
     * @param active New status
     */
    function setVaultStatus(address vault, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(vault != address(0), "HyperIndexVaultFactory: invalid vault address");
        require(vaultMetadata[vault].creator != address(0), "HyperIndexVaultFactory: vault not found");

        vaultMetadata[vault].isActive = active;
        emit VaultStatusChanged(vault, vaultMetadata[vault].indexTokenId, active);
    }

    /**
     * @dev Check if a vault exists and is active
     * @param indexTokenId Index token identifier
     * @param chainId Chain identifier
     * @return exists Whether vault exists and is active
     */
    function isVaultActive(uint256 indexTokenId, uint256 chainId) external view returns (bool exists) {
        address vault = vaults[indexTokenId][chainId];
        return vault != address(0) && vaultMetadata[vault].isActive;
    }

    /**
     * @dev Get implementation contract address
     * @return implementation Implementation contract address
     */
    function getImplementation() external view returns (address) {
        return implementation;
    }

    /**
     * @dev Emergency function to pause all vaults (requires admin)
     * Note: This calls pause on each vault individually
     */
    function emergencyPauseAllVaults() external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < allVaults.length; i++) {
            if (vaultMetadata[allVaults[i]].isActive) {
                try IHyperIndexVault(allVaults[i]).emergencyPause() {} catch {
                    // Continue with next vault even if one fails
                }
            }
        }
    }

    /**
     * @dev Emergency function to unpause all vaults (requires admin)
     */
    function emergencyUnpauseAllVaults() external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < allVaults.length; i++) {
            if (vaultMetadata[allVaults[i]].isActive) {
                try IHyperIndexVault(allVaults[i]).emergencyUnpause() {} catch {
                    // Continue with next vault even if one fails
                }
            }
        }
    }

    // Enhanced product management functions
    
    /**
     * @dev Get product information
     * @param fundId Product identifier
     * @return product Complete product information
     */
    function getHyperIndexProduct(
        bytes32 fundId
    ) external view returns (HyperIndexProduct memory product) {
        return hyperIndexProducts[fundId];
    }
    
    /**
     * @dev Get products created by a user
     * @param creator Creator address
     * @return productIds Array of product identifiers
     */
    function getCreatorProducts(
        address creator
    ) external view returns (bytes32[] memory productIds) {
        return creatorProducts[creator];
    }
    
    /**
     * @dev Get vault address for a product
     * @param fundId Product identifier
     * @return vaultAddress Vault contract address
     */
    function getProductVault(bytes32 fundId) external view returns (address vaultAddress) {
        return productVaults[fundId];
    }
    
    /**
     * @dev Internal function to validate components
     * @param components Array of components to validate
     */
    function _validateComponents(HyperIndexComponent[] memory components) internal view {
        uint256 totalRatio = 0;
        
        for (uint i = 0; i < components.length; i++) {
            require(components[i].tokenAddress != address(0), "Invalid token address");
            require(components[i].targetRatio > 0, "Ratio must be positive");
            
            // Check if token is authorized in the index factory
            require(
                indexTokenFactory.authorizedTokens(components[i].tokenAddress),
                "Token not authorized"
            );
            
            totalRatio += components[i].targetRatio;
        }
        
        require(totalRatio == 10000, "Total ratio must be 100%");
    }
    
    /**
     * @dev Calculate total value in USD for given tokens and amounts
     * @param tokenAddresses Array of token addresses
     * @param amounts Array of token amounts
     * @return totalValueUSD Total value in USD
     */
    function _calculateTotalValueUSD(
        address[] memory tokenAddresses,
        uint256[] memory amounts
    ) internal view returns (uint256 totalValueUSD) {
        // For now, assume 1:1 with USDC for simplicity
        // In production, this would use proper price feeds
        for (uint i = 0; i < amounts.length; i++) {
            totalValueUSD += amounts[i];
        }
    }
    
    /**
     * @dev Admin function to update fee limits
     * @param newManagementFeeLimit New management fee limit in basis points
     * @param newPerformanceFeeLimit New performance fee limit in basis points
     */
    function updateFeeLimits(
        uint256 newManagementFeeLimit,
        uint256 newPerformanceFeeLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newManagementFeeLimit <= 1000, "Management fee limit too high"); // 10% absolute max
        require(newPerformanceFeeLimit <= 5000, "Performance fee limit too high"); // 50% absolute max
        
        managementFeeLimit = newManagementFeeLimit;
        performanceFeeLimit = newPerformanceFeeLimit;
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