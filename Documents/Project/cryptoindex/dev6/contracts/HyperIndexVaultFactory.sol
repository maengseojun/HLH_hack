// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IHyperIndexVault.sol";

/**
 * @title HyperIndexVaultFactory
 * @dev Factory contract for creating ERC4626-based index vaults using Clone pattern
 * @notice Manages creation and deployment of HyperIndexVault instances across chains
 */
contract HyperIndexVaultFactory is AccessControl {
    using Clones for address;

    bytes32 public constant VAULT_CREATOR_ROLE = keccak256("VAULT_CREATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Implementation contract address for cloning
    address public immutable implementation;
    
    // Mapping: indexTokenId => chainId => vault address
    mapping(uint256 => mapping(uint256 => address)) public vaults;
    
    // Mapping: vault address => vault metadata
    mapping(address => VaultMetadata) public vaultMetadata;
    
    // Array of all created vault addresses
    address[] public allVaults;

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

    constructor(address _implementation) {
        require(_implementation != address(0), "HyperIndexVaultFactory: invalid implementation");
        
        implementation = _implementation;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VAULT_CREATOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new HyperIndexVault instance using Clone pattern
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
}