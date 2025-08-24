// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockLayerZeroEndpoint
 * @dev Enhanced mock for cross-chain messaging
 * Based on: LayerZero V2 Protocol Standards
 */
contract MockLayerZeroEndpoint {
    struct Message {
        uint16 srcChainId;
        bytes srcAddress;
        bytes payload;
        uint256 timestamp;
        uint256 blockNumber;
    }
    
    // ✅ FIX: Message queue for tracking
    Message[] private messageQueue;
    mapping(uint16 => bool) public supportedChains;
    mapping(address => uint256) public nonces;
    
    event MessageSent(
        uint16 indexed dstChainId,
        bytes indexed destination,
        bytes payload,
        uint256 nonce
    );
    
    event MessageReceived(
        uint16 indexed srcChainId,
        bytes indexed srcAddress,
        bytes payload
    );
    
    constructor() {
        // Initialize supported chains
        supportedChains[1] = true;     // Ethereum
        supportedChains[42161] = true; // Arbitrum  
        supportedChains[137] = true;   // Polygon
        supportedChains[998] = true;   // HyperEVM
    }
    
    // ✅ FIX: Missing getMessageQueueLength function
    function getMessageQueueLength() external view returns (uint256) {
        return messageQueue.length;
    }
    
    // ✅ FIX: Enhanced send function
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable {
        require(supportedChains[_dstChainId], "Unsupported destination chain");
        require(_payload.length > 0, "Empty payload");
        
        // Add to message queue
        messageQueue.push(Message({
            srcChainId: _dstChainId,
            srcAddress: _destination,
            payload: _payload,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        
        // Update nonce
        nonces[msg.sender]++;
        
        emit MessageSent(_dstChainId, _destination, _payload, nonces[msg.sender]);
        
        // Simulate successful delivery
        if (_refundAddress != address(0) && msg.value > 0) {
            _refundAddress.transfer(msg.value / 2); // Return half as "change"
        }
    }
    
    // ✅ FIX: Message retrieval functions
    function getMessage(uint256 index) external view returns (Message memory) {
        require(index < messageQueue.length, "Message index out of bounds");
        return messageQueue[index];
    }
    
    function getLatestMessages(uint256 count) external view returns (Message[] memory) {
        uint256 length = messageQueue.length;
        if (count > length) count = length;
        
        Message[] memory latest = new Message[](count);
        for (uint256 i = 0; i < count; i++) {
            latest[i] = messageQueue[length - 1 - i];
        }
        
        return latest;
    }
    
    // ✅ FIX: Simulate message processing
    function processMessage(uint256 messageIndex) external {
        require(messageIndex < messageQueue.length, "Invalid message index");
        
        Message memory message = messageQueue[messageIndex];
        
        emit MessageReceived(
            message.srcChainId,
            message.srcAddress,
            message.payload
        );
    }
    
    // ✅ FIX: Chain management
    function addSupportedChain(uint16 chainId) external {
        supportedChains[chainId] = true;
    }
    
    function removeSupportedChain(uint16 chainId) external {
        supportedChains[chainId] = false;
    }
    
    // ✅ FIX: Fee estimation (mock)
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParam
    ) external view returns (uint256 nativeFee, uint256 zroFee) {
        // Mock fee calculation
        nativeFee = 0.001 ether; // Base fee
        nativeFee += (_payload.length * 100); // Per byte fee
        zroFee = _payInZRO ? nativeFee / 2 : 0;
    }
    
    // ✅ FIX: Utility functions
    function clearMessageQueue() external {
        delete messageQueue;
    }
    
    function isChainSupported(uint16 chainId) external view returns (bool) {
        return supportedChains[chainId];
    }
}