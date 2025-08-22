// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SmartIndexVault.sol";
import "./interfaces/IHyperIndexVault.sol";

/**
 * @title HyperIndexVault
 * @dev ERC4626-based vault with LayerZero cross-chain messaging integration
 * @notice Extends SmartIndexVault with cross-chain capabilities for HyperIndex ecosystem
 */
contract HyperIndexVault is SmartIndexVault, IHyperIndexVault {
    
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol
    ) SmartIndexVault(_asset, _name, _symbol) {
        // Constructor for template - actual initialization in initialize()
    }
    
    // LayerZero integration
    address public layerZeroEndpoint;
    uint256 public indexTokenId;
    
    // Cross-chain configuration
    mapping(uint32 => bytes32) public trustedRemotes; // chainId => trustedRemote
    mapping(address => bool) public authorizedSenders;
    
    // Rebalancing configuration  
    address[] public underlyingTokens;
    uint256[] public targetAllocations; // in basis points (10000 = 100%)
    uint256 public rebalanceThreshold = 500; // 5% threshold for rebalancing
    uint256 public lastRebalanceTime;
    
    // Fee configuration
    uint256 public managementFeeBps = 200; // 2%
    uint256 public performanceFeeBps = 2000; // 20%
    uint256 public lastFeeCollection;
    
    // Additional events (interface events are inherited)
    
    event TrustedRemoteSet(uint32 chainId, bytes32 trustedRemote);
    event UnderlyingTokenAdded(address token, uint256 allocation);
    event UnderlyingTokenRemoved(uint256 index);
    event TargetAllocationsUpdated(uint256[] newAllocations);
    
    modifier onlyLayerZero() {
        require(msg.sender == layerZeroEndpoint, "Only LayerZero endpoint");
        _;
    }
    
    modifier onlyAuthorizedSender() {
        require(authorizedSenders[msg.sender], "Not authorized sender");
        _;
    }
    
    /**
     * @dev Initialize the vault with LayerZero integration
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
    ) external override {
        require(address(asset()) == address(0), "Already initialized");
        require(lzEndpoint_ != address(0), "Invalid LayerZero endpoint");
        require(tokens_.length == targetAllocations_.length, "Length mismatch");
        require(_validateAllocations(targetAllocations_), "Invalid allocations");
        
        // Initialize parent vault through internal methods
        // Note: SmartIndexVault initialize method would need to be available
        
        // Set vault-specific parameters
        indexTokenId = indexTokenId_;
        layerZeroEndpoint = lzEndpoint_;
        underlyingTokens = tokens_;
        targetAllocations = targetAllocations_;
        lastRebalanceTime = block.timestamp;
        lastFeeCollection = block.timestamp;
        
        // Set admin as authorized sender
        authorizedSenders[admin] = true;
        
        emit VaultInitialized(indexTokenId_, asset_, admin);
    }
    
    /**
     * @dev Deposit with cross-chain message capability
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override(SmartIndexVault, IHyperIndexVault)
        returns (uint256 shares) 
    {
        shares = super.deposit(assets, receiver);
        
        // Check if auto-rebalancing is needed
        if (_shouldRebalance()) {
            autoRebalance();
        }
        
        // Emit cross-chain event for tracking
        emit CrossChainMessageSent(receiver, indexTokenId, assets, shares);
        
        return shares;
    }
    
    /**
     * @dev Automatic rebalancing based on target allocations
     */
    function autoRebalance() public virtual override {
        require(!paused(), "Vault is paused");
        
        (bool needed, address fromToken, address toToken, uint256 amount) = checkRebalanceNeeded();
        
        if (!needed) {
            return;
        }
        
        uint256 fromIdx = _findTokenIndex(fromToken);
        uint256 toIdx = _findTokenIndex(toToken);
        
        _executeRebalance(fromIdx, toIdx, amount);
        
        lastRebalanceTime = block.timestamp;
        
        emit AutoRebalanced(
            fromToken,
            toToken,
            amount,
            _getCurrentRatio(fromIdx),
            targetAllocations[fromIdx]
        );
    }
    
    /**
     * @dev Manual rebalancing by authorized users
     */
    function manualRebalance(uint256 fromIdx, uint256 toIdx, uint256 amount) 
        external 
        override 
        onlyAuthorizedSender 
    {
        require(fromIdx < underlyingTokens.length, "Invalid from index");
        require(toIdx < underlyingTokens.length, "Invalid to index");
        require(fromIdx != toIdx, "Same token indices");
        require(amount > 0, "Amount must be positive");
        
        _executeRebalance(fromIdx, toIdx, amount);
        
        emit ManualRebalanced(fromIdx, toIdx, amount);
    }
    
    /**
     * @dev Check if rebalancing is needed
     */
    function checkRebalanceNeeded() 
        public 
        view 
        virtual
        override 
        returns (bool needed, address fromToken, address toToken, uint256 amount) 
    {
        uint256 totalValue = _getTotalPortfolioValue();
        if (totalValue == 0) {
            return (false, address(0), address(0), 0);
        }
        
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            uint256 currentRatio = _getCurrentRatio(i);
            uint256 targetRatio = targetAllocations[i];
            
            if (currentRatio > targetRatio + rebalanceThreshold) {
                // Need to reduce this token
                for (uint256 j = 0; j < underlyingTokens.length; j++) {
                    if (i == j) continue;
                    
                    uint256 otherCurrentRatio = _getCurrentRatio(j);
                    uint256 otherTargetRatio = targetAllocations[j];
                    
                    if (otherCurrentRatio < otherTargetRatio - rebalanceThreshold) {
                        // Found rebalance opportunity
                        uint256 excessValue = ((currentRatio - targetRatio) * totalValue) / 10000;
                        return (true, underlyingTokens[i], underlyingTokens[j], excessValue);
                    }
                }
            }
        }
        
        return (false, address(0), address(0), 0);
    }
    
    /**
     * @dev Get current allocation ratios
     */
    function getAllocationRatios()
        external
        view
        override
        returns (
            address[] memory tokens,
            uint256[] memory currentRatios,
            uint256[] memory targetRatios
        )
    {
        tokens = underlyingTokens;
        targetRatios = targetAllocations;
        currentRatios = new uint256[](underlyingTokens.length);
        
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            currentRatios[i] = _getCurrentRatio(i);
        }
    }
    
    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external override onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external override onlyRole(EMERGENCY_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get vault metadata
     */
    function getVaultMetadata()
        external
        view
        override
        returns (
            uint256 _indexTokenId,
            uint256 _totalAssets,
            uint256 _totalShares,
            bool _isPaused,
            uint256 _managementFeeBps,
            uint256 _performanceFeeBps
        )
    {
        return (
            indexTokenId,
            totalAssets(),
            totalSupply(),
            paused(),
            managementFeeBps,
            performanceFeeBps
        );
    }
    
    /**
     * @dev Get underlying tokens
     */
    function getUnderlyingTokens() external view override returns (address[] memory) {
        return underlyingTokens;
    }
    
    /**
     * @dev Get LayerZero endpoint
     */
    function getLayerZeroEndpoint() external view override returns (address) {
        return layerZeroEndpoint;
    }
    
    /**
     * @dev Calculate management fee
     */
    function calculateManagementFee(uint256 assets, uint256 timeElapsed) 
        external 
        view 
        override 
        returns (uint256 fee) 
    {
        // Annual management fee calculation
        fee = (assets * managementFeeBps * timeElapsed) / (10000 * 365 days);
        return fee;
    }
    
    /**
     * @dev Collect management fees
     */
    function collectManagementFees() external override onlyRole(MANAGER_ROLE) {
        uint256 timeElapsed = block.timestamp - lastFeeCollection;
        uint256 currentAssets = totalAssets();
        uint256 feeAmount = this.calculateManagementFee(currentAssets, timeElapsed);
        
        if (feeAmount > 0) {
            IERC20(asset()).transfer(msg.sender, feeAmount);
            lastFeeCollection = block.timestamp;
            emit FeeCollected(address(this), feeAmount, block.timestamp);
        }
    }
    
    /**
     * @dev Set target allocations
     */
    function setTargetAllocations(uint256[] calldata newAllocations) 
        external 
        override 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newAllocations.length == underlyingTokens.length, "Length mismatch");
        require(_validateAllocations(newAllocations), "Invalid allocations");
        
        targetAllocations = newAllocations;
        emit TargetAllocationsUpdated(newAllocations);
    }
    
    /**
     * @dev Add new underlying token
     */
    function addUnderlyingToken(address token, uint256 allocation) 
        external 
        override 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(0), "Invalid token");
        require(_findTokenIndex(token) == type(uint256).max, "Token already exists");
        
        underlyingTokens.push(token);
        targetAllocations.push(allocation);
        
        require(_validateAllocations(targetAllocations), "Invalid total allocation");
        
        emit UnderlyingTokenAdded(token, allocation);
    }
    
    /**
     * @dev Remove underlying token
     */
    function removeUnderlyingToken(uint256 tokenIndex) 
        external 
        override 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(tokenIndex < underlyingTokens.length, "Invalid index");
        
        address removedToken = underlyingTokens[tokenIndex];
        
        // Remove from arrays
        for (uint256 i = tokenIndex; i < underlyingTokens.length - 1; i++) {
            underlyingTokens[i] = underlyingTokens[i + 1];
            targetAllocations[i] = targetAllocations[i + 1];
        }
        underlyingTokens.pop();
        targetAllocations.pop();
        
        emit UnderlyingTokenRemoved(tokenIndex);
    }
    
    // Internal functions
    
    function _shouldRebalance() internal view returns (bool) {
        return block.timestamp >= lastRebalanceTime + 1 hours; // Rebalance at most once per hour
    }
    
    function _executeRebalance(uint256 fromIdx, uint256 toIdx, uint256 amount) internal {
        // This would integrate with 1inch or other DEX aggregator
        // For now, this is a placeholder
        emit ManualRebalanced(fromIdx, toIdx, amount);
    }
    
    function _getCurrentRatio(uint256 tokenIndex) internal view returns (uint256) {
        if (tokenIndex >= underlyingTokens.length) return 0;
        
        uint256 totalValue = _getTotalPortfolioValue();
        if (totalValue == 0) return 0;
        
        uint256 tokenValue = _getTokenValue(underlyingTokens[tokenIndex]);
        return (tokenValue * 10000) / totalValue;
    }
    
    function _getTotalPortfolioValue() internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            total += _getTokenValue(underlyingTokens[i]);
        }
        return total;
    }
    
    function _getTokenValue(address token) internal view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        // This would use the price feed to get USD value
        // For now, return balance as placeholder
        return balance;
    }
    
    function _findTokenIndex(address token) internal view returns (uint256) {
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            if (underlyingTokens[i] == token) {
                return i;
            }
        }
        return type(uint256).max; // Not found
    }
    
    function _validateAllocations(uint256[] memory allocations) internal pure returns (bool) {
        uint256 total = 0;
        for (uint256 i = 0; i < allocations.length; i++) {
            total += allocations[i];
        }
        return total == 10000; // Must sum to 100%
    }
    
    // LayerZero message handling (for future use)
    
    function setTrustedRemote(uint32 chainId, bytes32 trustedRemote) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        trustedRemotes[chainId] = trustedRemote;
        emit TrustedRemoteSet(chainId, trustedRemote);
    }
    
    function setAuthorizedSender(address sender, bool authorized) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        authorizedSenders[sender] = authorized;
    }
    
    // Custom event for initialization
    event VaultInitialized(uint256 indexed indexTokenId, address indexed asset, address indexed admin);
}