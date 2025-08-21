// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Decentralized Sequencer Network for HyperIndex
 * @dev Implements a rotating, slashable sequencer system for off-chain orderbook
 * Inspired by dYdX v4 validator model, optimized for HyperEVM
 */
contract HyperEVMSequencerNetwork is ReentrancyGuard, Ownable {
    
    // ==================== STRUCTS ====================
    
    struct SequencerNode {
        address operator;           // Sequencer operator address
        uint256 stakeAmount;       // HYPE tokens staked
        uint256 reputation;        // Performance-based reputation (0-10000)
        uint256 slashCount;        // Number of times slashed
        uint256 totalMatched;      // Total orders matched
        uint256 averageLatency;    // Average response time (ms)
        uint256 lastActiveBlock;   // Last block when active
        bool isActive;             // Currently active status
        bool isSlashed;           // Currently slashed status
    }
    
    struct SequencerRotation {
        uint256 blockDuration;     // Blocks per sequencer rotation
        uint256 currentEpoch;      // Current rotation epoch
        address currentSequencer;  // Currently active sequencer
        address[] activePool;      // Pool of active sequencers
        uint256 rotationIndex;     // Current rotation index
    }
    
    struct SlashingEvent {
        address sequencer;
        uint256 amount;
        string reason;
        uint256 timestamp;
        bytes proof;
    }
    
    struct PerformanceMetrics {
        uint256 totalTPS;          // Transactions per second
        uint256 averageLatency;    // Average latency in milliseconds  
        uint256 uptime;            // Uptime percentage (0-10000)
        uint256 errorRate;         // Error rate percentage (0-10000)
    }
    
    // ==================== CONSTANTS ====================
    
    uint256 public constant MIN_STAKE = 50000 * 10**18;        // 50,000 HYPE minimum stake
    uint256 public constant MAX_SEQUENCERS = 21;               // Maximum active sequencers (odd for consensus)
    uint256 public constant ROTATION_BLOCKS = 100;             // Blocks per rotation (HyperEVM ~100 seconds)
    uint256 public constant SLASH_PERCENTAGE = 1000;           // 10% slash amount (basis points)
    uint256 public constant MIN_REPUTATION = 7000;             // Minimum reputation to stay active (70%)
    uint256 public constant REPUTATION_DECAY = 50;             // Daily reputation decay (0.5%)
    uint256 public constant PERFORMANCE_WINDOW = 1000;         // Blocks for performance measurement
    
    // Performance thresholds
    uint256 public constant MIN_TPS = 10000;                   // Minimum TPS requirement
    uint256 public constant MAX_LATENCY = 50;                  // Maximum latency (50ms)
    uint256 public constant MIN_UPTIME = 9900;                 // Minimum uptime (99%)
    uint256 public constant MAX_ERROR_RATE = 100;              // Maximum error rate (1%)
    
    // ==================== STATE VARIABLES ====================
    
    IERC20 public immutable HYPE_TOKEN;                        // HYPE staking token
    
    mapping(address => SequencerNode) public sequencers;       // Sequencer details
    mapping(address => bool) public isSequencer;               // Quick sequencer check
    mapping(uint256 => address) public epochToSequencer;       // Epoch to sequencer mapping
    mapping(address => PerformanceMetrics) public performance; // Performance tracking
    
    SequencerRotation public rotation;                         // Current rotation state
    SlashingEvent[] public slashingHistory;                    // Slashing event history
    
    address[] public allSequencers;                            // All sequencer addresses
    uint256 public totalStaked;                                // Total HYPE staked
    uint256 public reputationUpdateBlock;                      // Last reputation update block
    
    // ==================== EVENTS ====================
    
    event SequencerRegistered(address indexed sequencer, uint256 stakeAmount);
    event SequencerRotated(address indexed newSequencer, uint256 epoch, uint256 blockNumber);
    event SequencerSlashed(address indexed sequencer, uint256 amount, string reason);
    event SequencerRemoved(address indexed sequencer, string reason);
    event StakeIncreased(address indexed sequencer, uint256 amount);
    event StakeWithdrawn(address indexed sequencer, uint256 amount);
    event PerformanceUpdated(address indexed sequencer, uint256 tps, uint256 latency, uint256 uptime);
    event EmergencyRotation(address indexed oldSequencer, address indexed newSequencer, string reason);
    
    // ==================== MODIFIERS ====================
    
    modifier onlyActiveSequencer() {
        require(msg.sender == rotation.currentSequencer, "Not current sequencer");
        require(sequencers[msg.sender].isActive, "Sequencer not active");
        _;
    }
    
    modifier validSequencer(address sequencer) {
        require(isSequencer[sequencer], "Not a registered sequencer");
        _;
    }
    
    modifier notSlashed(address sequencer) {
        require(!sequencers[sequencer].isSlashed, "Sequencer is slashed");
        _;
    }
    
    // ==================== CONSTRUCTOR ====================
    
    constructor(address _hypeToken) Ownable(msg.sender) {
        HYPE_TOKEN = IERC20(_hypeToken);
        rotation.blockDuration = ROTATION_BLOCKS;
        rotation.currentEpoch = block.number;
        reputationUpdateBlock = block.number;
    }
    
    // ==================== SEQUENCER MANAGEMENT ====================
    
    /**
     * @dev Register as a new sequencer with stake
     * @param stakeAmount Amount of HYPE tokens to stake
     */
    function registerSequencer(uint256 stakeAmount) external nonReentrant {
        require(!isSequencer[msg.sender], "Already registered");
        require(stakeAmount >= MIN_STAKE, "Insufficient stake");
        require(rotation.activePool.length < MAX_SEQUENCERS, "Max sequencers reached");
        
        // Transfer stake
        require(HYPE_TOKEN.transferFrom(msg.sender, address(this), stakeAmount), "Stake transfer failed");
        
        // Initialize sequencer
        sequencers[msg.sender] = SequencerNode({
            operator: msg.sender,
            stakeAmount: stakeAmount,
            reputation: 10000, // Start with perfect reputation
            slashCount: 0,
            totalMatched: 0,
            averageLatency: 0,
            lastActiveBlock: block.number,
            isActive: true,
            isSlashed: false
        });
        
        isSequencer[msg.sender] = true;
        allSequencers.push(msg.sender);
        rotation.activePool.push(msg.sender);
        totalStaked += stakeAmount;
        
        // Set as current sequencer if first one
        if (rotation.activePool.length == 1) {
            rotation.currentSequencer = msg.sender;
            epochToSequencer[rotation.currentEpoch] = msg.sender;
        }
        
        emit SequencerRegistered(msg.sender, stakeAmount);
    }
    
    /**
     * @dev Increase stake for existing sequencer
     * @param amount Additional HYPE tokens to stake
     */
    function increaseStake(uint256 amount) external validSequencer(msg.sender) nonReentrant {
        require(amount > 0, "Invalid amount");
        require(HYPE_TOKEN.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        sequencers[msg.sender].stakeAmount += amount;
        totalStaked += amount;
        
        emit StakeIncreased(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw stake (only if not active)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external validSequencer(msg.sender) nonReentrant {
        SequencerNode storage sequencer = sequencers[msg.sender];
        require(!sequencer.isActive, "Cannot withdraw while active");
        require(amount <= sequencer.stakeAmount, "Insufficient stake");
        require(sequencer.stakeAmount - amount >= MIN_STAKE || amount == sequencer.stakeAmount, "Below minimum stake");
        
        sequencer.stakeAmount -= amount;
        totalStaked -= amount;
        
        // Remove completely if withdrawing all stake
        if (sequencer.stakeAmount == 0) {
            _removeSequencer(msg.sender, "Stake withdrawn");
        }
        
        require(HYPE_TOKEN.transfer(msg.sender, amount), "Transfer failed");
        emit StakeWithdrawn(msg.sender, amount);
    }
    
    // ==================== ROTATION MECHANISM ====================
    
    /**
     * @dev Rotate to next sequencer (automated)
     */
    function rotateSequencer() external {
        require(block.number >= rotation.currentEpoch + rotation.blockDuration, "Too early for rotation");
        require(rotation.activePool.length > 0, "No active sequencers");
        
        address oldSequencer = rotation.currentSequencer;
        
        // Select next sequencer using weighted random selection
        address nextSequencer = _selectNextSequencer();
        
        // Update rotation state
        rotation.currentSequencer = nextSequencer;
        rotation.currentEpoch = block.number;
        rotation.rotationIndex = (rotation.rotationIndex + 1) % rotation.activePool.length;
        epochToSequencer[rotation.currentEpoch] = nextSequencer;
        
        // Update last active block for old sequencer
        if (oldSequencer != address(0)) {
            sequencers[oldSequencer].lastActiveBlock = block.number;
        }
        
        emit SequencerRotated(nextSequencer, rotation.currentEpoch, block.number);
    }
    
    /**
     * @dev Emergency rotation (by owner or governance)
     * @param reason Reason for emergency rotation
     */
    function emergencyRotation(string calldata reason) external onlyOwner {
        require(rotation.activePool.length > 1, "Need multiple sequencers");
        
        address oldSequencer = rotation.currentSequencer;
        
        // Remove current sequencer from active pool temporarily
        _removeFromActivePool(oldSequencer);
        
        // Select new sequencer
        address newSequencer = _selectNextSequencer();
        
        rotation.currentSequencer = newSequencer;
        rotation.currentEpoch = block.number;
        epochToSequencer[rotation.currentEpoch] = newSequencer;
        
        emit EmergencyRotation(oldSequencer, newSequencer, reason);
    }
    
    /**
     * @dev Select next sequencer using weighted reputation-based selection
     */
    function _selectNextSequencer() internal view returns (address) {
        require(rotation.activePool.length > 0, "No active sequencers");
        
        if (rotation.activePool.length == 1) {
            return rotation.activePool[0];
        }
        
        // Simple round-robin for now (can be upgraded to weighted random)
        uint256 nextIndex = (rotation.rotationIndex + 1) % rotation.activePool.length;
        return rotation.activePool[nextIndex];
    }
    
    // ==================== SLASHING MECHANISM ====================
    
    /**
     * @dev Slash a sequencer for malicious behavior
     * @param sequencer Address of sequencer to slash
     * @param reason Reason for slashing
     * @param proof Proof of malicious behavior
     */
    function slashSequencer(
        address sequencer,
        string calldata reason,
        bytes calldata proof
    ) external onlyOwner validSequencer(sequencer) {
        require(!sequencers[sequencer].isSlashed, "Already slashed");
        
        SequencerNode storage node = sequencers[sequencer];
        uint256 slashAmount = (node.stakeAmount * SLASH_PERCENTAGE) / 10000;
        
        // Apply slashing
        node.stakeAmount -= slashAmount;
        node.slashCount++;
        node.reputation = (node.reputation * 9000) / 10000; // 10% reputation penalty
        node.isSlashed = true;
        
        totalStaked -= slashAmount;
        
        // Record slashing event
        slashingHistory.push(SlashingEvent({
            sequencer: sequencer,
            amount: slashAmount,
            reason: reason,
            timestamp: block.timestamp,
            proof: proof
        }));
        
        // Remove from active pool if reputation too low or stake too low
        if (node.reputation < MIN_REPUTATION || node.stakeAmount < MIN_STAKE) {
            _removeFromActivePool(sequencer);
            node.isActive = false;
        }
        
        // Emergency rotation if current sequencer was slashed
        if (sequencer == rotation.currentSequencer && rotation.activePool.length > 1) {
            address newSequencer = _selectNextSequencer();
            rotation.currentSequencer = newSequencer;
            rotation.currentEpoch = block.number;
        }
        
        emit SequencerSlashed(sequencer, slashAmount, reason);
    }
    
    /**
     * @dev Restore a slashed sequencer (governance decision)
     * @param sequencer Address of sequencer to restore
     */
    function restoreSequencer(address sequencer) external onlyOwner validSequencer(sequencer) {
        require(sequencers[sequencer].isSlashed, "Not slashed");
        require(sequencers[sequencer].stakeAmount >= MIN_STAKE, "Insufficient stake");
        
        sequencers[sequencer].isSlashed = false;
        
        if (!sequencers[sequencer].isActive && rotation.activePool.length < MAX_SEQUENCERS) {
            sequencers[sequencer].isActive = true;
            rotation.activePool.push(sequencer);
        }
    }
    
    // ==================== PERFORMANCE TRACKING ====================
    
    /**
     * @dev Update performance metrics for a sequencer
     * @param sequencer Sequencer address
     * @param tps Transactions per second achieved
     * @param latency Average latency in milliseconds
     * @param uptime Uptime percentage (0-10000)
     * @param errorRate Error rate percentage (0-10000)
     */
    function updatePerformance(
        address sequencer,
        uint256 tps,
        uint256 latency,
        uint256 uptime,
        uint256 errorRate
    ) external onlyOwner validSequencer(sequencer) {
        performance[sequencer] = PerformanceMetrics({
            totalTPS: tps,
            averageLatency: latency,
            uptime: uptime,
            errorRate: errorRate
        });
        
        // Update sequencer's average latency
        sequencers[sequencer].averageLatency = latency;
        
        // Adjust reputation based on performance
        _adjustReputationByPerformance(sequencer, tps, latency, uptime, errorRate);
        
        emit PerformanceUpdated(sequencer, tps, latency, uptime);
    }
    
    /**
     * @dev Adjust sequencer reputation based on performance
     */
    function _adjustReputationByPerformance(
        address sequencer,
        uint256 tps,
        uint256 latency,
        uint256 uptime,
        uint256 errorRate
    ) internal {
        SequencerNode storage node = sequencers[sequencer];
        uint256 newReputation = node.reputation;
        
        // TPS performance
        if (tps >= MIN_TPS * 2) {
            newReputation = _min(newReputation + 50, 10000); // Bonus for high TPS
        } else if (tps < MIN_TPS) {
            newReputation = _max(newReputation - 100, 0); // Penalty for low TPS
        }
        
        // Latency performance
        if (latency <= MAX_LATENCY / 2) {
            newReputation = _min(newReputation + 50, 10000); // Bonus for low latency
        } else if (latency > MAX_LATENCY) {
            newReputation = _max(newReputation - 100, 0); // Penalty for high latency
        }
        
        // Uptime performance
        if (uptime >= MIN_UPTIME) {
            newReputation = _min(newReputation + 25, 10000); // Bonus for good uptime
        } else {
            newReputation = _max(newReputation - 200, 0); // Penalty for poor uptime
        }
        
        // Error rate performance
        if (errorRate > MAX_ERROR_RATE) {
            newReputation = _max(newReputation - 150, 0); // Penalty for high error rate
        }
        
        node.reputation = newReputation;
        
        // Deactivate if reputation too low
        if (newReputation < MIN_REPUTATION && node.isActive) {
            _removeFromActivePool(sequencer);
            node.isActive = false;
        }
    }
    
    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @dev Remove sequencer from active pool
     */
    function _removeFromActivePool(address sequencer) internal {
        for (uint256 i = 0; i < rotation.activePool.length; i++) {
            if (rotation.activePool[i] == sequencer) {
                rotation.activePool[i] = rotation.activePool[rotation.activePool.length - 1];
                rotation.activePool.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Completely remove sequencer
     */
    function _removeSequencer(address sequencer, string memory reason) internal {
        isSequencer[sequencer] = false;
        sequencers[sequencer].isActive = false;
        _removeFromActivePool(sequencer);
        
        emit SequencerRemoved(sequencer, reason);
    }
    
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @dev Get current sequencer information
     */
    function getCurrentSequencer() external view returns (
        address sequencer,
        uint256 epoch,
        uint256 reputation,
        uint256 stakeAmount,
        bool isActive
    ) {
        address current = rotation.currentSequencer;
        SequencerNode memory node = sequencers[current];
        
        return (
            current,
            rotation.currentEpoch,
            node.reputation,
            node.stakeAmount,
            node.isActive
        );
    }
    
    /**
     * @dev Get active sequencer pool
     */
    function getActiveSequencers() external view returns (address[] memory) {
        return rotation.activePool;
    }
    
    /**
     * @dev Get sequencer performance metrics
     */
    function getSequencerPerformance(address sequencer) external view returns (
        uint256 tps,
        uint256 latency,
        uint256 uptime,
        uint256 errorRate,
        uint256 reputation
    ) {
        PerformanceMetrics memory perf = performance[sequencer];
        return (
            perf.totalTPS,
            perf.averageLatency,
            perf.uptime,
            perf.errorRate,
            sequencers[sequencer].reputation
        );
    }
    
    /**
     * @dev Get total network statistics
     */
    function getNetworkStats() external view returns (
        uint256 totalSequencers,
        uint256 activeSequencers,
        uint256 totalStakedAmount,
        uint256 currentEpoch,
        uint256 blocksUntilRotation
    ) {
        uint256 blocksUntilNext = rotation.currentEpoch + rotation.blockDuration > block.number
            ? rotation.currentEpoch + rotation.blockDuration - block.number
            : 0;
            
        return (
            allSequencers.length,
            rotation.activePool.length,
            totalStaked,
            rotation.currentEpoch,
            blocksUntilNext
        );
    }
    
    /**
     * @dev Check if address is current active sequencer
     */
    function isCurrentSequencer(address sequencer) external view returns (bool) {
        return sequencer == rotation.currentSequencer && sequencers[sequencer].isActive;
    }
    
    /**
     * @dev Get slashing history
     */
    function getSlashingHistory() external view returns (SlashingEvent[] memory) {
        return slashingHistory;
    }
}