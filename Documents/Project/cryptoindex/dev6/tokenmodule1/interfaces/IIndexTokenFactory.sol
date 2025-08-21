// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IIndexTokenFactory
 * @dev Interface for Index Token Factory contract
 */
interface IIndexTokenFactory {
    struct ComponentToken {
        address tokenAddress;        // 토큰 컨트랙트 주소
        uint32 hyperliquidAssetIndex;// Hyperliquid 자산 인덱스
        uint256 targetRatio;         // 목표 비율 (10000 = 100%)
        uint256 depositedAmount;     // 실제 예치된 수량
    }
    
    /**
     * @dev Calculate NAV for a fund
     */
    function calculateNAV(bytes32 fundId) external view returns (uint256);
    
    /**
     * @dev Get fund information
     */
    function getFundInfo(bytes32 fundId) external view returns (
        string memory name,
        string memory symbol,
        address creator,
        address indexToken,
        uint256 totalSupply,
        uint256 nav,
        bool isActive,
        bool isIssued
    );
    
    /**
     * @dev Get fund components
     */
    function getFundComponents(bytes32 fundId) external view returns (ComponentToken[] memory);
    
    /**
     * @dev Events
     */
    event FundCreated(bytes32 indexed fundId, string name, address creator);
    event TokensDeposited(bytes32 indexed fundId, address token, uint256 amount);
    event IndexTokenIssued(bytes32 indexed fundId, address tokenAddress, uint256 totalSupply);
    event ManagementFeeCollected(bytes32 indexed fundId, uint256 amount);
}
