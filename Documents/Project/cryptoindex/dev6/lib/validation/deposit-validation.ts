// lib/validation/deposit-validation.ts
import { ethers } from 'ethers';

export interface DepositValidationError {
  field: string;
  message: string;
  code: string;
}

export interface DepositValidationResult {
  isValid: boolean;
  errors: DepositValidationError[];
  warnings?: string[];
}

export interface DepositValidationConfig {
  minAmount: number;
  maxAmount: number;
  allowedTokens: string[];
  allowedNetworks: string[];
  requiresApproval: boolean;
}

export class DepositValidator {
  private static readonly DEFAULT_CONFIG: DepositValidationConfig = {
    minAmount: 5.0, // 5 USDC minimum as per Hyperliquid requirements
    maxAmount: 100000.0, // 100k USDC maximum
    allowedTokens: ['USDC'],
    allowedNetworks: ['arbitrum'],
    requiresApproval: true
  };

  private config: DepositValidationConfig;

  constructor(config?: Partial<DepositValidationConfig>) {
    this.config = {
      ...DepositValidator.DEFAULT_CONFIG,
      ...config
    };
  }

  /**
   * Validate deposit amount
   */
  validateAmount(amount: string | number): DepositValidationResult {
    const errors: DepositValidationError[] = [];
    const warnings: string[] = [];

    // Convert to number
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Check if amount is a valid number
    if (isNaN(amountNum) || !isFinite(amountNum)) {
      errors.push({
        field: 'amount',
        message: 'Amount must be a valid number',
        code: 'INVALID_NUMBER'
      });
      return { isValid: false, errors, warnings };
    }

    // Check if amount is positive
    if (amountNum <= 0) {
      errors.push({
        field: 'amount',
        message: 'Amount must be greater than 0',
        code: 'AMOUNT_NOT_POSITIVE'
      });
    }

    // Check minimum amount (5 USDC as per Hyperliquid)
    if (amountNum < this.config.minAmount) {
      errors.push({
        field: 'amount',
        message: `Minimum deposit amount is ${this.config.minAmount} USDC. Deposits below this amount will be permanently lost.`,
        code: 'AMOUNT_TOO_LOW'
      });
    }

    // Check maximum amount
    if (amountNum > this.config.maxAmount) {
      errors.push({
        field: 'amount',
        message: `Maximum deposit amount is ${this.config.maxAmount} USDC`,
        code: 'AMOUNT_TOO_HIGH'
      });
    }

    // Add warning for large amounts
    if (amountNum > 10000) {
      warnings.push(
        'Large deposit detected. Please ensure you have sufficient funds and are aware of the risks.'
      );
    }

    // Add warning for amounts close to minimum
    if (amountNum >= this.config.minAmount && amountNum < this.config.minAmount + 1) {
      warnings.push(
        'Amount is close to minimum requirement. Consider depositing slightly more to account for potential fees.'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate wallet address
   */
  validateWalletAddress(address: string): DepositValidationResult {
    const errors: DepositValidationError[] = [];

    // Check if address is provided
    if (!address || address.trim().length === 0) {
      errors.push({
        field: 'walletAddress',
        message: 'Wallet address is required',
        code: 'ADDRESS_REQUIRED'
      });
      return { isValid: false, errors };
    }

    // Check if address is valid Ethereum address
    if (!ethers.isAddress(address)) {
      errors.push({
        field: 'walletAddress',
        message: 'Invalid wallet address format',
        code: 'INVALID_ADDRESS'
      });
    }

    // Check if address is not zero address
    if (address.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      errors.push({
        field: 'walletAddress',
        message: 'Cannot use zero address',
        code: 'ZERO_ADDRESS'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate token symbol
   */
  validateToken(tokenSymbol: string): DepositValidationResult {
    const errors: DepositValidationError[] = [];

    // Check if token is provided
    if (!tokenSymbol || tokenSymbol.trim().length === 0) {
      errors.push({
        field: 'tokenSymbol',
        message: 'Token symbol is required',
        code: 'TOKEN_REQUIRED'
      });
      return { isValid: false, errors };
    }

    // Check if token is allowed
    if (!this.config.allowedTokens.includes(tokenSymbol.toUpperCase())) {
      errors.push({
        field: 'tokenSymbol',
        message: `Token ${tokenSymbol} is not supported. Supported tokens: ${this.config.allowedTokens.join(', ')}`,
        code: 'TOKEN_NOT_SUPPORTED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate network
   */
  validateNetwork(network: string): DepositValidationResult {
    const errors: DepositValidationError[] = [];

    // Check if network is provided
    if (!network || network.trim().length === 0) {
      errors.push({
        field: 'network',
        message: 'Network is required',
        code: 'NETWORK_REQUIRED'
      });
      return { isValid: false, errors };
    }

    // Check if network is allowed
    if (!this.config.allowedNetworks.includes(network.toLowerCase())) {
      errors.push({
        field: 'network',
        message: `Network ${network} is not supported. Supported networks: ${this.config.allowedNetworks.join(', ')}`,
        code: 'NETWORK_NOT_SUPPORTED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user balance
   */
  validateBalance(
    depositAmount: string | number,
    userBalance: string | number
  ): DepositValidationResult {
    const errors: DepositValidationError[] = [];
    const warnings: string[] = [];

    const amountNum = typeof depositAmount === 'string' ? parseFloat(depositAmount) : depositAmount;
    const balanceNum = typeof userBalance === 'string' ? parseFloat(userBalance) : userBalance;

    // Check if balance is sufficient
    if (amountNum > balanceNum) {
      errors.push({
        field: 'balance',
        message: `Insufficient balance. You have ${balanceNum} USDC, but trying to deposit ${amountNum} USDC`,
        code: 'INSUFFICIENT_BALANCE'
      });
    }

    // Warning if depositing most of balance
    if (amountNum > balanceNum * 0.9) {
      warnings.push(
        'You are depositing most of your balance. Consider keeping some tokens for gas fees.'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate transaction hash
   */
  validateTransactionHash(txHash: string): DepositValidationResult {
    const errors: DepositValidationError[] = [];

    // Check if txHash is provided
    if (!txHash || txHash.trim().length === 0) {
      errors.push({
        field: 'txHash',
        message: 'Transaction hash is required',
        code: 'TX_HASH_REQUIRED'
      });
      return { isValid: false, errors };
    }

    // Check if txHash is valid hex string
    if (!ethers.isHexString(txHash, 32)) {
      errors.push({
        field: 'txHash',
        message: 'Invalid transaction hash format',
        code: 'INVALID_TX_HASH'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate complete deposit request
   */
  validateDepositRequest(request: {
    walletAddress: string;
    amount: string | number;
    tokenSymbol?: string;
    network?: string;
    userBalance?: string | number;
    txHash?: string;
  }): DepositValidationResult {
    const allErrors: DepositValidationError[] = [];
    const allWarnings: string[] = [];

    // Validate wallet address
    const addressValidation = this.validateWalletAddress(request.walletAddress);
    allErrors.push(...addressValidation.errors);

    // Validate amount
    const amountValidation = this.validateAmount(request.amount);
    allErrors.push(...amountValidation.errors);
    if (amountValidation.warnings) {
      allWarnings.push(...amountValidation.warnings);
    }

    // Validate token (default to USDC)
    const tokenValidation = this.validateToken(request.tokenSymbol || 'USDC');
    allErrors.push(...tokenValidation.errors);

    // Validate network (default to arbitrum)
    const networkValidation = this.validateNetwork(request.network || 'arbitrum');
    allErrors.push(...networkValidation.errors);

    // Validate balance if provided
    if (request.userBalance !== undefined) {
      const balanceValidation = this.validateBalance(request.amount, request.userBalance);
      allErrors.push(...balanceValidation.errors);
      if (balanceValidation.warnings) {
        allWarnings.push(...balanceValidation.warnings);
      }
    }

    // Validate transaction hash if provided
    if (request.txHash) {
      const txValidation = this.validateTransactionHash(request.txHash);
      allErrors.push(...txValidation.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
  }

  /**
   * Get validation config
   */
  getConfig(): DepositValidationConfig {
    return { ...this.config };
  }

  /**
   * Update validation config
   */
  updateConfig(newConfig: Partial<DepositValidationConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
}

// Export default instance
export const depositValidator = new DepositValidator();

// Export utility functions
export const validateDepositAmount = (amount: string | number) => 
  depositValidator.validateAmount(amount);

export const validateWalletAddress = (address: string) => 
  depositValidator.validateWalletAddress(address);

export const validateDepositRequest = (request: {
  walletAddress: string;
  amount: string | number;
  tokenSymbol?: string;
  network?: string;
  userBalance?: string | number;
  txHash?: string;
}) => depositValidator.validateDepositRequest(request);

// Constants
export const MINIMUM_DEPOSIT_AMOUNT = 5.0; // 5 USDC as per Hyperliquid requirements
export const MAXIMUM_DEPOSIT_AMOUNT = 100000.0; // 100k USDC maximum
export const SUPPORTED_TOKENS = ['USDC'];
export const SUPPORTED_NETWORKS = ['arbitrum'];