// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IAMM.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockAMM
 * @dev Mock implementation of IAMM for testing AMM integration
 */
contract MockAMM is IAMM {
    using SafeERC20 for IERC20;
    
    // Storage
    mapping(bytes32 => PoolInfo) private pools;
    mapping(address => mapping(address => bytes32)) private poolKeys;
    mapping(uint256 => LiquidityPosition) private positions;
    
    uint256 private nextPositionId = 1;
    uint256 public constant FEE_BASIS_POINTS = 30; // 0.3% fee
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    
    constructor() {
        // Initialize some mock pools for testing
        _initializeMockPools();
    }
    
    function _initializeMockPools() internal {
        // BTC-USDC pool
        address btc = address(0x1); // Mock BTC address
        address usdc = address(0x2); // Mock USDC address
        bytes32 poolKey = keccak256(abi.encodePacked(btc, usdc));
        
        pools[poolKey] = PoolInfo({
            tokenA: btc,
            tokenB: usdc,
            reserveA: 1000e18,      // 1000 BTC
            reserveB: 45000000e6,   // 45M USDC
            liquidity: 6708203932,  // sqrt(1000 * 45000000)
            fee: FEE_BASIS_POINTS,
            isActive: true,
            lastUpdate: block.timestamp
        });
        poolKeys[btc][usdc] = poolKey;
        poolKeys[usdc][btc] = poolKey;
        
        // ETH-USDC pool
        address eth = address(0x3); // Mock ETH address
        poolKey = keccak256(abi.encodePacked(eth, usdc));
        
        pools[poolKey] = PoolInfo({
            tokenA: eth,
            tokenB: usdc,
            reserveA: 5000e18,      // 5000 ETH
            reserveB: 12500000e6,   // 12.5M USDC
            liquidity: 7905694150,  // sqrt(5000 * 12500000)
            fee: FEE_BASIS_POINTS,
            isActive: true,
            lastUpdate: block.timestamp
        });
        poolKeys[eth][usdc] = poolKey;
        poolKeys[usdc][eth] = poolKey;
    }
    
    function getQuote(
        address tokenIn,
        address tokenOut, 
        uint256 amountIn,
        uint256 slippageTolerance
    ) external view override returns (QuoteInfo memory quote) {
        bytes32 poolKey = poolKeys[tokenIn][tokenOut];
        require(poolKey != bytes32(0), "Pool does not exist");
        
        PoolInfo memory pool = pools[poolKey];
        require(pool.isActive, "Pool is not active");
        
        // Calculate output using x*y=k formula
        uint256 amountInWithFee = amountIn * (10000 - pool.fee) / 10000;
        uint256 amountOut;
        
        if (tokenIn == pool.tokenA) {
            amountOut = (amountInWithFee * pool.reserveB) / (pool.reserveA + amountInWithFee);
        } else {
            amountOut = (amountInWithFee * pool.reserveA) / (pool.reserveB + amountInWithFee);
        }
        
        // Calculate price impact
        uint256 priceImpact = _calculatePriceImpact(tokenIn, tokenOut, amountIn);
        
        // Apply slippage
        uint256 minAmountOut = amountOut * (10000 - slippageTolerance) / 10000;
        
        // Create path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        quote = QuoteInfo({
            amountOut: amountOut,
            priceImpact: priceImpact,
            minAmountOut: minAmountOut,
            fee: amountIn * pool.fee / 10000,
            path: path,
            deadline: block.timestamp + 1800 // 30 minutes
        });
    }
    
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external override returns (uint256 amountOut) {
        require(deadline >= block.timestamp, "Transaction expired");
        
        QuoteInfo memory quote = this.getQuote(tokenIn, tokenOut, amountIn, 0);
        amountOut = quote.amountOut;
        
        require(amountOut >= minAmountOut, "Insufficient output amount");
        
        // Update pool reserves (simplified - in real implementation would transfer tokens)
        _updatePoolReserves(tokenIn, tokenOut, amountIn, amountOut);
        
        emit Swap(tokenIn, tokenOut, amountIn, amountOut, recipient);
    }
    
    function swapExactTokensForTokens(
        address[] memory path,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Transaction expired");
        require(path.length >= 2, "Invalid path");
        
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        // Execute swaps along the path
        for (uint i = 0; i < path.length - 1; i++) {
            QuoteInfo memory quote = this.getQuote(path[i], path[i + 1], amounts[i], 0);
            amounts[i + 1] = quote.amountOut;
            _updatePoolReserves(path[i], path[i + 1], amounts[i], amounts[i + 1]);
        }
        
        require(amounts[amounts.length - 1] >= minAmountOut, "Insufficient output amount");
        
        emit Swap(path[0], path[path.length - 1], amountIn, amounts[amounts.length - 1], recipient);
    }
    
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address recipient,
        uint256 deadline
    ) external override returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(deadline >= block.timestamp, "Transaction expired");
        
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        if (poolKey == bytes32(0)) {
            // Create new pool
            poolKey = keccak256(abi.encodePacked(tokenA, tokenB));
            pools[poolKey] = PoolInfo({
                tokenA: tokenA,
                tokenB: tokenB,
                reserveA: 0,
                reserveB: 0,
                liquidity: 0,
                fee: FEE_BASIS_POINTS,
                isActive: true,
                lastUpdate: block.timestamp
            });
            poolKeys[tokenA][tokenB] = poolKey;
            poolKeys[tokenB][tokenA] = poolKey;
        }
        
        PoolInfo storage pool = pools[poolKey];
        
        if (pool.reserveA == 0 && pool.reserveB == 0) {
            // First liquidity
            amountA = amountADesired;
            amountB = amountBDesired;
            liquidity = _sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
        } else {
            // Calculate optimal amounts
            uint256 amountBOptimal = (amountADesired * pool.reserveB) / pool.reserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "Insufficient B amount");
                amountA = amountADesired;
                amountB = amountBOptimal;
            } else {
                uint256 amountAOptimal = (amountBDesired * pool.reserveA) / pool.reserveB;
                require(amountAOptimal <= amountADesired && amountAOptimal >= amountAMin, "Insufficient A amount");
                amountA = amountAOptimal;
                amountB = amountBDesired;
            }
            
            liquidity = _min((amountA * pool.liquidity) / pool.reserveA, (amountB * pool.liquidity) / pool.reserveB);
        }
        
        // Update pool state
        pool.reserveA += amountA;
        pool.reserveB += amountB;
        pool.liquidity += liquidity;
        pool.lastUpdate = block.timestamp;
        
        // Create liquidity position
        positions[nextPositionId] = LiquidityPosition({
            positionId: nextPositionId,
            owner: recipient,
            tokenA: tokenA,
            tokenB: tokenB,
            amountA: amountA,
            amountB: amountB,
            liquidity: liquidity,
            feesEarnedA: 0,
            feesEarnedB: 0,
            createdAt: block.timestamp
        });
        nextPositionId++;
        
        emit LiquidityAdded(tokenA, tokenB, amountA, amountB, liquidity, recipient);
    }
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address recipient,
        uint256 deadline
    ) external override returns (uint256 amountA, uint256 amountB) {
        require(deadline >= block.timestamp, "Transaction expired");
        
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "Pool does not exist");
        
        PoolInfo storage pool = pools[poolKey];
        
        amountA = (liquidity * pool.reserveA) / pool.liquidity;
        amountB = (liquidity * pool.reserveB) / pool.liquidity;
        
        require(amountA >= amountAMin && amountB >= amountBMin, "Insufficient liquidity burned");
        
        pool.reserveA -= amountA;
        pool.reserveB -= amountB;
        pool.liquidity -= liquidity;
        pool.lastUpdate = block.timestamp;
        
        emit LiquidityRemoved(tokenA, tokenB, amountA, amountB, liquidity, recipient);
    }
    
    function getPoolInfo(address tokenA, address tokenB) 
        external view override returns (PoolInfo memory poolInfo) 
    {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "Pool does not exist");
        return pools[poolKey];
    }
    
    function getPrice(address tokenA, address tokenB) 
        external view override returns (uint256 price) 
    {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "Pool does not exist");
        
        PoolInfo memory pool = pools[poolKey];
        if (tokenA == pool.tokenA) {
            price = (pool.reserveB * 1e18) / pool.reserveA;
        } else {
            price = (pool.reserveA * 1e18) / pool.reserveB;
        }
    }
    
    function getLiquidity(address tokenA, address tokenB) 
        external view override returns (uint256 liquidityA, uint256 liquidityB) 
    {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        if (poolKey != bytes32(0)) {
            PoolInfo memory pool = pools[poolKey];
            if (tokenA == pool.tokenA) {
                liquidityA = pool.reserveA;
                liquidityB = pool.reserveB;
            } else {
                liquidityA = pool.reserveB;
                liquidityB = pool.reserveA;
            }
        }
    }
    
    function calculatePriceImpact(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 priceImpact) {
        return _calculatePriceImpact(tokenIn, tokenOut, amountIn);
    }
    
    function getOptimalPath(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (address[] memory path, uint256 expectedOut) {
        // Simple implementation: direct path if pool exists, otherwise through USDC
        bytes32 directPoolKey = poolKeys[tokenIn][tokenOut];
        
        if (directPoolKey != bytes32(0)) {
            // Direct path
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            
            QuoteInfo memory quote = this.getQuote(tokenIn, tokenOut, amountIn, 0);
            expectedOut = quote.amountOut;
        } else {
            // Path through USDC (assuming USDC is address(0x2))
            address usdc = address(0x2);
            path = new address[](3);
            path[0] = tokenIn;
            path[1] = usdc;
            path[2] = tokenOut;
            
            // Calculate through intermediate
            QuoteInfo memory quote1 = this.getQuote(tokenIn, usdc, amountIn, 0);
            QuoteInfo memory quote2 = this.getQuote(usdc, tokenOut, quote1.amountOut, 0);
            expectedOut = quote2.amountOut;
        }
    }
    
    function poolExists(address tokenA, address tokenB) 
        external view override returns (bool exists, bool isActive) 
    {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        exists = poolKey != bytes32(0);
        if (exists) {
            isActive = pools[poolKey].isActive;
        }
    }
    
    // Internal helper functions
    
    function _calculatePriceImpact(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256 priceImpact) {
        bytes32 poolKey = poolKeys[tokenIn][tokenOut];
        if (poolKey == bytes32(0)) return 0;
        
        PoolInfo memory pool = pools[poolKey];
        uint256 reserveIn = tokenIn == pool.tokenA ? pool.reserveA : pool.reserveB;
        
        // Price impact = (amountIn / reserveIn) * scaleFactor
        priceImpact = (amountIn * 10000) / reserveIn; // In basis points
        
        // Cap at 50% (5000 basis points)
        if (priceImpact > 5000) priceImpact = 5000;
    }
    
    function _updatePoolReserves(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) internal {
        bytes32 poolKey = poolKeys[tokenIn][tokenOut];
        PoolInfo storage pool = pools[poolKey];
        
        if (tokenIn == pool.tokenA) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= amountOut;
        }
        
        pool.lastUpdate = block.timestamp;
    }
    
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
    
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    // Admin functions for testing
    
    function setPoolReserves(
        address tokenA,
        address tokenB,
        uint256 reserveA,
        uint256 reserveB
    ) external {
        bytes32 poolKey = poolKeys[tokenA][tokenB];
        require(poolKey != bytes32(0), "Pool does not exist");
        
        PoolInfo storage pool = pools[poolKey];
        pool.reserveA = reserveA;
        pool.reserveB = reserveB;
        pool.liquidity = _sqrt(reserveA * reserveB);
        pool.lastUpdate = block.timestamp;
    }
    
    function createPool(address tokenA, address tokenB, uint256 fee) external {
        bytes32 poolKey = keccak256(abi.encodePacked(tokenA, tokenB));
        require(poolKeys[tokenA][tokenB] == bytes32(0), "Pool already exists");
        
        pools[poolKey] = PoolInfo({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: 0,
            reserveB: 0,
            liquidity: 0,
            fee: fee,
            isActive: true,
            lastUpdate: block.timestamp
        });
        
        poolKeys[tokenA][tokenB] = poolKey;
        poolKeys[tokenB][tokenA] = poolKey;
        
        emit PoolCreated(tokenA, tokenB, address(this), fee);
    }
}