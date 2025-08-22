// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockLayerZeroEndpoint
 * @dev Mock implementation of LayerZero endpoint for testing purposes
 * @notice This simulates LayerZero V2 endpoint functionality for HyperEVM testnet
 */
contract MockLayerZeroEndpoint {
    
    uint32 public eid; // Endpoint ID
    address public owner;
    
    // Message tracking
    uint64 private nextNonce = 1;
    mapping(address => mapping(uint32 => uint64)) public outboundNonce;
    mapping(address => mapping(uint32 => uint64)) public inboundNonce;
    
    // Message queue for simulation
    struct PendingMessage {
        uint32 srcEid;
        bytes32 sender;
        address receiver;
        bytes message;
        uint256 timestamp;
        bool executed;
    }
    
    PendingMessage[] public pendingMessages;
    mapping(bytes32 => bool) public messageExecuted;
    
    // Events
    event PacketSent(
        uint32 indexed dstEid,
        address indexed sender,
        address indexed receiver,
        bytes message,
        uint64 nonce
    );
    
    event PacketReceived(
        uint32 indexed srcEid,
        bytes32 indexed sender,
        address indexed receiver,
        bytes message,
        uint64 nonce
    );
    
    event MessageExecuted(
        bytes32 indexed messageHash,
        bool success
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(uint32 _eid) {
        eid = _eid;
        owner = msg.sender;
    }
    
    /**
     * @dev Send a message to another chain (simulated)
     * @param _dstEid Destination endpoint ID
     * @param _receiver Receiver address on destination chain
     * @param _message Message payload
     * @param _options Execution options (ignored in mock)
     * @param _fee Fee for sending (ignored in mock)
     */
    function send(
        uint32 _dstEid,
        address _receiver,
        bytes calldata _message,
        bytes calldata _options,
        uint256 _fee
    ) external payable returns (uint64 nonce) {
        nonce = nextNonce++;
        outboundNonce[msg.sender][_dstEid] = nonce;
        
        emit PacketSent(_dstEid, msg.sender, _receiver, _message, nonce);
        
        // In a real implementation, this would be handled by LayerZero network
        // For testing, we simulate immediate delivery
        _simulateMessageDelivery(_dstEid, msg.sender, _receiver, _message, nonce);
        
        return nonce;
    }
    
    /**
     * @dev Simulate message delivery (for testing only)
     */
    function _simulateMessageDelivery(
        uint32 _srcEid,
        address _sender,
        address _receiver,
        bytes memory _message,
        uint64 _nonce
    ) internal {
        // Create message hash
        bytes32 messageHash = keccak256(abi.encodePacked(_srcEid, _sender, _receiver, _message, _nonce));
        
        // Add to pending messages
        pendingMessages.push(PendingMessage({
            srcEid: _srcEid,
            sender: bytes32(uint256(uint160(_sender))),
            receiver: _receiver,
            message: _message,
            timestamp: block.timestamp,
            executed: false
        }));
        
        emit PacketReceived(_srcEid, bytes32(uint256(uint160(_sender))), _receiver, _message, _nonce);
    }
    
    /**
     * @dev Execute a pending message (simulating LayerZero execution)
     * @param _messageIndex Index of message in pending messages array
     */
    function executeMessage(uint256 _messageIndex) external {
        require(_messageIndex < pendingMessages.length, "Invalid message index");
        
        PendingMessage storage message = pendingMessages[_messageIndex];
        require(!message.executed, "Message already executed");
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            message.srcEid,
            message.sender,
            message.receiver,
            message.message,
            _messageIndex
        ));
        
        require(!messageExecuted[messageHash], "Message hash already executed");
        
        message.executed = true;
        messageExecuted[messageHash] = true;
        inboundNonce[message.receiver][message.srcEid]++;
        
        // Try to execute the message on the receiver contract
        bool success = false;
        if (message.receiver.code.length > 0) {
            try ILayerZeroReceiver(message.receiver).lzReceive(
                message.srcEid,
                message.sender,
                inboundNonce[message.receiver][message.srcEid],
                message.message
            ) {
                success = true;
            } catch {
                success = false;
            }
        }
        
        emit MessageExecuted(messageHash, success);
    }
    
    /**
     * @dev Get quote for sending a message (always returns 0 for mock)
     */
    function quote(
        uint32 _dstEid,
        address _sender,
        bytes calldata _message,
        bytes calldata _options
    ) external pure returns (uint256 fee) {
        // Mock implementation - no fees
        return 0;
    }
    
    /**
     * @dev Get pending messages count
     */
    function getPendingMessagesCount() external view returns (uint256) {
        return pendingMessages.length;
    }
    
    /**
     * @dev Get pending message details
     */
    function getPendingMessage(uint256 _index) external view returns (
        uint32 srcEid,
        bytes32 sender,
        address receiver,
        bytes memory msgData,
        uint256 timestamp,
        bool executed
    ) {
        require(_index < pendingMessages.length, "Invalid index");
        PendingMessage memory pendingMsg = pendingMessages[_index];
        return (pendingMsg.srcEid, pendingMsg.sender, pendingMsg.receiver, pendingMsg.message, pendingMsg.timestamp, pendingMsg.executed);
    }
    
    /**
     * @dev Set endpoint ID (only for testing)
     */
    function setEid(uint32 _newEid) external onlyOwner {
        eid = _newEid;
    }
}

/**
 * @title ILayerZeroReceiver
 * @dev Interface for contracts that can receive LayerZero messages
 */
interface ILayerZeroReceiver {
    function lzReceive(
        uint32 _srcEid,
        bytes32 _sender,
        uint64 _nonce,
        bytes calldata _message
    ) external;
}