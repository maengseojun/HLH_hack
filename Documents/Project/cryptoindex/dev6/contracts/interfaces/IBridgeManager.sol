// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IBridgeManager
 * @dev Interface for managing bridge operations between Hyperliquid native and EVM
 */
interface IBridgeManager {
    
    // Events
    event BridgeTransferInitiated(
        bytes32 indexed transferId,
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint32 targetAssetIndex
    );
    
    event BridgeTransferCompleted(
        bytes32 indexed transferId,
        uint256 actualAmount,
        uint256 fee
    );
    
    event BridgeTransferFailed(
        bytes32 indexed transferId,
        string reason
    );
    
    // Structs
    struct BridgeTransfer {
        bytes32 id;
        address token;
        address recipient;
        uint256 amount;
        uint32 assetIndex;
        uint256 timestamp;
        BridgeStatus status;
        uint256 fee;
        string failureReason;
    }
    
    enum BridgeStatus {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        CANCELLED
    }
    
    /**
     * @dev Initiate bridge transfer from EVM to Hyperliquid native
     */
    function initiateBridgeTransfer(
        address token,
        uint256 amount,
        address recipient,
        uint32 targetAssetIndex
    ) external returns (bytes32 transferId);
    
    /**
     * @dev Complete bridge transfer (called by bridge operator)
     */
    function completeBridgeTransfer(
        bytes32 transferId,
        uint256 actualAmount,
        uint256 fee
    ) external returns (bool success);
    
    /**
     * @dev Cancel pending bridge transfer
     */
    function cancelBridgeTransfer(
        bytes32 transferId
    ) external returns (bool success);
    
    /**
     * @dev Get bridge transfer details
     */
    function getBridgeTransfer(
        bytes32 transferId
    ) external view returns (BridgeTransfer memory);
    
    /**
     * @dev Get pending transfers for a user
     */
    function getPendingTransfers(
        address user
    ) external view returns (bytes32[] memory transferIds);
    
    /**
     * @dev Calculate bridge fee for a transfer
     */
    function calculateBridgeFee(
        address token,
        uint256 amount
    ) external view returns (uint256 fee);
    
    /**
     * @dev Check if bridge transfer is supported for token
     */
    function isBridgeSupported(
        address token
    ) external view returns (bool supported);
    
    /**
     * @dev Get supported asset mapping
     */
    function getAssetMapping(
        address token
    ) external view returns (uint32 assetIndex, bool isSupported);
}