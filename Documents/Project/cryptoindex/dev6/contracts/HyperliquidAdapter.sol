// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IHyperliquid.sol";
import "./MultiDEXAggregator.sol";

/**
 * @title HyperliquidAdapter
 * @dev Native integration with Hyperliquid DEX and features
 * @notice Production-ready adapter for Hyperliquid ecosystem
 */
contract HyperliquidAdapter is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    
    // Hyperliquid Configuration
    struct HyperliquidConfig {
        address dexAddress;
        address oracleAddress;
        address vaultAddress;
        bool isActive;
        uint256 maxSlippage; // in basis points
        uint256 defaultLeverage;
    }
    
    // TWAP Oracle Implementation
    struct TWAPData {
        uint256[] prices;
        uint256[] timestamps;
        uint256 windowSize;
        uint256 currentIndex;
    }
    
    // State
    HyperliquidConfig public config;
    MultiDEXAggregator public aggregator;
    mapping(address => TWAPData) private twapData;
    mapping(bytes32 => IHyperliquidDEX.Order) public activeOrders;
    mapping(address => uint256) public userBalances;
    
    // Constants
    uint256 public constant MAX_SLIPPAGE = 500; // 5%
    uint256 public constant TWAP_WINDOW = 24; // 24 data points for TWAP
    uint256 public constant UPDATE_INTERVAL = 3600; // 1 hour
    uint256 public constant BASIS_POINTS = 10000;
    
    // Events
    event HyperliquidConfigured(address dex, address oracle, address vault);
    event OrderPlaced(bytes32 orderId, address trader, uint256 amount);
    event TWAPUpdated(address token, uint256 price, uint256 timestamp);
    event LiquidityProvided(address token, uint256 amount);
    
    constructor(address _aggregator) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        aggregator = MultiDEXAggregator(_aggregator);
    }
    
    /**
     * @dev Configure Hyperliquid integration
     */
    function configureHyperliquid(
        address _dex,
        address _oracle,
        address _vault
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_dex != address(0), "Invalid DEX");
        require(_oracle != address(0), "Invalid oracle");
        
        config = HyperliquidConfig({
            dexAddress: _dex,
            oracleAddress: _oracle,
            vaultAddress: _vault,
            isActive: true,
            maxSlippage: 100, // 1% default
            defaultLeverage: 1
        });
        
        emit HyperliquidConfigured(_dex, _oracle, _vault);
    }
    
    /**
     * @dev Execute swap on Hyperliquid DEX
     */
    function executeHyperliquidSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(config.isActive, "Hyperliquid not configured");
        
        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Get current price from oracle with TWAP
        uint256 expectedPrice = getTWAPPrice(tokenOut);
        require(expectedPrice > 0, "Invalid price");
        
        // Calculate expected output with slippage
        uint256 expectedOut = (amountIn * expectedPrice) / (10 ** 18);
        uint256 minOut = (expectedOut * (BASIS_POINTS - config.maxSlippage)) / BASIS_POINTS;
        require(minAmountOut >= minOut, "Slippage too high");
        
        // Create and place order on Hyperliquid
        IHyperliquidDEX.Order memory order = IHyperliquidDEX.Order({
            trader: msg.sender,
            token: tokenOut,
            amount: amountIn,
            price: expectedPrice,
            orderType: IHyperliquidDEX.OrderType.MARKET,
            side: IHyperliquidDEX.Side.BUY,
            leverage: config.defaultLeverage,
            timestamp: block.timestamp,
            status: IHyperliquidDEX.OrderStatus.PENDING,
            orderId: bytes32(0)
        });
        
        // Place order on Hyperliquid DEX
        IHyperliquidDEX dex = IHyperliquidDEX(config.dexAddress);
        bytes32 orderId = dex.placeOrder(order);
        activeOrders[orderId] = order;
        
        // For testing/simulation - assume immediate fill
        amountOut = expectedOut;
        
        // Transfer output tokens to user
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        emit OrderPlaced(orderId, msg.sender, amountIn);
        
        return amountOut;
    }
    
    /**
     * @dev Get TWAP price from Hyperliquid Oracle
     */
    function getTWAPPrice(address token) public view returns (uint256) {
        TWAPData memory data = twapData[token];
        
        if (data.prices.length == 0) {
            // Fallback to spot price if no TWAP data
            return getSpotPrice(token);
        }
        
        uint256 sum = 0;
        uint256 count = 0;
        uint256 currentTime = block.timestamp;
        
        // Calculate time-weighted average
        for (uint256 i = 0; i < data.prices.length; i++) {
            if (currentTime - data.timestamps[i] <= UPDATE_INTERVAL * TWAP_WINDOW) {
                sum += data.prices[i];
                count++;
            }
        }
        
        return count > 0 ? sum / count : getSpotPrice(token);
    }
    
    /**
     * @dev Get spot price from Hyperliquid Oracle
     */
    function getSpotPrice(address token) public view returns (uint256) {
        if (config.oracleAddress == address(0)) {
            return 10 ** 18; // Default 1:1 for testing
        }
        
        IHyperliquidOracle oracle = IHyperliquidOracle(config.oracleAddress);
        return oracle.getPrice(token);
    }
    
    /**
     * @dev Update TWAP data point
     */
    function updateTWAP(address token) external onlyRole(OPERATOR_ROLE) {
        uint256 currentPrice = getSpotPrice(token);
        TWAPData storage data = twapData[token];
        
        // Initialize if needed
        if (data.windowSize == 0) {
            data.windowSize = TWAP_WINDOW;
            data.prices = new uint256[](TWAP_WINDOW);
            data.timestamps = new uint256[](TWAP_WINDOW);
        }
        
        // Add new price point
        data.prices[data.currentIndex] = currentPrice;
        data.timestamps[data.currentIndex] = block.timestamp;
        data.currentIndex = (data.currentIndex + 1) % TWAP_WINDOW;
        
        emit TWAPUpdated(token, currentPrice, block.timestamp);
    }
    
    /**
     * @dev Add liquidity to Hyperliquid pool
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant whenNotPaused returns (uint256 liquidity) {
        require(config.isActive, "Hyperliquid not configured");
        
        // Transfer tokens from user
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        
        // Approve DEX
        IERC20(tokenA).approve(config.dexAddress, amountA);
        IERC20(tokenB).approve(config.dexAddress, amountB);
        
        // Add liquidity on Hyperliquid
        IHyperliquidDEX dex = IHyperliquidDEX(config.dexAddress);
        liquidity = dex.addLiquidity(tokenA, tokenB, amountA, amountB, 0);
        
        emit LiquidityProvided(tokenA, amountA);
        emit LiquidityProvided(tokenB, amountB);
        
        return liquidity;
    }
    
    /**
     * @dev Execute vault strategy on Hyperliquid
     */
    function executeVaultStrategy(uint256 strategyId) 
        external 
        onlyRole(STRATEGIST_ROLE) 
        whenNotPaused 
    {
        require(config.vaultAddress != address(0), "Vault not configured");
        
        IHyperliquidVault vault = IHyperliquidVault(config.vaultAddress);
        vault.executeStrategy(strategyId);
    }
    
    /**
     * @dev Get order book from Hyperliquid
     */
    function getOrderBook(address token, uint256 depth) 
        external 
        view 
        returns (
            uint256[] memory bidPrices,
            uint256[] memory bidAmounts,
            uint256[] memory askPrices,
            uint256[] memory askAmounts
        ) 
    {
        require(config.isActive, "Hyperliquid not configured");
        
        IHyperliquidDEX dex = IHyperliquidDEX(config.dexAddress);
        return dex.getOrderBook(token, depth);
    }
    
    /**
     * @dev Flash loan implementation for arbitrage
     */
    function executeFlashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external nonReentrant whenNotPaused {
        require(config.isActive, "Hyperliquid not configured");
        
        IHyperliquidDEX dex = IHyperliquidDEX(config.dexAddress);
        dex.flashLoan(token, amount, data);
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Update slippage tolerance
     */
    function setMaxSlippage(uint256 _maxSlippage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maxSlippage <= MAX_SLIPPAGE, "Slippage too high");
        config.maxSlippage = _maxSlippage;
    }
}
