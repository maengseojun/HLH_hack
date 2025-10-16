// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIndexTokenFactory
 * @notice Interface for Index Token Factory
 * @dev Main factory for creating and managing index funds
 */
interface IIndexTokenFactory {
    /**
     * @notice Component token structure
     */
    struct ComponentToken {
        address tokenAddress;           // ERC20 token address
        uint32 hyperliquidAssetIndex;  // HyperLiquid asset index
        uint256 targetRatio;           // Target allocation ratio (basis points)
        uint256 depositedAmount;       // Currently deposited amount
    }
    
    /**
     * @notice Emitted when new fund is created
     */
    event FundCreated(
        bytes32 indexed fundId,
        string name,
        address indexed creator
    );
    
    /**
     * @notice Emitted when index token is created
     */
    event IndexTokenCreated(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        string name,
        string symbol
    );
    
    /**
     * @notice Emitted when index token is issued
     */
    event IndexTokenIssued(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 tokenSupply
    );
    
    /**
     * @notice Emitted when tokens are deposited
     */
    event TokensDeposited(
        bytes32 indexed fundId,
        address indexed tokenAddress,
        uint256 amount
    );
    
    /**
     * @notice Create a new index fund
     * @param name Fund name
     * @param symbol Fund symbol
     * @param components Array of component tokens
     * @return fundId Unique fund identifier
     */
    function createIndexFund(
        string memory name,
        string memory symbol,
        ComponentToken[] memory components
    ) external returns (bytes32 fundId);
    
    /**
     * @notice Deposit component tokens to fund
     * @param fundId Fund identifier
     * @param tokenAddresses Addresses of tokens to deposit
     * @param amounts Amounts to deposit
     */
    function depositComponentTokens(
        bytes32 fundId,
        address[] memory tokenAddresses,
        uint256[] memory amounts
    ) external;
    
    /**
     * @notice Issue index tokens (admin only)
     * @param fundId Fund identifier
     * @param tokenSupply Number of tokens to issue
     */
    function issueIndexToken(
        bytes32 fundId,
        uint256 tokenSupply
    ) external;
    
    /**
     * @notice Calculate NAV per token
     * @param fundId Fund identifier
     * @return NAV per token (scaled by 1e18)
     */
    function calculateNAV(bytes32 fundId) external view returns (uint256);
    
    /**
     * @notice Get fund information
     * @param fundId Fund identifier
     * @return name Fund name
     * @return symbol Fund symbol
     * @return creator Creator address
     * @return indexToken Index token address
     * @return totalSupply Total token supply
     * @return nav Current NAV
     * @return isActive Is fund active
     * @return isIssued Is token issued
     */
    function getFundInfo(bytes32 fundId) external view returns (
        string memory name,
        string memory symbol,
        address creator,
        address indexToken,
        uint256 totalSupply,
        uint256 nav,
        bool isActive,
        bool isIssued
    );
    
    /**
     * @notice Get fund components
     * @param fundId Fund identifier
     * @return components Array of component tokens
     */
    function getFundComponents(bytes32 fundId) 
        external 
        view 
        returns (ComponentToken[] memory components);
    
    /**
     * @notice Get funds created by an address
     * @param creator Creator address
     * @return fundIds Array of fund identifiers
     */
    function getCreatorFunds(address creator) 
        external 
        view 
        returns (bytes32[] memory fundIds);
    
    /**
     * @notice Transfer index tokens from platform custody
     * @param fundId Fund identifier
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function transferIndexTokens(
        bytes32 fundId,
        address to,
        uint256 amount
    ) external;
    
    /**
     * @notice Grant recipe creator role
     * @param account Address to grant role
     */
    function grantRecipeCreatorRole(address account) external;
    
    /**
     * @notice Authorize token for use in funds
     * @param tokenAddress Token address
     */
    function authorizeToken(address tokenAddress) external;
    
    /**
     * @notice Revoke token authorization
     * @param tokenAddress Token address
     */
    function revokeToken(address tokenAddress) external;
    
    /**
     * @notice Emergency pause
     */
    function emergencyPause() external;
    
    /**
     * @notice Emergency unpause
     */
    function emergencyUnpause() external;
    
    /**
     * @notice Check if paused
     * @return True if paused
     */
    function isPaused() external view returns (bool);
}
