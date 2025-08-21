// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../LayerZeroMessaging.sol";

/**
 * @title MockLayerZeroEndpoint
 * @dev Mock implementation of LayerZero Endpoint for testing
 * @notice Simulates LayerZero V2 endpoint behavior for cross-chain messaging tests
 */
contract MockLayerZeroEndpoint {
    
    // Message tracking for simulation
    mapping(bytes32 => MessageInfo) public sentMessages;
    mapping(address => uint256) public messageNonces;
    
    struct MessageInfo {
        uint16 srcChainId;
        uint16 dstChainId;
        address srcAddress;
        bytes destination;
        bytes payload;
        uint256 timestamp;
        bool delivered;
        uint256 nativeFee;
    }
    
    // Mock chain configurations
    mapping(uint16 => ChainConfig) public chainConfigs;
    
    struct ChainConfig {
        uint16 chainId;
        string name;
        bool isActive;
        uint256 baseFee;
        uint256 gasPerByte;
    }
    
    // Events
    event MessageSent(
        uint16 indexed dstChainId,
        address indexed srcAddress,
        bytes destination,
        bytes payload,
        bytes32 messageHash,
        uint256 nativeFee
    );
    
    event MessageDelivered(
        uint16 indexed srcChainId,
        address indexed dstAddress,
        bytes payload,
        bytes32 messageHash
    );
    
    event FeeEstimated(
        uint16 dstChainId,
        address userApplication,
        uint256 payloadSize,
        uint256 nativeFee,
        uint256 zroFee
    );
    
    constructor() {
        // Initialize mock chain configurations
        _initializeChainConfigs();
    }
    
    /**
     * @dev Initialize mock chain configurations
     */
    function _initializeChainConfigs() internal {
        // Ethereum Mainnet
        chainConfigs[101] = ChainConfig({
            chainId: 101,
            name: "Ethereum",
            isActive: true,
            baseFee: 0.001 ether,
            gasPerByte: 16
        });
        
        // Polygon
        chainConfigs[109] = ChainConfig({
            chainId: 109,
            name: "Polygon",
            isActive: true,
            baseFee: 0.0001 ether,
            gasPerByte: 8
        });
        
        // Arbitrum
        chainConfigs[110] = ChainConfig({
            chainId: 110,
            name: "Arbitrum",
            isActive: true,
            baseFee: 0.0005 ether,
            gasPerByte: 4
        });
        
        // HyperEVM testnet
        chainConfigs[30000] = ChainConfig({
            chainId: 30000,
            name: "HyperEVM",
            isActive: true,
            baseFee: 0.0001 ether,
            gasPerByte: 2
        });
    }
    
    /**
     * @dev Mock implementation of LayerZero send function
     * @param _dstChainId Destination LayerZero chain ID
     * @param _destination Destination address (encoded)
     * @param _payload Message payload
     * @param _refundAddress Refund address for excess gas
     * @param _zroPaymentAddress ZRO payment address (not used in mock)
     * @param _adapterParams Adapter parameters (not used in mock)
     */
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable {
        require(chainConfigs[_dstChainId].isActive, "MockLZEndpoint: destination chain not active");
        require(_destination.length > 0, "MockLZEndpoint: invalid destination");
        require(_payload.length > 0, "MockLZEndpoint: empty payload");
        
        // Calculate required fee
        (uint256 nativeFee, ) = this.estimateFees(_dstChainId, msg.sender, _payload, false, _adapterParams);
        require(msg.value >= nativeFee, "MockLZEndpoint: insufficient fee");
        
        // Generate message hash
        bytes32 messageHash = keccak256(abi.encodePacked(
            block.chainid,
            _dstChainId,
            msg.sender,
            _destination,
            _payload,
            block.timestamp,
            messageNonces[msg.sender]++
        ));
        
        // Store message info
        sentMessages[messageHash] = MessageInfo({
            srcChainId: uint16(block.chainid),
            dstChainId: _dstChainId,
            srcAddress: msg.sender,
            destination: _destination,
            payload: _payload,
            timestamp: block.timestamp,
            delivered: false,
            nativeFee: nativeFee
        });
        
        emit MessageSent(
            _dstChainId,
            msg.sender,
            _destination,
            _payload,
            messageHash,
            nativeFee
        );
        
        // Simulate instant delivery for testing
        _simulateDelivery(messageHash);
        
        // Refund excess fee
        if (msg.value > nativeFee) {
            uint256 refund = msg.value - nativeFee;
            _refundAddress.transfer(refund);
        }
    }
    
    /**
     * @dev Simulate message delivery to destination
     * @param messageHash Hash of the message to deliver
     */
    function _simulateDelivery(bytes32 messageHash) internal {
        MessageInfo storage message = sentMessages[messageHash];
        require(!message.delivered, "MockLZEndpoint: message already delivered");
        
        // Decode destination address
        address dstAddress = abi.decode(message.destination, (address));
        
        // Mark as delivered
        message.delivered = true;
        
        // Call lzReceive on destination contract
        try ILayerZeroReceiver(dstAddress).lzReceive(
            message.srcChainId,
            abi.encodePacked(message.srcAddress),
            uint64(messageNonces[message.srcAddress] - 1), // Use the nonce that was incremented
            message.payload
        ) {
            emit MessageDelivered(
                message.srcChainId,
                dstAddress,
                message.payload,
                messageHash
            );
        } catch Error(string memory reason) {
            // Message delivery failed, but we'll still mark as delivered for testing
            emit MessageDelivered(
                message.srcChainId,
                dstAddress,
                message.payload,
                messageHash
            );
        }
    }
    
    /**
     * @dev Estimate LayerZero messaging fees
     * @param _dstChainId Destination LayerZero chain ID
     * @param _userApplication User application address
     * @param _payload Message payload
     * @param _payInZRO Whether to pay in ZRO tokens
     * @param _adapterParam Adapter parameters
     * @return nativeFee Native token fee required
     * @return zroFee ZRO token fee required (always 0 in mock)
     */
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParam
    ) external view returns (uint nativeFee, uint zroFee) {
        require(chainConfigs[_dstChainId].isActive, "MockLZEndpoint: destination chain not active");
        
        ChainConfig memory config = chainConfigs[_dstChainId];
        
        // Calculate fee based on payload size and destination chain
        uint256 payloadFee = _payload.length * config.gasPerByte;
        nativeFee = config.baseFee + payloadFee;
        
        // ZRO fee is always 0 in mock (we don't simulate ZRO token payments)
        zroFee = 0;
        
        // emit FeeEstimated(_dstChainId, _userApplication, _payload.length, nativeFee, zroFee);
    }
    
    /**
     * @dev Get message information by hash
     * @param messageHash Hash of the message
     * @return info Message information struct
     */
    function getMessageInfo(bytes32 messageHash) external view returns (MessageInfo memory info) {
        return sentMessages[messageHash];
    }
    
    /**
     * @dev Check if message has been delivered
     * @param messageHash Hash of the message
     * @return delivered Whether message was delivered
     */
    function isMessageDelivered(bytes32 messageHash) external view returns (bool delivered) {
        return sentMessages[messageHash].delivered;
    }
    
    /**
     * @dev Get chain configuration
     * @param lzChainId LayerZero chain ID
     * @return config Chain configuration
     */
    function getChainConfig(uint16 lzChainId) external view returns (ChainConfig memory config) {
        return chainConfigs[lzChainId];
    }
    
    /**
     * @dev Admin function to update chain configuration
     * @param lzChainId LayerZero chain ID
     * @param name Chain name
     * @param isActive Whether chain is active
     * @param baseFee Base fee for the chain
     * @param gasPerByte Gas cost per byte
     */
    function updateChainConfig(
        uint16 lzChainId,
        string calldata name,
        bool isActive,
        uint256 baseFee,
        uint256 gasPerByte
    ) external {
        chainConfigs[lzChainId] = ChainConfig({
            chainId: lzChainId,
            name: name,
            isActive: isActive,
            baseFee: baseFee,
            gasPerByte: gasPerByte
        });
    }
    
    /**
     * @dev Get total messages sent from an address
     * @param sender Address to check
     * @return count Number of messages sent
     */
    function getMessageCount(address sender) external view returns (uint256 count) {
        return messageNonces[sender];
    }
    
    /**
     * @dev Manually trigger message delivery (for testing edge cases)
     * @param messageHash Hash of the message to deliver
     */
    function manualDelivery(bytes32 messageHash) external {
        require(!sentMessages[messageHash].delivered, "MockLZEndpoint: already delivered");
        _simulateDelivery(messageHash);
    }
    
    /**
     * @dev Get contract balance
     * @return balance Current native token balance
     */
    function getBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }
    
    /**
     * @dev Allow contract to receive native tokens
     */
    receive() external payable {}
}

/**
 * @dev Interface for LayerZero message receiver
 */
interface ILayerZeroReceiver {
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external;
}