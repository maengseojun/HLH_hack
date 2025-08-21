// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IIndexToken.sol";
import "./interfaces/IIndexTokenFactory.sol";

/**
 * @title IndexToken
 * @dev ERC20 token representing shares in an index fund
 * @notice Each token represents a proportional share of the underlying assets
 */
contract IndexToken is ERC20, Ownable, IIndexToken {
    bytes32 public override fundId;
    address public override factory;
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory can call");
        _;
    }
    
    /**
     * @dev Constructor
     * @param name Token name (e.g., "K-Crypto Top 4 Index")
     * @param symbol Token symbol (e.g., "KTOP4")
     * @param _fundId The fund ID this token represents
     * @param _factory Address of the factory contract
     */
    constructor(
        string memory name,
        string memory symbol,
        bytes32 _fundId,
        address _factory
    ) ERC20(name, symbol) {
        require(_factory != address(0), "Factory address cannot be zero");
        require(_fundId != bytes32(0), "Fund ID cannot be zero");
        
        fundId = _fundId;
        factory = _factory;
        
        // Factory becomes the owner
        _transferOwnership(_factory);
    }
    
    /**
     * @dev Mint tokens - only factory can call
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external override onlyFactory {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens - only factory can call
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external override onlyFactory {
        _burn(from, amount);
    }
    
    /**
     * @dev Get current NAV per token in USDC
     * @return NAV per token (scaled by 1e18)
     */
    function getNavPerToken() external view override returns (uint256) {
        return IIndexTokenFactory(factory).calculateNAV(fundId);
    }
    
    /**
     * @dev Get detailed fund information
     */
    function getFundDetails() external view returns (
        string memory name,
        string memory symbol,
        address creator,
        uint256 totalSupply,
        uint256 nav,
        bool isActive,
        bool isIssued
    ) {
        return IIndexTokenFactory(factory).getFundInfo(fundId);
    }
    
    /**
     * @dev Get fund components (underlying assets)
     */
    function getComponents() external view returns (IIndexTokenFactory.ComponentToken[] memory) {
        return IIndexTokenFactory(factory).getFundComponents(fundId);
    }
    
    /**
     * @dev Returns the total value of the fund in USDC
     */
    function getTotalFundValue() external view returns (uint256) {
        uint256 navPerToken = this.getNavPerToken();
        return navPerToken * totalSupply() / 1e18;
    }
    
    /**
     * @dev Override transfer to add hooks if needed
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        
        // Add any custom logic here if needed
        // e.g., transfer restrictions, fee collection, etc.
    }
}
