// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IHyperIndexVault.sol";

// LayerZero endpoint interface (simplified)
interface ILayerZeroEndpoint {
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;
    
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParam
    ) external view returns (uint nativeFee, uint zroFee);
}

/**
 * @title LayerZeroMessaging
 * @dev Handles cross-chain messaging for HyperIndex ecosystem
 * @notice Manages message sending/receiving between chains and HyperEVM
 */
contract LayerZeroMessaging is AccessControl, ReentrancyGuard, Pausable {
    
    bytes32 public constant MESSAGE_SENDER_ROLE = keccak256("MESSAGE_SENDER_ROLE");
    bytes32 public constant MESSAGE_RECEIVER_ROLE = keccak256("MESSAGE_RECEIVER_ROLE");
    
    ILayerZeroEndpoint public immutable lzEndpoint;
    
    // Chain ID mappings
    mapping(uint256 => uint16) public chainIdToLzChainId;
    mapping(uint16 => uint256) public lzChainIdToChainId;
    
    // HyperEVM chain configuration
    uint16 public constant HYPER_EVM_LZ_CHAIN_ID = 30000; // Example HyperEVM LZ chain ID
    uint256 public constant HYPER_EVM_CHAIN_ID = 998; // Example HyperEVM chain ID
    
    // Message tracking
    mapping(bytes32 => MessageStatus) public messageStatus;
    mapping(address => uint256) public userNonces;
    mapping(bytes32 => VaultOperation) public vaultOperations;
    
    enum MessageStatus {
        Pending,
        Sent,
        Received,
        Failed
    }
    
    struct CrossChainMessage {
        address sender;
        address vault;
        uint256 indexTokenId;
        uint256 assets;
        uint256 shares;
        uint256 timestamp;
        uint256 nonce;
        bytes32 messageHash;
    }
    
    struct VaultOperation {
        address user;
        address vault;
        uint256 indexTokenId;
        uint256 assets;
        uint256 shares;
        uint256 timestamp;
        uint256 nonce;
        uint256 srcChainId;
        bool executed;
    }
    
    // Events
    event CrossChainMessageSent(
        address indexed sender,
        address indexed vault,
        uint256 indexed indexTokenId,
        uint16 dstChainId,
        bytes32 messageHash,
        uint256 nonce
    );
    
    event CrossChainMessageReceived(
        address indexed sender,
        address indexed vault,
        uint256 indexed indexTokenId,
        uint16 srcChainId,
        bytes32 messageHash
    );
    
    event MessageStatusUpdated(
        bytes32 indexed messageHash,
        MessageStatus oldStatus,
        MessageStatus newStatus
    );
    
    event ChainConfigurationUpdated(
        uint256 chainId,
        uint16 lzChainId,
        bool added
    );
    
    event VaultOperationExecuted(
        bytes32 indexed operationId,
        address indexed vault,
        address indexed user,
        uint256 assets
    );
    
    event VaultOperationFailed(
        bytes32 indexed operationId,
        address indexed vault,
        address indexed user,
        string reason
    );
    
    constructor(address _lzEndpoint) {
        require(_lzEndpoint != address(0), "LayerZeroMessaging: invalid endpoint");
        
        lzEndpoint = ILayerZeroEndpoint(_lzEndpoint);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MESSAGE_SENDER_ROLE, msg.sender);
        _grantRole(MESSAGE_RECEIVER_ROLE, msg.sender);
        
        // Initialize default chain configurations
        _initializeDefaultChains();
    }
    
    /**
     * @dev Initialize default LayerZero chain configurations
     */
    function _initializeDefaultChains() internal {
        // Ethereum Mainnet
        chainIdToLzChainId[1] = 101;
        lzChainIdToChainId[101] = 1;
        
        // BNB Smart Chain
        chainIdToLzChainId[56] = 102;
        lzChainIdToChainId[102] = 56;
        
        // Polygon
        chainIdToLzChainId[137] = 109;
        lzChainIdToChainId[109] = 137;
        
        // Arbitrum
        chainIdToLzChainId[42161] = 110;
        lzChainIdToChainId[110] = 42161;
        
        // HyperEVM
        chainIdToLzChainId[HYPER_EVM_CHAIN_ID] = HYPER_EVM_LZ_CHAIN_ID;
        lzChainIdToChainId[HYPER_EVM_LZ_CHAIN_ID] = HYPER_EVM_CHAIN_ID;
    }
    
    /**
     * @dev Send cross-chain message for vault deposit
     * @param vault Vault address that initiated the message
     * @param indexTokenId Index token identifier
     * @param assets Amount of assets deposited
     * @param shares Amount of shares minted
     * @param user User address
     */
    function sendDepositMessage(
        address vault,
        uint256 indexTokenId,
        uint256 assets,
        uint256 shares,
        address user
    ) external payable onlyRole(MESSAGE_SENDER_ROLE) whenNotPaused nonReentrant {
        require(vault != address(0), "LayerZeroMessaging: invalid vault");
        require(user != address(0), "LayerZeroMessaging: invalid user");
        require(indexTokenId > 0, "LayerZeroMessaging: invalid index token ID");
        
        uint256 nonce = ++userNonces[user];
        
        // Create message payload
        bytes memory payload = abi.encode(
            user,
            vault,
            indexTokenId,
            assets,
            shares,
            block.timestamp,
            nonce,
            block.chainid
        );
        
        // Generate message hash
        bytes32 messageHash = keccak256(payload);
        
        // Update message status
        messageStatus[messageHash] = MessageStatus.Pending;
        
        // Send message to HyperEVM
        uint16 dstChainId = HYPER_EVM_LZ_CHAIN_ID;
        bytes memory destination = abi.encodePacked(address(this));
        
        try lzEndpoint.send{value: msg.value}(
            dstChainId,
            destination,
            payload,
            payable(msg.sender),
            address(0),
            bytes("")
        ) {
            messageStatus[messageHash] = MessageStatus.Sent;
            
            emit CrossChainMessageSent(
                user,
                vault,
                indexTokenId,
                dstChainId,
                messageHash,
                nonce
            );
        } catch Error(string memory reason) {
            messageStatus[messageHash] = MessageStatus.Failed;
            revert(string(abi.encodePacked("LayerZeroMessaging: ", reason)));
        } catch (bytes memory lowLevelData) {
            messageStatus[messageHash] = MessageStatus.Failed;
            if (lowLevelData.length == 0) {
                revert("LayerZeroMessaging: message send failed - unknown error");
            } else {
                // Try to decode the error
                assembly {
                    let dataSize := mload(lowLevelData)
                    revert(add(32, lowLevelData), dataSize)
                }
            }
        }
    }
    
    /**
     * @dev Receive cross-chain message (LayerZero callback)
     * @param _srcChainId Source LayerZero chain ID
     * @param _srcAddress Source address that sent the message
     * @param _nonce Message nonce
     * @param _payload Message payload
     */
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external {
        require(msg.sender == address(lzEndpoint), "LayerZeroMessaging: only endpoint");
        require(lzChainIdToChainId[_srcChainId] != 0, "LayerZeroMessaging: invalid source chain");
        
        // Decode payload
        (
            address user,
            address vault,
            uint256 indexTokenId,
            uint256 assets,
            uint256 shares,
            uint256 timestamp,
            uint256 userNonce,
            uint256 srcChainId
        ) = abi.decode(_payload, (address, address, uint256, uint256, uint256, uint256, uint256, uint256));
        
        // Generate message hash
        bytes32 messageHash = keccak256(_payload);
        
        // Update message status
        messageStatus[messageHash] = MessageStatus.Received;
        
        // Process the received message
        _processReceivedMessage(
            user,
            vault,
            indexTokenId,
            assets,
            shares,
            timestamp,
            userNonce,
            srcChainId
        );
        
        emit CrossChainMessageReceived(
            user,
            vault,
            indexTokenId,
            _srcChainId,
            messageHash
        );
    }
    
    /**
     * @dev Process received cross-chain message
     * @param user User address
     * @param vault Vault address
     * @param indexTokenId Index token identifier
     * @param assets Assets amount
     * @param shares Shares amount
     * @param timestamp Transaction timestamp
     * @param nonce User nonce
     * @param srcChainId Source chain ID
     */
    function _processReceivedMessage(
        address user,
        address vault,
        uint256 indexTokenId,
        uint256 assets,
        uint256 shares,
        uint256 timestamp,
        uint256 nonce,
        uint256 srcChainId
    ) internal {
        // Execute vault operation based on message type
        VaultOperation memory operation = VaultOperation({
            user: user,
            vault: vault,
            indexTokenId: indexTokenId,
            assets: assets,
            shares: shares,
            timestamp: timestamp,
            nonce: nonce,
            srcChainId: srcChainId,
            executed: false
        });
        
        // Store operation for processing
        vaultOperations[_generateOperationId(operation)] = operation;
        
        // Try to execute immediately
        _executeVaultOperation(operation);
    }
    
    /**
     * @dev Execute vault operation
     * @param operation Vault operation details
     */
    function _executeVaultOperation(VaultOperation memory operation) internal {
        try this._safeVaultExecution(operation) {
            // Mark as executed
            bytes32 operationId = _generateOperationId(operation);
            vaultOperations[operationId].executed = true;
            
            emit VaultOperationExecuted(
                operationId,
                operation.vault,
                operation.user,
                operation.assets
            );
        } catch Error(string memory reason) {
            emit VaultOperationFailed(
                _generateOperationId(operation),
                operation.vault,
                operation.user,
                reason
            );
        }
    }
    
    /**
     * @dev Safe vault execution with try-catch
     * @param operation Vault operation details
     */
    function _safeVaultExecution(VaultOperation memory operation) external {
        require(msg.sender == address(this), "LayerZeroMessaging: internal only");
        
        // Execute deposit in target vault
        IHyperIndexVault targetVault = IHyperIndexVault(operation.vault);
        
        // For deposits, call the vault's deposit function
        targetVault.deposit(operation.assets, operation.user);
    }
    
    /**
     * @dev Generate unique operation ID
     * @param operation Vault operation details
     * @return operationId Unique identifier
     */
    function _generateOperationId(VaultOperation memory operation) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            operation.user,
            operation.vault,
            operation.indexTokenId,
            operation.assets,
            operation.timestamp,
            operation.nonce,
            operation.srcChainId
        ));
    }
    
    /**
     * @dev Estimate LayerZero message fees
     * @param payload Message payload to estimate
     * @return nativeFee Native token fee required
     * @return zroFee ZRO token fee required
     */
    function estimateMessageFees(bytes calldata payload) 
        external 
        view 
        returns (uint256 nativeFee, uint256 zroFee) 
    {
        return lzEndpoint.estimateFees(
            HYPER_EVM_LZ_CHAIN_ID,
            address(this),
            payload,
            false,
            bytes("")
        );
    }
    
    /**
     * @dev Get message status
     * @param messageHash Message hash to check
     * @return status Current message status
     */
    function getMessageStatus(bytes32 messageHash) external view returns (MessageStatus status) {
        return messageStatus[messageHash];
    }
    
    /**
     * @dev Admin function to add/update chain configuration
     * @param chainId Chain ID (standard)
     * @param lzChainId LayerZero chain ID
     */
    function addChainConfiguration(uint256 chainId, uint16 lzChainId) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(chainId > 0, "LayerZeroMessaging: invalid chain ID");
        require(lzChainId > 0, "LayerZeroMessaging: invalid LZ chain ID");
        
        chainIdToLzChainId[chainId] = lzChainId;
        lzChainIdToChainId[lzChainId] = chainId;
        
        emit ChainConfigurationUpdated(chainId, lzChainId, true);
    }
    
    /**
     * @dev Admin function to remove chain configuration
     * @param chainId Chain ID to remove
     */
    function removeChainConfiguration(uint256 chainId) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        uint16 lzChainId = chainIdToLzChainId[chainId];
        require(lzChainId != 0, "LayerZeroMessaging: chain not configured");
        
        delete chainIdToLzChainId[chainId];
        delete lzChainIdToChainId[lzChainId];
        
        emit ChainConfigurationUpdated(chainId, lzChainId, false);
    }
    
    /**
     * @dev Check if chain is supported
     * @param chainId Chain ID to check
     * @return supported Whether chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool supported) {
        return chainIdToLzChainId[chainId] != 0;
    }
    
    /**
     * @dev Get supported chains
     * @return chains Array of supported chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory chains) {
        // This would need to be implemented with a storage array
        // For simplicity, returning hardcoded values
        chains = new uint256[](5);
        chains[0] = 1;      // Ethereum
        chains[1] = 56;     // BNB
        chains[2] = 137;    // Polygon
        chains[3] = 42161;  // Arbitrum
        chains[4] = HYPER_EVM_CHAIN_ID; // HyperEVM
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
    
    /**
     * @dev Withdraw any stuck native tokens (admin only)
     */
    function withdrawStuckNative(address payable recipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(recipient != address(0), "LayerZeroMessaging: invalid recipient");
        uint256 balance = address(this).balance;
        require(balance > 0, "LayerZeroMessaging: no balance to withdraw");
        
        (bool success, ) = recipient.call{value: balance}("");
        require(success, "LayerZeroMessaging: withdrawal failed");
    }
    
    /**
     * @dev Allow contract to receive native tokens for LayerZero fees
     */
    receive() external payable {}
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}