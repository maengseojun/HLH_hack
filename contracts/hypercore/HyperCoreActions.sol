// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICoreWriter {
    function sendRawAction(bytes calldata data) external;
}

contract HyperCoreActions {
    ICoreWriter constant CORE_WRITER = ICoreWriter(0x3333333333333333333333333333333333333333);
    
    // Action encoding version
    uint8 constant ENCODING_VERSION = 1;
    
    // Action IDs
    uint8 constant ACTION_LIMIT_ORDER = 1;
    uint8 constant ACTION_VAULT_TRANSFER = 2;
    uint8 constant ACTION_TOKEN_DELEGATE = 3;
    uint8 constant ACTION_STAKING_DEPOSIT = 4;
    uint8 constant ACTION_STAKING_WITHDRAW = 5;
    uint8 constant ACTION_SPOT_SEND = 6;
    uint8 constant ACTION_USD_CLASS_TRANSFER = 7;
    uint8 constant ACTION_FINALIZE_EVM_CONTRACT = 8;
    uint8 constant ACTION_ADD_API_WALLET = 9;
    uint8 constant ACTION_CANCEL_ORDER_BY_OID = 10;
    uint8 constant ACTION_CANCEL_ORDER_BY_CLOID = 11;
    
    // TIF encodings
    uint8 constant TIF_ALO = 1;
    uint8 constant TIF_GTC = 2;
    uint8 constant TIF_IOC = 3;
    
    /**
     * Place a limit order
     */
    function placeLimitOrder(
        uint32 asset,
        bool isBuy,
        uint64 limitPx,  // 10^8 * human readable value
        uint64 sz,       // 10^8 * human readable value
        bool reduceOnly,
        uint8 tif,       // 1=ALO, 2=GTC, 3=IOC
        uint128 cloid    // 0 = no cloid
    ) external {
        bytes memory encodedAction = abi.encode(asset, isBuy, limitPx, sz, reduceOnly, tif, cloid);
        bytes memory data = _buildActionData(ACTION_LIMIT_ORDER, encodedAction);
        CORE_WRITER.sendRawAction(data);
    }
    
    /**
     * Transfer USD between perp and spot
     */
    function usdClassTransfer(uint64 ntl, bool toPerp) external {
        bytes memory encodedAction = abi.encode(ntl, toPerp);
        bytes memory data = _buildActionData(ACTION_USD_CLASS_TRANSFER, encodedAction);
        CORE_WRITER.sendRawAction(data);
    }
    
    /**
     * Vault deposit/withdraw
     */
    function vaultTransfer(address vault, bool isDeposit, uint64 usd) external {
        bytes memory encodedAction = abi.encode(vault, isDeposit, usd);
        bytes memory data = _buildActionData(ACTION_VAULT_TRANSFER, encodedAction);
        CORE_WRITER.sendRawAction(data);
    }
    
    /**
     * Cancel order by order ID
     */
    function cancelOrderByOid(uint32 asset, uint64 oid) external {
        bytes memory encodedAction = abi.encode(asset, oid);
        bytes memory data = _buildActionData(ACTION_CANCEL_ORDER_BY_OID, encodedAction);
        CORE_WRITER.sendRawAction(data);
    }
    
    /**
     * Cancel order by client order ID
     */
    function cancelOrderByCloid(uint32 asset, uint128 cloid) external {
        bytes memory encodedAction = abi.encode(asset, cloid);
        bytes memory data = _buildActionData(ACTION_CANCEL_ORDER_BY_CLOID, encodedAction);
        CORE_WRITER.sendRawAction(data);
    }
    
    /**
     * Staking operations
     */
    function stakingDeposit(uint64 wei) external {
        bytes memory encodedAction = abi.encode(wei);
        bytes memory data = _buildActionData(ACTION_STAKING_DEPOSIT, encodedAction);
        CORE_WRITER.sendRawAction(data);
    }
    
    function stakingWithdraw(uint64 wei) external {
        bytes memory encodedAction = abi.encode(wei);
        bytes memory data = _buildActionData(ACTION_STAKING_WITHDRAW, encodedAction);
        CORE_WRITER.sendRawAction(data);
    }
    
    /**
     * Build action data with proper encoding
     */
    function _buildActionData(uint8 actionId, bytes memory encodedAction) internal pure returns (bytes memory) {
        bytes memory data = new bytes(4 + encodedAction.length);
        data[0] = ENCODING_VERSION;
        data[1] = 0x00;
        data[2] = 0x00;
        data[3] = actionId;
        
        for (uint256 i = 0; i < encodedAction.length; i++) {
            data[4 + i] = encodedAction[i];
        }
        
        return data;
    }
}
