// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IHyperIndexFactory.sol";
import "./interfaces/IHyperIndexPair.sol";
import "./libraries/HyperIndexLibrary.sol";

/**
 * @title HyperIndexRouter
 * @notice Router contract for HyperIndex AMM with user-friendly functions
 * @dev Handles multi-hop swaps, liquidity management, and slippage protection
 */
contract HyperIndexRouter {
    address public immutable factory;
    address public immutable WHYPE; // Wrapped HYPE for ETH-like functionality
    
    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "HyperIndexRouter: EXPIRED");
        _;
    }
    
    constructor(address _factory, address _WHYPE) {
        factory = _factory;
        WHYPE = _WHYPE;
    }
    
    receive() external payable {
        assert(msg.sender == WHYPE); // only accept HYPE via fallback from the WHYPE contract
    }
    
    // **** ADD LIQUIDITY ****
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = HyperIndexLibrary.pairFor(factory, tokenA, tokenB);
        
        IERC20(tokenA).transferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).transferFrom(msg.sender, pair, amountB);
        liquidity = IHyperIndexPair(pair).mint(to);
    }
    
    function addLiquidityHYPE(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountHYPEMin,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256 amountToken, uint256 amountHYPE, uint256 liquidity) {
        (amountToken, amountHYPE) = _addLiquidity(
            token,
            WHYPE,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountHYPEMin
        );
        address pair = HyperIndexLibrary.pairFor(factory, token, WHYPE);
        
        IERC20(token).transferFrom(msg.sender, pair, amountToken);
        IWHYPE(WHYPE).deposit{value: amountHYPE}();
        assert(IWHYPE(WHYPE).transfer(pair, amountHYPE));
        liquidity = IHyperIndexPair(pair).mint(to);
        
        // Refund excess HYPE
        if (msg.value > amountHYPE) {
            payable(msg.sender).transfer(msg.value - amountHYPE);
        }
    }
    
    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = HyperIndexLibrary.pairFor(factory, tokenA, tokenB);
        IERC20(pair).transferFrom(msg.sender, pair, liquidity);
        (uint256 amount0, uint256 amount1) = IHyperIndexPair(pair).burn(to);
        (address token0,) = HyperIndexLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "HyperIndexRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "HyperIndexRouter: INSUFFICIENT_B_AMOUNT");
    }
    
    function removeLiquidityHYPE(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountHYPEMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountToken, uint256 amountHYPE) {
        (amountToken, amountHYPE) = removeLiquidity(
            token,
            WHYPE,
            liquidity,
            amountTokenMin,
            amountHYPEMin,
            address(this),
            deadline
        );
        IERC20(token).transfer(to, amountToken);
        IWHYPE(WHYPE).withdraw(amountHYPE);
        payable(to).transfer(amountHYPE);
    }
    
    // **** SWAP ****
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = HyperIndexLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "HyperIndexRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        
        IERC20(path[0]).transferFrom(msg.sender, HyperIndexLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }
    
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = HyperIndexLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "HyperIndexRouter: EXCESSIVE_INPUT_AMOUNT");
        
        IERC20(path[0]).transferFrom(msg.sender, HyperIndexLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }
    
    function swapExactHYPEForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WHYPE, "HyperIndexRouter: INVALID_PATH");
        amounts = HyperIndexLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "HyperIndexRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        
        IWHYPE(WHYPE).deposit{value: amounts[0]}();
        assert(IWHYPE(WHYPE).transfer(HyperIndexLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }
    
    function swapTokensForExactHYPE(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WHYPE, "HyperIndexRouter: INVALID_PATH");
        amounts = HyperIndexLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "HyperIndexRouter: EXCESSIVE_INPUT_AMOUNT");
        
        IERC20(path[0]).transferFrom(msg.sender, HyperIndexLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, address(this));
        IWHYPE(WHYPE).withdraw(amounts[amounts.length - 1]);
        payable(to).transfer(amounts[amounts.length - 1]);
    }
    
    function swapExactTokensForHYPE(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WHYPE, "HyperIndexRouter: INVALID_PATH");
        amounts = HyperIndexLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "HyperIndexRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        
        IERC20(path[0]).transferFrom(msg.sender, HyperIndexLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, address(this));
        IWHYPE(WHYPE).withdraw(amounts[amounts.length - 1]);
        payable(to).transfer(amounts[amounts.length - 1]);
    }
    
    function swapHYPEForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WHYPE, "HyperIndexRouter: INVALID_PATH");
        amounts = HyperIndexLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, "HyperIndexRouter: EXCESSIVE_INPUT_AMOUNT");
        
        IWHYPE(WHYPE).deposit{value: amounts[0]}();
        assert(IWHYPE(WHYPE).transfer(HyperIndexLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
        
        // Refund excess HYPE
        if (msg.value > amounts[0]) {
            payable(msg.sender).transfer(msg.value - amounts[0]);
        }
    }
    
    // **** LIBRARY FUNCTIONS ****
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) 
        public pure returns (uint256 amountB) 
    {
        return HyperIndexLibrary.quote(amountA, reserveA, reserveB);
    }
    
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public pure returns (uint256 amountOut)
    {
        return HyperIndexLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }
    
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        public pure returns (uint256 amountIn)
    {
        return HyperIndexLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }
    
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public view returns (uint256[] memory amounts)
    {
        return HyperIndexLibrary.getAmountsOut(factory, amountIn, path);
    }
    
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        public view returns (uint256[] memory amounts)
    {
        return HyperIndexLibrary.getAmountsIn(factory, amountOut, path);
    }
    
    // **** INTERNAL FUNCTIONS ****
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        // Create the pair if it doesn't exist yet
        if (IHyperIndexFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            IHyperIndexFactory(factory).createPair(tokenA, tokenB);
        }
        
        (uint256 reserveA, uint256 reserveB) = HyperIndexLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = HyperIndexLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "HyperIndexRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = HyperIndexLibrary.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "HyperIndexRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }
    
    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = HyperIndexLibrary.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? HyperIndexLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IHyperIndexPair(HyperIndexLibrary.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }
}

// Interfaces
interface IWHYPE {
    function deposit() external payable;
    function transfer(address to, uint256 value) external returns (bool);
    function withdraw(uint256) external;
}