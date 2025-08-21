// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MinimalPair
 * @notice Ultra-minimal AMM pair for HyperEVM with 2M gas limit
 * @dev No inheritance, minimal storage, optimized for deployment
 */
contract MinimalPair {
    address public token0;
    address public token1;
    uint112 public reserve0;
    uint112 public reserve1;
    uint32 public blockTimestampLast;
    
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    
    address public factory;
    
    event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out);
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1);
    
    constructor() {
        factory = msg.sender;
    }
    
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, "FORBIDDEN");
        token0 = _token0;
        token1 = _token1;
    }
    
    function getReserves() external view returns (uint112 r0, uint112 r1, uint32 timestamp) {
        r0 = reserve0;
        r1 = reserve1;
        timestamp = blockTimestampLast;
    }
    
    // Minimal swap function
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external {
        require(amount0Out > 0 || amount1Out > 0, "INSUFFICIENT_OUTPUT");
        require(amount0Out < reserve0 && amount1Out < reserve1, "INSUFFICIENT_LIQUIDITY");
        
        if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
        if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);
        
        uint256 balance0 = _getBalance(token0);
        uint256 balance1 = _getBalance(token1);
        
        uint256 amount0In = balance0 > reserve0 - amount0Out ? balance0 - (reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > reserve1 - amount1Out ? balance1 - (reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "INSUFFICIENT_INPUT");
        
        // Check k invariant with 0.3% fee
        require(
            (balance0 * 1000 - amount0In * 3) * (balance1 * 1000 - amount1In * 3) >= 
            uint256(reserve0) * reserve1 * 1000000,
            "K"
        );
        
        _update(balance0, balance1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out);
    }
    
    function _update(uint256 balance0, uint256 balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
    }
    
    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
    
    function _getBalance(address token) private view returns (uint256) {
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSelector(0x70a08231, address(this)));
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }
}