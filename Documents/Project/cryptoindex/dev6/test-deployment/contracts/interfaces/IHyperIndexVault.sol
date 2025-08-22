// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IHyperIndexVault
 * @dev Interface for HyperIndexVault implementation
 * @notice ERC4626-based vault with cross-chain messaging and rebalancing capabilities
 */
interface IHyperIndexVault {
    
    // Events
    event CrossChainMessageSent(
        address indexed user, 
        uint256 indexed indexTokenId, 
        uint256 assets, 
        uint256 shares
    );
    
    event ManualRebalanced(
        uint256 fromIdx, 
        uint256 toIdx, 
        uint256 amount
    );

    event AutoRebalanced(
        address indexed tokenFrom,
        address indexed tokenTo,
        uint256 amount,
        uint256 currentRatio,
        uint256 targetRatio
    );

    event FeeCollected(
        address indexed feeType,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev Initialize the vault with required parameters
     * @param asset_ The underlying ERC20 token
     * @param indexTokenId_ Unique identifier for the index token
     * @param admin Admin address for the vault
     * @param name_ Vault token name
     * @param symbol_ Vault token symbol
     * @param lzEndpoint_ LayerZero endpoint address
     * @param tokens_ Array of underlying tokens to manage
     * @param targetAllocations_ Target allocation percentages (in basis points)
     */
    function initialize(
        address asset_,
        uint256 indexTokenId_,
        address admin,
        string calldata name_,
        string calldata symbol_,
        address lzEndpoint_,
        address[] calldata tokens_,
        uint256[] calldata targetAllocations_
    ) external;

    /**
     * @dev Deposit assets to the vault
     * @param assets Amount of assets to deposit
     * @param receiver Address to receive shares
     * @return shares Amount of shares minted
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /**
     * @dev Automatic rebalancing based on predefined tolerances
     */
    function autoRebalance() external;

    /**
     * @dev Manual rebalancing by admin
     * @param fromIdx Index of token to sell
     * @param toIdx Index of token to buy
     * @param amount Amount to rebalance
     */
    function manualRebalance(uint256 fromIdx, uint256 toIdx, uint256 amount) external;

    /**
     * @dev Check if rebalancing is needed
     * @return needed Whether rebalancing is required
     * @return fromToken Token that needs to be reduced
     * @return toToken Token that needs to be increased
     * @return amount Suggested rebalance amount
     */
    function checkRebalanceNeeded() 
        external 
        view 
        returns (
            bool needed, 
            address fromToken, 
            address toToken, 
            uint256 amount
        );

    /**
     * @dev Get current allocation ratios
     * @return tokens Array of token addresses
     * @return currentRatios Current allocation ratios (in basis points)
     * @return targetRatios Target allocation ratios (in basis points)
     */
    function getAllocationRatios()
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory currentRatios,
            uint256[] memory targetRatios
        );

    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external;

    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external;

    /**
     * @dev Get vault metadata
     * @return indexTokenId Index token identifier
     * @return totalAssets Total assets under management
     * @return totalShares Total shares outstanding
     * @return isPaused Whether vault is paused
     * @return managementFeeBps Management fee in basis points
     * @return performanceFeeBps Performance fee in basis points
     */
    function getVaultMetadata()
        external
        view
        returns (
            uint256 indexTokenId,
            uint256 totalAssets,
            uint256 totalShares,
            bool isPaused,
            uint256 managementFeeBps,
            uint256 performanceFeeBps
        );

    /**
     * @dev Get underlying tokens
     * @return tokens Array of underlying token addresses
     */
    function getUnderlyingTokens() external view returns (address[] memory tokens);

    /**
     * @dev Get LayerZero endpoint
     * @return endpoint LayerZero endpoint address
     */
    function getLayerZeroEndpoint() external view returns (address endpoint);

    /**
     * @dev Calculate management fee
     * @param assets Assets amount
     * @param timeElapsed Time elapsed since last fee collection
     * @return fee Management fee amount
     */
    function calculateManagementFee(uint256 assets, uint256 timeElapsed) 
        external 
        view 
        returns (uint256 fee);

    /**
     * @dev Collect management fees
     */
    function collectManagementFees() external;

    /**
     * @dev Set target allocations (admin only)
     * @param newAllocations New target allocations (must sum to 10000)
     */
    function setTargetAllocations(uint256[] calldata newAllocations) external;

    /**
     * @dev Add new underlying token (admin only)
     * @param token Token address to add
     * @param allocation Target allocation for new token
     */
    function addUnderlyingToken(address token, uint256 allocation) external;

    /**
     * @dev Remove underlying token (admin only)
     * @param tokenIndex Index of token to remove
     */
    function removeUnderlyingToken(uint256 tokenIndex) external;
}