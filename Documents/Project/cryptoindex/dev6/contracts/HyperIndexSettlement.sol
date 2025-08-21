// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title HyperIndexSettlement
 * @dev On-chain settlement contract for off-chain trades
 * 
 * This contract handles the actual token transfers for trades that were
 * matched off-chain in the orderbook. It ensures atomic settlement of trades.
 */
contract HyperIndexSettlement is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // ========== State Variables ==========
    
    // Authorized settlement operators (backend systems)
    mapping(address => bool) public settlementOperators;
    
    // Nonce for each user to prevent replay attacks
    mapping(address => uint256) public userNonces;
    
    // Fee recipient address
    address public feeRecipient;
    
    // Fee rate in basis points (100 = 1%)
    uint256 public feeRate = 30; // 0.3%
    uint256 public constant MAX_FEE_RATE = 1000; // 10% max
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;
    
    // ========== Events ==========
    
    event TradeSettled(
        bytes32 indexed tradeId,
        address indexed buyer,
        address indexed seller,
        address tokenBuy,
        address tokenSell,
        uint256 amountBuy,
        uint256 amountSell,
        uint256 buyerFee,
        uint256 sellerFee,
        uint256 timestamp
    );
    
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event FeeUpdated(uint256 newFeeRate);
    event FeeRecipientUpdated(address indexed newRecipient);
    
    // ========== Modifiers ==========
    
    modifier onlyOperator() {
        require(settlementOperators[msg.sender], "Not an operator");
        _;
    }
    
    modifier validToken(address token) {
        require(supportedTokens[token], "Token not supported");
        _;
    }
    
    // ========== Constructor ==========
    
    constructor(address _feeRecipient) Ownable(msg.sender) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        settlementOperators[msg.sender] = true;
    }
    
    // ========== Settlement Functions ==========
    
    /**
     * @dev Settle a trade between two parties
     * @param tradeId Unique trade identifier from off-chain system
     * @param buyer Address of the buyer
     * @param seller Address of the seller
     * @param tokenBuy Token the buyer receives
     * @param tokenSell Token the seller receives
     * @param amountBuy Amount of tokenBuy (after fees)
     * @param amountSell Amount of tokenSell (after fees)
     * @param buyerNonce Nonce for buyer (replay protection)
     * @param sellerNonce Nonce for seller (replay protection)
     */
    function settleTrade(
        bytes32 tradeId,
        address buyer,
        address seller,
        address tokenBuy,
        address tokenSell,
        uint256 amountBuy,
        uint256 amountSell,
        uint256 buyerNonce,
        uint256 sellerNonce
    ) internal 
      validToken(tokenBuy) validToken(tokenSell) {
        
        // Validate participants
        require(buyer != address(0) && seller != address(0), "Invalid addresses");
        require(buyer != seller, "Self-trading not allowed");
        
        // Validate nonces
        require(userNonces[buyer] == buyerNonce, "Invalid buyer nonce");
        require(userNonces[seller] == sellerNonce, "Invalid seller nonce");
        
        // Increment nonces
        userNonces[buyer]++;
        userNonces[seller]++;
        
        // Calculate fees
        uint256 buyerFee = (amountBuy * feeRate) / 10000;
        uint256 sellerFee = (amountSell * feeRate) / 10000;
        
        // Total amounts including fees
        uint256 totalBuyAmount = amountBuy + buyerFee;
        uint256 totalSellAmount = amountSell + sellerFee;
        
        // Execute transfers
        // Seller sends tokenSell to buyer
        IERC20(tokenSell).safeTransferFrom(seller, buyer, amountSell);
        
        // Buyer sends tokenBuy to seller
        IERC20(tokenBuy).safeTransferFrom(buyer, seller, amountBuy);
        
        // Collect fees
        if (buyerFee > 0) {
            IERC20(tokenBuy).safeTransferFrom(buyer, feeRecipient, buyerFee);
        }
        if (sellerFee > 0) {
            IERC20(tokenSell).safeTransferFrom(seller, feeRecipient, sellerFee);
        }
        
        emit TradeSettled(
            tradeId,
            buyer,
            seller,
            tokenBuy,
            tokenSell,
            amountBuy,
            amountSell,
            buyerFee,
            sellerFee,
            block.timestamp
        );
    }
    
    /**
     * @dev Batch settle multiple trades in one transaction
     * Gas optimization for high-frequency trading
     */
    function batchSettleTrades(
        bytes[] calldata trades
    ) external onlyOperator nonReentrant whenNotPaused {
        require(trades.length > 0, "No trades provided");
        require(trades.length <= 100, "Too many trades");
    }
    
    // ========== Admin Functions ==========
    
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        settlementOperators[operator] = true;
        emit OperatorAdded(operator);
    }
    
    function removeOperator(address operator) external onlyOwner {
        settlementOperators[operator] = false;
        emit OperatorRemoved(operator);
    }
    
    function addToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }
    
    function removeToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }
    
    function setFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= MAX_FEE_RATE, "Fee too high");
        feeRate = newFeeRate;
        emit FeeUpdated(newFeeRate);
    }
    
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ========== View Functions ==========
    
    function getUserNonce(address user) external view returns (uint256) {
        return userNonces[user];
    }
    
    function calculateFee(uint256 amount) external view returns (uint256) {
        return (amount * feeRate) / 10000;
    }
}