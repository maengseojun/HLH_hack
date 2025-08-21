// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HyperIndexPair
 * @notice AMM pair contract optimized for HyperEVM
 * @dev Implements constant product formula (x * y = k) with HyperEVM optimizations
 */
contract HyperIndexPair is ERC20, ReentrancyGuard {
    using SafeMath for uint256;
    
    // Constants
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;
    
    // State variables
    address public factory;
    address public token0;
    address public token1;
    
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;
    
    // Price cumulative for TWAP oracle
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint256 public kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event
    
    // Events
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);
    
    constructor() ERC20("HyperIndex LP", "HI-LP") {
        factory = msg.sender;
    }
    
    /**
     * @notice Initialize the pair with token addresses
     * @dev Called once by the factory at time of deployment
     */
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, "HyperIndex: FORBIDDEN");
        token0 = _token0;
        token1 = _token1;
    }
    
    /**
     * @notice Get current reserves and last update timestamp
     */
    function getReserves() public view returns (
        uint112 _reserve0,
        uint112 _reserve1,
        uint32 _blockTimestampLast
    ) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }
    
    /**
     * @notice Update reserves and price accumulators
     * @dev Called on every liquidity change
     */
    function _update(
        uint256 balance0,
        uint256 balance1,
        uint112 _reserve0,
        uint112 _reserve1
    ) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "HyperIndex: OVERFLOW");
        
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        
        // Update price accumulators for TWAP oracle
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            price0CumulativeLast += uint256(_reserve1) / uint256(_reserve0) * timeElapsed;
            price1CumulativeLast += uint256(_reserve0) / uint256(_reserve1) * timeElapsed;
        }
        
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        
        emit Sync(reserve0, reserve1);
    }
    
    /**
     * @notice Add liquidity to the pool
     * @param to Address to mint LP tokens to
     * @return liquidity Amount of LP tokens minted
     */
    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0.sub(_reserve0);
        uint256 amount1 = balance1.sub(_reserve1);
        
        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply();
        
        if (_totalSupply == 0) {
            // First liquidity provision
            liquidity = sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            // Subsequent liquidity provisions
            liquidity = min(
                amount0.mul(_totalSupply) / _reserve0,
                amount1.mul(_totalSupply) / _reserve1
            );
        }
        
        require(liquidity > 0, "HyperIndex: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
        
        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint256(reserve0).mul(reserve1);
        
        emit Mint(msg.sender, amount0, amount1);
    }
    
    /**
     * @notice Remove liquidity from the pool
     * @param to Address to send tokens to
     * @return amount0 Amount of token0 withdrawn
     * @return amount1 Amount of token1 withdrawn
     */
    function burn(address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        address _token0 = token0;
        address _token1 = token1;
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));
        
        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply();
        
        // Calculate withdrawal amounts
        amount0 = liquidity.mul(balance0) / _totalSupply;
        amount1 = liquidity.mul(balance1) / _totalSupply;
        
        require(amount0 > 0 && amount1 > 0, "HyperIndex: INSUFFICIENT_LIQUIDITY_BURNED");
        
        _burn(address(this), liquidity);
        IERC20(_token0).transfer(to, amount0);
        IERC20(_token1).transfer(to, amount1);
        
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        
        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint256(reserve0).mul(reserve1);
        
        emit Burn(msg.sender, amount0, amount1, to);
    }
    
    /**
     * @notice Swap tokens using constant product formula
     * @param amount0Out Amount of token0 to receive
     * @param amount1Out Amount of token1 to receive
     * @param to Address to send tokens to
     * @param data Bytes data for flash loan callback
     */
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "HyperIndex: INSUFFICIENT_OUTPUT_AMOUNT");
        
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "HyperIndex: INSUFFICIENT_LIQUIDITY");
        
        uint256 balance0;
        uint256 balance1;
        
        {
            address _token0 = token0;
            address _token1 = token1;
            require(to != _token0 && to != _token1, "HyperIndex: INVALID_TO");
            
            // Optimistically transfer tokens
            if (amount0Out > 0) IERC20(_token0).transfer(to, amount0Out);
            if (amount1Out > 0) IERC20(_token1).transfer(to, amount1Out);
            
            // Flash loan callback
            if (data.length > 0) IHyperIndexCallee(to).hyperIndexCall(msg.sender, amount0Out, amount1Out, data);
            
            balance0 = IERC20(_token0).balanceOf(address(this));
            balance1 = IERC20(_token1).balanceOf(address(this));
        }
        
        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "HyperIndex: INSUFFICIENT_INPUT_AMOUNT");
        
        {
            // Verify constant product formula with 0.3% fee
            uint256 balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
            uint256 balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));
            require(
                balance0Adjusted.mul(balance1Adjusted) >= uint256(_reserve0).mul(_reserve1).mul(1000**2),
                "HyperIndex: K"
            );
        }
        
        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }
    
    /**
     * @notice Force balances to match reserves
     */
    function skim(address to) external nonReentrant {
        address _token0 = token0;
        address _token1 = token1;
        IERC20(_token0).transfer(to, IERC20(_token0).balanceOf(address(this)).sub(reserve0));
        IERC20(_token1).transfer(to, IERC20(_token1).balanceOf(address(this)).sub(reserve1));
    }
    
    /**
     * @notice Force reserves to match balances
     */
    function sync() external nonReentrant {
        _update(
            IERC20(token0).balanceOf(address(this)),
            IERC20(token1).balanceOf(address(this)),
            reserve0,
            reserve1
        );
    }
    
    // Private functions
    function _mintFee(uint112 _reserve0, uint112 _reserve1) private returns (bool feeOn) {
        address feeTo = IHyperIndexFactory(factory).feeTo();
        feeOn = feeTo != address(0);
        uint256 _kLast = kLast;
        if (feeOn) {
            if (_kLast != 0) {
                uint256 rootK = sqrt(uint256(_reserve0).mul(_reserve1));
                uint256 rootKLast = sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint256 numerator = totalSupply().mul(rootK.sub(rootKLast));
                    uint256 denominator = rootK.mul(5).add(rootKLast);
                    uint256 liquidity = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }
    }
    
    // Utility functions
    function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x < y ? x : y;
    }
    
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

// Interfaces
interface IHyperIndexFactory {
    function feeTo() external view returns (address);
}

interface IHyperIndexCallee {
    function hyperIndexCall(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external;
}

// SafeMath library for older Solidity versions
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }
    
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }
    
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }
    
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}