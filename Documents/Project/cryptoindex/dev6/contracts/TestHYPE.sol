// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestHYPE
 * @dev Test version of HyperEVM native token for testing purposes
 * @notice This is a mintable ERC20 token to simulate HYPE on testnets
 */
contract TestHYPE is ERC20, Ownable {
    
    uint8 private _decimals;
    
    constructor() ERC20("HyperEVM Test Token", "HYPE") Ownable(msg.sender) {
        _decimals = 18;
        
        // Initial mint to deployer (1M HYPE for testing)
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }
    
    /**
     * @dev Override decimals to match HyperEVM native token
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to specified address (only owner)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "TestHYPE: mint to zero address");
        require(amount > 0, "TestHYPE: mint amount must be positive");
        _mint(to, amount);
    }
    
    /**
     * @dev Batch mint to multiple addresses
     * @param recipients Array of addresses to mint to
     * @param amounts Array of amounts to mint
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "TestHYPE: arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "TestHYPE: mint to zero address");
            require(amounts[i] > 0, "TestHYPE: mint amount must be positive");
            _mint(recipients[i], amounts[i]);
        }
    }
    
    /**
     * @dev Faucet function - anyone can get test tokens (max once per day)
     */
    mapping(address => uint256) public lastFaucetTime;
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**18; // 1000 HYPE
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    
    function faucet() external {
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN,
            "TestHYPE: faucet cooldown not met"
        );
        
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        
        emit FaucetUsed(msg.sender, FAUCET_AMOUNT);
    }
    
    /**
     * @dev Emergency faucet for testing (no cooldown, only owner)
     */
    function emergencyFaucet(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit EmergencyMint(to, amount);
    }
    
    /**
     * @dev Set decimals (only owner, for testing different configurations)
     */
    function setDecimals(uint8 newDecimals) external onlyOwner {
        _decimals = newDecimals;
    }
    
    /**
     * @dev Burn tokens from caller's account
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    /**
     * @dev Events
     */
    event FaucetUsed(address indexed user, uint256 amount);
    event EmergencyMint(address indexed to, uint256 amount);
}