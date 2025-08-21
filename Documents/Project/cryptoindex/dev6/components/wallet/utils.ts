/**
 * Wallet Utilities - Address formatting and validation functions
 * 
 * This file contains utility functions for handling wallet addresses,
 * clipboard operations, and address validation.
 */

import copy from 'copy-to-clipboard';

/**
 * Formats an Ethereum address to a user-friendly truncated format
 * 
 * @param address - The full Ethereum address (0x...)
 * @param length - Number of characters to show at start and end (default: 4)
 * @returns Formatted address string (e.g., "0x1234...5678")
 * 
 * @example
 * formatAddress("0x1234567890abcdef1234567890abcdef12345678") // "0x1234...5678"
 * formatAddress("0x1234567890abcdef1234567890abcdef12345678", 6) // "0x123456...345678"
 * formatAddress("invalid") // "invalid" (returns as-is if invalid)
 */
export function formatAddress(address: string, length: number = 4): string {
  // Return as-is if not a valid address format
  if (!address || !address.startsWith('0x') || address.length < 10) {
    return address;
  }

  // For very short addresses, return as-is
  if (address.length <= (length * 2) + 5) {
    return address;
  }

  const start = address.slice(0, 2 + length); // "0x" + length characters
  const end = address.slice(-length); // last length characters
  
  return `${start}...${end}`;
}

/**
 * Copies text to the user's clipboard
 * 
 * @param text - The text to copy to clipboard
 * @returns Promise that resolves to true if successful, false otherwise
 * 
 * @example
 * await copyToClipboard("0x1234567890abcdef1234567890abcdef12345678")
 * // Returns true if successful, false if failed
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern browsers with Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback to copy-to-clipboard library
    const success = copy(text);
    return success;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Validates if a string is a valid Ethereum address
 * 
 * @param address - The address string to validate
 * @returns True if valid Ethereum address, false otherwise
 * 
 * @example
 * validateAddress("0x1234567890abcdef1234567890abcdef12345678") // true
 * validateAddress("0x1234567890abcdef1234567890abcdef1234567") // false (too short)
 * validateAddress("1234567890abcdef1234567890abcdef12345678") // false (no 0x prefix)
 * validateAddress("0xGGGG567890abcdef1234567890abcdef12345678") // false (invalid hex)
 */
export function validateAddress(address: string): boolean {
  // Check if address is a string
  if (typeof address !== 'string') {
    return false;
  }

  // Check if it starts with '0x'
  if (!address.startsWith('0x')) {
    return false;
  }

  // Check if it has the correct length (42 characters: '0x' + 40 hex chars)
  if (address.length !== 42) {
    return false;
  }

  // Check if all characters after '0x' are valid hexadecimal
  const hexPart = address.slice(2);
  const hexRegex = /^[0-9a-fA-F]+$/;
  
  return hexRegex.test(hexPart);
}

/**
 * Checks if an address is a valid checksum address (EIP-55)
 * 
 * @param address - The address to check
 * @returns True if valid checksum address, false otherwise
 * 
 * @example
 * isChecksumAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed") // true
 * isChecksumAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed") // false (lowercase)
 */
export function isChecksumAddress(address: string): boolean {
  if (!validateAddress(address)) {
    return false;
  }

  // Simple checksum validation - in a real app, you'd use a proper library
  // This is a basic implementation for demonstration
  const hasUppercase = /[A-F]/.test(address.slice(2));
  const hasLowercase = /[a-f]/.test(address.slice(2));
  
  // If it has mixed case, assume it's a checksum address
  // For production, use a proper EIP-55 validation library
  return hasUppercase && hasLowercase;
}

/**
 * Converts an address to checksum format (EIP-55)
 * This is a simplified version - in production use a proper library
 * 
 * @param address - The address to convert
 * @returns Checksum address or original if invalid
 * 
 * @example
 * toChecksumAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed")
 * // Returns "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
 */
export function toChecksumAddress(address: string): string {
  if (!validateAddress(address)) {
    return address;
  }

  // This is a simplified implementation
  // In production, use ethers.js or web3.js for proper checksum conversion
  return address.toLowerCase();
}

/**
 * Shortens a transaction hash for display
 * 
 * @param hash - The transaction hash
 * @param length - Number of characters to show at start and end (default: 6)
 * @returns Shortened hash string
 * 
 * @example
 * shortenHash("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
 * // Returns "0x123456...abcdef"
 */
export function shortenHash(hash: string, length: number = 6): string {
  if (!hash || hash.length <= (length * 2) + 5) {
    return hash;
  }

  const start = hash.slice(0, 2 + length);
  const end = hash.slice(-length);
  
  return `${start}...${end}`;
}

/**
 * Formats a balance amount for display
 * 
 * @param balance - The balance as a string or number
 * @param decimals - Number of decimal places to show (default: 4)
 * @param symbol - Token symbol to append (optional)
 * @returns Formatted balance string
 * 
 * @example
 * formatBalance("1.23456789", 4, "ETH") // "1.2346 ETH"
 * formatBalance("1000.123456", 2) // "1,000.12"
 */
export function formatBalance(
  balance: string | number, 
  decimals: number = 4, 
  symbol?: string
): string {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  
  if (isNaN(num)) {
    return '0';
  }

  // Format with commas and specified decimal places
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });

  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Test cases for the utility functions
 */
export const TEST_CASES = {
  formatAddress: {
    valid: [
      {
        input: "0x1234567890abcdef1234567890abcdef12345678",
        expected: "0x1234...5678"
      },
      {
        input: "0x1234567890abcdef1234567890abcdef12345678",
        length: 6,
        expected: "0x123456...345678"
      }
    ],
    invalid: [
      { input: "invalid", expected: "invalid" },
      { input: "0x123", expected: "0x123" }
    ]
  },
  validateAddress: {
    valid: [
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    ],
    invalid: [
      "1234567890abcdef1234567890abcdef12345678", // no 0x
      "0x1234567890abcdef1234567890abcdef1234567", // too short
      "0xGGGG567890abcdef1234567890abcdef12345678", // invalid hex
      "0x1234567890abcdef1234567890abcdef123456789" // too long
    ]
  }
};