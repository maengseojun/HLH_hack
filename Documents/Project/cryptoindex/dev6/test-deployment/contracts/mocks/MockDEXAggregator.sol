// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IDEXAggregator.sol";
import "../interfaces/IPriceFeed.sol";

/**
 * @title MockDEXAggregator
 * @dev Mock implementation of DEX aggregator (simulating 1inch functionality)
 * @notice Provides simulated token swapping for testing purposes
 */
contract MockDEXAggregator is IDEXAggregator, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IPriceFeed public priceFeed;
    
    // Supported tokens and their metadata
    mapping(address => bool) public supportedTokens;
    mapping(address => uint8) public tokenDecimals;
    mapping(address => string) public tokenSymbols;
    address[] public tokenList;
    
    // Protocol simulation
    string[] public protocols = ["UniswapV3", "SushiSwap", "PancakeSwap", "Curve"];
    mapping(string => bool) public protocolActive;
    
    // Swap configuration
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public swapFee = 30; // 0.3% default fee
    uint256 public slippageTolerance = 100; // 1% default slippage
    
    // Statistics
    uint256 public totalSwapsExecuted;
    uint256 public totalVolumeUSD;
    
    constructor(address _priceFeed) Ownable(msg.sender) {
        priceFeed = IPriceFeed(_priceFeed);
        
        // Initialize protocols
        for (uint i = 0; i < protocols.length; i++) {
            protocolActive[protocols[i]] = true;
        }
    }
    
    /**
     * @dev Add supported token
     */
    function addSupportedToken(
        address token,
        uint8 decimals,
        string memory symbol
    ) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");
        
        supportedTokens[token] = true;
        tokenDecimals[token] = decimals;
        tokenSymbols[token] = symbol;
        tokenList.push(token);
        
        emit TokenAdded(token, symbol);
    }
    
    /**
     * @dev Get quote for token swap
     */
    function getQuote(
        address srcToken,
        address destToken,
        uint256 amount
    ) external view override returns (QuoteResult memory result) {
        require(supportedTokens[srcToken], "Source token not supported");
        require(supportedTokens[destToken], "Destination token not supported");
        require(amount > 0, "Amount must be positive");
        
        // Get prices from price feed (assuming prices are in USDC with 18 decimals)
        uint256 srcPrice = _getTokenPrice(srcToken);
        uint256 destPrice = _getTokenPrice(destToken);
        
        // Calculate expected return considering decimals
        uint256 srcDecimals = tokenDecimals[srcToken];
        uint256 destDecimals = tokenDecimals[destToken];
        
        // Convert to USD value, then to destination token
        uint256 usdValue = (amount * srcPrice) / (10 ** srcDecimals);
        uint256 returnAmount = (usdValue * (10 ** destDecimals)) / destPrice;
        
        // Apply fee and slippage
        returnAmount = (returnAmount * (FEE_DENOMINATOR - swapFee)) / FEE_DENOMINATOR;
        returnAmount = (returnAmount * (FEE_DENOMINATOR - slippageTolerance)) / FEE_DENOMINATOR;
        
        // Mock distribution (simplified)
        uint256[] memory distribution = new uint256[](protocols.length);
        distribution[0] = 6000; // 60% UniswapV3
        distribution[1] = 2500; // 25% SushiSwap
        distribution[2] = 1000; // 10% PancakeSwap
        distribution[3] = 500;  // 5% Curve
        
        // Mock protocol names
        string[] memory protocolNames = new string[](2);
        protocolNames[0] = "UniswapV3";
        protocolNames[1] = "SushiSwap";
        
        result = QuoteResult({
            returnAmount: returnAmount,
            distribution: distribution,
            estimatedGas: 150000, // Mock gas estimate
            protocols: protocolNames
        });
        
        // emit QuoteRequested(srcToken, destToken, amount, returnAmount); // Removed from view function
    }
    
    /**
     * @dev Execute token swap
     */
    function swap(
        SwapParams calldata params
    ) external payable override nonReentrant returns (SwapResult memory result) {
        require(supportedTokens[params.srcToken], "Source token not supported");
        require(supportedTokens[params.destToken], "Destination token not supported");
        require(params.amount > 0, "Amount must be positive");
        
        // Get current quote
        QuoteResult memory quote = this.getQuote(params.srcToken, params.destToken, params.amount);
        require(quote.returnAmount >= params.minReturn, "Return amount too low");
        
        // Transfer source tokens from user
        IERC20(params.srcToken).safeTransferFrom(msg.sender, address(this), params.amount);
        
        // Simulate swap execution
        uint256 actualReturn = _executeSwap(
            params.srcToken,
            params.destToken,
            params.amount,
            quote.returnAmount
        );
        
        // Transfer destination tokens to user
        IERC20(params.destToken).safeTransfer(msg.sender, actualReturn);
        
        // Update statistics
        totalSwapsExecuted++;
        uint256 usdVolume = (params.amount * _getTokenPrice(params.srcToken)) / (10 ** tokenDecimals[params.srcToken]);
        totalVolumeUSD += usdVolume;
        
        result = SwapResult({
            returnAmount: actualReturn,
            spentAmount: params.amount,
            gasUsed: gasleft(), // Simplified gas tracking
            protocol: quote.protocols[0] // Use primary protocol
        });
        
        emit SwapExecuted(
            params.srcToken,
            params.destToken,
            msg.sender,
            params.amount,
            actualReturn,
            result.protocol
        );
    }
    
    /**
     * @dev Get supported tokens
     */
    function getSupportedTokens() external view override returns (address[] memory) {
        return tokenList;
    }
    
    /**
     * @dev Check if token pair is supported
     */
    function isPairSupported(address tokenA, address tokenB) external view override returns (bool) {
        return supportedTokens[tokenA] && supportedTokens[tokenB];
    }
    
    /**
     * @dev Get available protocols
     */
    function getProtocols() external view override returns (string[] memory) {
        uint256 activeCount = 0;
        for (uint i = 0; i < protocols.length; i++) {
            if (protocolActive[protocols[i]]) {
                activeCount++;
            }
        }
        
        string[] memory activeProtocols = new string[](activeCount);
        uint256 index = 0;
        for (uint i = 0; i < protocols.length; i++) {
            if (protocolActive[protocols[i]]) {
                activeProtocols[index] = protocols[i];
                index++;
            }
        }
        
        return activeProtocols;
    }
    
    /**
     * @dev Get exchange rate
     */
    function getExchangeRate(
        address srcToken,
        address destToken,
        uint256 amount
    ) external view override returns (uint256 rate) {
        QuoteResult memory quote = this.getQuote(srcToken, destToken, amount);
        rate = (quote.returnAmount * (10 ** tokenDecimals[srcToken])) / amount;
    }
    
    /**
     * @dev Execute actual swap (internal simulation)
     */
    function _executeSwap(
        address srcToken,
        address destToken,
        uint256 srcAmount,
        uint256 expectedReturn
    ) internal returns (uint256 actualReturn) {
        // Simulate some randomness in execution (±2% from quote)
        uint256 randomFactor = _pseudoRandom() % 400; // 0-4%
        bool isPositive = (_pseudoRandom() % 2) == 0;
        
        if (isPositive) {
            actualReturn = expectedReturn + (expectedReturn * randomFactor) / 10000;
        } else {
            actualReturn = expectedReturn - (expectedReturn * randomFactor) / 10000;
        }
        
        // Ensure we don't return more than we have
        uint256 available = IERC20(destToken).balanceOf(address(this));
        if (actualReturn > available) {
            actualReturn = available;
        }
        
        return actualReturn;
    }
    
    /**
     * @dev Get token price from price feed
     */
    function _getTokenPrice(address token) internal view returns (uint256) {
        // Map token addresses to price feed indices
        // This is simplified - in production you'd have a proper mapping
        if (StringUtils.equal(tokenSymbols[token], "USDC")) {
            return priceFeed.getPrice(0); // USDC price
        } else if (StringUtils.equal(tokenSymbols[token], "WETH")) {
            return priceFeed.getPrice(1); // WETH price
        } else if (StringUtils.equal(tokenSymbols[token], "WBTC")) {
            return priceFeed.getPrice(2); // WBTC price
        }
        return 1e18; // Default to $1 if unknown
    }
    
    /**
     * @dev Simple pseudo-random function for testing
     */
    function _pseudoRandom() internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % 10000;
    }
    
    /**
     * @dev Fund the aggregator with tokens for swapping
     */
    function fundAggregator(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit AggregatorFunded(token, amount);
    }
    
    /**
     * @dev Set swap fee
     */
    function setSwapFee(uint256 _swapFee) external onlyOwner {
        require(_swapFee <= 1000, "Fee too high"); // Max 10%
        swapFee = _swapFee;
        emit FeeUpdated(_swapFee);
    }
    
    /**
     * @dev Set slippage tolerance
     */
    function setSlippageTolerance(uint256 _slippage) external onlyOwner {
        require(_slippage <= 1000, "Slippage too high"); // Max 10%
        slippageTolerance = _slippage;
        emit SlippageUpdated(_slippage);
    }
    
    // Additional events
    event TokenAdded(address indexed token, string symbol);
    event AggregatorFunded(address indexed token, uint256 amount);
    event FeeUpdated(uint256 newFee);
    event SlippageUpdated(uint256 newSlippage);
}

// String comparison utility
library StringUtils {
    function equal(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}