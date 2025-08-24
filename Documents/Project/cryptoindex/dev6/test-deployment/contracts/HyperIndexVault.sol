// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HyperIndexVault  
 * @dev Enhanced vault with DEX integration
 * Based on: Yearn V3 Vault + Balancer V2 Pool Management
 */
contract HyperIndexVault is Ownable, ReentrancyGuard {
    // ✅ FIX: Missing dexAggregator reference
    address public dexAggregator;
    address public priceFeed;
    address public layerZeroEndpoint;
    
    struct AssetInfo {
        address token;
        uint256 balance;
        uint256 targetRatio;
        uint256 currentRatio;
        uint256 lastRebalanceTime;
    }
    
    mapping(address => AssetInfo) public assets;
    address[] public assetList;
    
    uint256 public totalAssetValue;
    uint256 public lastRebalanceTimestamp;
    uint256 public rebalanceThreshold = 500; // 5% in basis points
    
    event DexAggregatorUpdated(address indexed oldAggregator, address indexed newAggregator);
    event AssetRebalanced(address indexed token, uint256 oldRatio, uint256 newRatio);
    event CrossChainMessageSent(uint16 indexed chainId, bytes message);
    
    constructor(
        address _dexAggregator,
        address _priceFeed,
        address _layerZeroEndpoint
    ) {
        dexAggregator = _dexAggregator;
        priceFeed = _priceFeed;
        layerZeroEndpoint = _layerZeroEndpoint;
    }
    
    // ✅ FIX: Missing dexAggregator getter function
    function getDexAggregator() external view returns (address) {
        return dexAggregator;
    }
    
    // ✅ FIX: DEX aggregator management (Yearn V3 style)
    function setDexAggregator(address _newAggregator) external onlyOwner {
        require(_newAggregator != address(0), "Invalid aggregator address");
        
        address oldAggregator = dexAggregator;
        dexAggregator = _newAggregator;
        
        emit DexAggregatorUpdated(oldAggregator, _newAggregator);
    }
    
    // ✅ FIX: Enhanced rebalancing system (Balancer V2 inspired)
    function rebalanceAssets(
        address[] memory tokensToRebalance,
        uint256[] memory targetRatios
    ) external onlyOwner nonReentrant {
        require(tokensToRebalance.length == targetRatios.length, "Array length mismatch");
        require(dexAggregator != address(0), "DEX aggregator not set");
        
        for (uint256 i = 0; i < tokensToRebalance.length; i++) {
            address token = tokensToRebalance[i];
            uint256 newTargetRatio = targetRatios[i];
            
            AssetInfo storage asset = assets[token];
            uint256 oldRatio = asset.currentRatio;
            
            // Calculate rebalancing needed
            if (needsRebalancing(token, newTargetRatio)) {
                executeRebalance(token, newTargetRatio);
                
                asset.targetRatio = newTargetRatio;
                asset.currentRatio = newTargetRatio;
                asset.lastRebalanceTime = block.timestamp;
                
                emit AssetRebalanced(token, oldRatio, newTargetRatio);
            }
        }
        
        lastRebalanceTimestamp = block.timestamp;
    }
    
    // ✅ FIX: Cross-chain messaging integration
    function sendCrossChainMessage(
        uint16 destinationChainId,
        bytes memory message
    ) external onlyOwner {
        require(layerZeroEndpoint != address(0), "LayerZero endpoint not set");
        
        // Call LayerZero endpoint to send message
        (bool success, ) = layerZeroEndpoint.call(
            abi.encodeWithSignature(
                "send(uint16,bytes,bytes,address,address,bytes)",
                destinationChainId,
                abi.encodePacked(address(this)),
                message,
                payable(msg.sender),
                address(0),
                bytes("")
            )
        );
        
        require(success, "Cross-chain message failed");
        emit CrossChainMessageSent(destinationChainId, message);
    }
    
    // Internal functions
    function needsRebalancing(address token, uint256 targetRatio) internal view returns (bool) {
        AssetInfo memory asset = assets[token];
        uint256 deviation = asset.currentRatio > targetRatio ? 
            asset.currentRatio - targetRatio : 
            targetRatio - asset.currentRatio;
        
        return deviation > rebalanceThreshold;
    }
    
    function executeRebalance(address token, uint256 targetRatio) internal {
        // Implementation would call DEX aggregator
        // This is a simplified version
        AssetInfo storage asset = assets[token];
        asset.currentRatio = targetRatio;
    }
    
    // ✅ FIX: Asset management functions
    function addAsset(
        address token,
        uint256 targetRatio
    ) external onlyOwner {
        require(assets[token].token == address(0), "Asset already exists");
        
        assets[token] = AssetInfo({
            token: token,
            balance: 0,
            targetRatio: targetRatio,
            currentRatio: 0,
            lastRebalanceTime: block.timestamp
        });
        
        assetList.push(token);
    }
    
    function getTotalAssetValue() external view returns (uint256) {
        return totalAssetValue;
    }
    
    function getAssetInfo(address token) external view returns (AssetInfo memory) {
        return assets[token];
    }
}