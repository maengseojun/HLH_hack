// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPriceFeed.sol";

/**
 * @title SmartAggregator
 * @dev Advanced DEX aggregator with MEV protection and optimal routing
 * @notice Implements 1inch-style routing with slippage protection
 */
contract SmartAggregator is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Role definitions
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    
    // DEX Router interfaces
    struct DEXInfo {
        address router;
        string name;
        bool isActive;
        uint256 priority; // Lower number = higher priority
    }
    
    // Swap route structure
    struct SwapRoute {
        address[] path;
        uint256[] amounts;
        address[] routers;
        uint256 deadline;
    }
    
    // MEV Protection parameters
    struct MEVProtection {
        uint256 maxSlippage; // Basis points (10000 = 100%)
        uint256 minOutput;
        uint256 maxPriceImpact;
        bool useFlashbotsRPC;
        uint256 priorityFee;
    }
    
    // State variables
    mapping(address => DEXInfo) public dexRouters;
    address[] public activeDEXs;
    IPriceFeed public priceFeed;
    
    // MEV Protection settings
    MEVProtection public mevSettings;
    
    // Slippage settings
    uint256 public defaultSlippage = 50; // 0.5%
    uint256 public maxSlippage = 500; // 5%
    uint256 public constant SLIPPAGE_DENOMINATOR = 10000;
    
    // Events
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address[] routers
    );
    
    event RouteOptimized(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedOut,
        uint256 gasEstimate
    );
    
    event MEVProtectionTriggered(
        address user,
        string protectionType,
        uint256 timestamp
    );
    
    event DEXAdded(address router, string name, uint256 priority);
    event DEXRemoved(address router);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    
    /**
     * @dev Constructor
     * @param _priceFeed Address of the price feed oracle
     */
    constructor(address _priceFeed) {
        require(_priceFeed != address(0), "Invalid price feed");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ROUTER_ROLE, msg.sender);
        
        priceFeed = IPriceFeed(_priceFeed);
        
        // Initialize MEV protection settings
        mevSettings = MEVProtection({
            maxSlippage: 100, // 1%
            minOutput: 0,
            maxPriceImpact: 300, // 3%
            useFlashbotsRPC: false,
            priorityFee: 2 gwei
        });
    }
    
    /**
     * @dev Find optimal swap route across multiple DEXs
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return route Optimal swap route
     */
    function findOptimalRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (SwapRoute memory route) {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid tokens");
        require(amountIn > 0, "Invalid amount");
        
        uint256 bestOutput = 0;
        address[] memory bestPath = new address[](2);
        address[] memory bestRouters = new address[](1);
        
        bestPath[0] = tokenIn;
        bestPath[1] = tokenOut;
        
        // Check each DEX for best price
        for (uint256 i = 0; i < activeDEXs.length; i++) {
            DEXInfo memory dex = dexRouters[activeDEXs[i]];
            if (!dex.isActive) continue;
            
            // Get quote from DEX (simplified - would call actual DEX quote function)
            uint256 outputAmount = _getQuoteFromDEX(
                dex.router,
                tokenIn,
                tokenOut,
                amountIn
            );
            
            if (outputAmount > bestOutput) {
                bestOutput = outputAmount;
                bestRouters[0] = dex.router;
            }
        }
        
        // Build route
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = bestOutput;
        
        route = SwapRoute({
            path: bestPath,
            amounts: amounts,
            routers: bestRouters,
            deadline: block.timestamp + 300 // 5 minutes
        });
        
        emit RouteOptimized(tokenIn, tokenOut, amountIn, bestOutput, 0);
        
        return route;
    }
    
    /**
     * @dev Execute swap with MEV protection
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @param minAmountOut Minimum output amount
     * @param route Swap route to execute
     */
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        SwapRoute memory route
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(route.deadline >= block.timestamp, "Route expired");
        
        // MEV Protection: Check for sandwich attack
        if (_detectSandwichAttack()) {
            emit MEVProtectionTriggered(msg.sender, "Sandwich Attack Detected", block.timestamp);
            revert("MEV: Potential sandwich attack");
        }
        
        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Calculate expected output with slippage
        uint256 expectedOut = route.amounts[route.amounts.length - 1];
        uint256 minOut = (expectedOut * (SLIPPAGE_DENOMINATOR - mevSettings.maxSlippage)) / 
                         SLIPPAGE_DENOMINATOR;
        
        require(minAmountOut >= minOut, "Slippage too high");
        
        // Execute swap on selected DEX
        amountOut = _executeOnDEX(
            route.routers[0],
            tokenIn,
            tokenOut,
            amountIn,
            minOut
        );
        
        // Verify output amount
        require(amountOut >= minAmountOut, "Insufficient output");
        
        // Transfer output tokens to user
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            route.routers
        );
        
        return amountOut;
    }
    
    /**
     * @dev Split swap across multiple DEXs for better price
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Total input amount
     * @param splits Number of splits (max 5)
     */
    function executeSplitSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 splits
    ) external nonReentrant whenNotPaused returns (uint256 totalOut) {
        require(splits > 0 && splits <= 5, "Invalid splits");
        
        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        uint256 amountPerSplit = amountIn / splits;
        totalOut = 0;
        
        // Execute swaps across different DEXs
        for (uint256 i = 0; i < splits && i < activeDEXs.length; i++) {
            DEXInfo memory dex = dexRouters[activeDEXs[i]];
            if (!dex.isActive) continue;
            
            uint256 splitAmount = (i == splits - 1) ? 
                                  amountIn - (amountPerSplit * i) : 
                                  amountPerSplit;
            
            uint256 outputAmount = _executeOnDEX(
                dex.router,
                tokenIn,
                tokenOut,
                splitAmount,
                0 // No minimum for individual splits
            );
            
            totalOut += outputAmount;
        }
        
        require(totalOut >= minAmountOut, "Insufficient total output");
        
        // Transfer output tokens to user
        IERC20(tokenOut).safeTransfer(msg.sender, totalOut);
        
        return totalOut;
    }
    
    /**
     * @dev Detect potential sandwich attack
     */
    function _detectSandwichAttack() private view returns (bool) {
        // Simplified detection logic
        // In production, would check mempool, gas prices, recent transactions
        
        // Check if gas price is suspiciously high
        if (tx.gasprice > mevSettings.priorityFee * 10) {
            return true;
        }
        
        // Additional checks would go here
        return false;
    }
    
    /**
     * @dev Get quote from specific DEX
     */
    function _getQuoteFromDEX(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) private view returns (uint256) {
        // Simplified - would call actual DEX router
        // This is a placeholder that uses price feed
        uint256 priceIn = priceFeed.getPrice(tokenIn);
        uint256 priceOut = priceFeed.getPrice(tokenOut);
        
        if (priceIn == 0 || priceOut == 0) return 0;
        
        // Calculate output amount based on prices
        return (amountIn * priceIn) / priceOut;
    }
    
    /**
     * @dev Execute swap on specific DEX
     */
    function _executeOnDEX(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) private returns (uint256) {
        // Simplified - would call actual DEX router
        // This is a placeholder implementation
        
        // Approve router to spend tokens
        IERC20(tokenIn).safeApprove(router, amountIn);
        
        // Get simulated output (in production, would call router.swap())
        uint256 outputAmount = _getQuoteFromDEX(router, tokenIn, tokenOut, amountIn);
        
        require(outputAmount >= minAmountOut, "DEX: Insufficient output");
        
        return outputAmount;
    }
    
    /**
     * @dev Add a new DEX router
     */
    function addDEX(
        address router,
        string memory name,
        uint256 priority
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(router != address(0), "Invalid router");
        require(!dexRouters[router].isActive, "DEX already added");
        
        dexRouters[router] = DEXInfo({
            router: router,
            name: name,
            isActive: true,
            priority: priority
        });
        
        activeDEXs.push(router);
        
        emit DEXAdded(router, name, priority);
    }
    
    /**
     * @dev Remove a DEX router
     */
    function removeDEX(address router) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(dexRouters[router].isActive, "DEX not active");
        
        dexRouters[router].isActive = false;
        
        // Remove from active list
        for (uint256 i = 0; i < activeDEXs.length; i++) {
            if (activeDEXs[i] == router) {
                activeDEXs[i] = activeDEXs[activeDEXs.length - 1];
                activeDEXs.pop();
                break;
            }
        }
        
        emit DEXRemoved(router);
    }
    
    /**
     * @dev Update MEV protection settings
     */
    function updateMEVProtection(
        uint256 maxSlippage,
        uint256 maxPriceImpact,
        bool useFlashbotsRPC,
        uint256 priorityFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxSlippage <= 1000, "Slippage too high"); // Max 10%
        require(maxPriceImpact <= 1000, "Price impact too high"); // Max 10%
        
        mevSettings.maxSlippage = maxSlippage;
        mevSettings.maxPriceImpact = maxPriceImpact;
        mevSettings.useFlashbotsRPC = useFlashbotsRPC;
        mevSettings.priorityFee = priorityFee;
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
     * @dev Rescue stuck tokens
     */
    function rescueTokens(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
