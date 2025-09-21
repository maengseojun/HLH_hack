// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * HyperLiquid L1 Read Precompiles
 * Addresses starting from 0x0000000000000000000000000000000000000800
 */
contract HyperL1Reader {
    
    // Precompile addresses
    address constant POSITIONS_PRECOMPILE = 0x0000000000000000000000000000000000000800;
    address constant SPOT_BALANCE_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address constant VAULT_EQUITY_PRECOMPILE = 0x0000000000000000000000000000000000000802;
    address constant STAKING_DELEGATIONS_PRECOMPILE = 0x0000000000000000000000000000000000000803;
    address constant ORACLE_PRICES_PRECOMPILE = 0x0000000000000000000000000000000000000804;
    address constant L1_BLOCK_NUMBER_PRECOMPILE = 0x0000000000000000000000000000000000000805;
    address constant PERP_ORACLE_PRICE_PRECOMPILE = 0x0000000000000000000000000000000000000807;
    address constant SPOT_PRICE_PRECOMPILE = 0x0000000000000000000000000000000000000808;
    
    struct Position {
        int64 szi;
        uint32 leverage;
        uint64 entryNtl;
    }
    
    /**
     * Read perp position for a user and asset
     */
    function readPerpPosition(address user, uint32 asset) external view returns (Position memory) {
        (bool success, bytes memory result) = POSITIONS_PRECOMPILE.staticcall(abi.encode(user, asset));
        require(success, "readPerpPosition call failed");
        
        return abi.decode(result, (Position));
    }
    
    /**
     * Read spot balance for a user and token
     */
    function readSpotBalance(address user, uint32 token) external view returns (uint64) {
        (bool success, bytes memory result) = SPOT_BALANCE_PRECOMPILE.staticcall(abi.encode(user, token));
        require(success, "readSpotBalance call failed");
        
        return abi.decode(result, (uint64));
    }
    
    /**
     * Read vault equity for a vault address
     */
    function readVaultEquity(address vault) external view returns (uint64) {
        (bool success, bytes memory result) = VAULT_EQUITY_PRECOMPILE.staticcall(abi.encode(vault));
        require(success, "readVaultEquity call failed");
        
        return abi.decode(result, (uint64));
    }
    
    /**
     * Read oracle price for a perp asset
     */
    function readPerpOraclePrice(uint32 asset) external view returns (uint64) {
        (bool success, bytes memory result) = PERP_ORACLE_PRICE_PRECOMPILE.staticcall(abi.encode(asset));
        require(success, "readPerpOraclePrice call failed");
        
        return abi.decode(result, (uint64));
    }
    
    /**
     * Read spot price for a token
     */
    function readSpotPrice(uint32 token) external view returns (uint64) {
        (bool success, bytes memory result) = SPOT_PRICE_PRECOMPILE.staticcall(abi.encode(token));
        require(success, "readSpotPrice call failed");
        
        return abi.decode(result, (uint64));
    }
    
    /**
     * Read L1 block number
     */
    function readL1BlockNumber() external view returns (uint64) {
        (bool success, bytes memory result) = L1_BLOCK_NUMBER_PRECOMPILE.staticcall(abi.encode());
        require(success, "readL1BlockNumber call failed");
        
        return abi.decode(result, (uint64));
    }
    
    /**
     * Helper function to convert price to floating point
     * For perps: divide by 10^(6 - szDecimals)
     * For spot: divide by 10^(8 - base asset szDecimals)
     */
    function convertPerpPrice(uint64 price, uint8 szDecimals) external pure returns (uint256) {
        if (szDecimals <= 6) {
            return uint256(price) / (10 ** (6 - szDecimals));
        } else {
            return uint256(price) * (10 ** (szDecimals - 6));
        }
    }
    
    function convertSpotPrice(uint64 price, uint8 baseAssetDecimals) external pure returns (uint256) {
        if (baseAssetDecimals <= 8) {
            return uint256(price) / (10 ** (8 - baseAssetDecimals));
        } else {
            return uint256(price) * (10 ** (baseAssetDecimals - 8));
        }
    }
}
