/**
 * Input Validation Utility Module
 *
 * Provides various parameter validation functions to ensure data legitimacy and security
 */

import { isValidHex } from './hex.js';

/**
 * Validate Ethereum address format
 *
 * Ethereum addresses must follow these rules:
 * - Start with "0x"
 * - Followed by 40 hexadecimal characters (case-insensitive)
 * - Total length of 42 characters
 *
 * @param address - Address string to validate
 * @returns Returns true if address format is valid, otherwise false
 *
 * @example
 * ```typescript
 * isValidEthereumAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")  // true
 * isValidEthereumAddress("0x742")                                      // false
 * isValidEthereumAddress("742d35Cc6634C0532925a3b844Bc9e7595f0bEb")   // false (missing 0x)
 * ```
 */
export function isValidEthereumAddress(address: string): boolean {
  // Check if it matches Ethereum address format: 0x + 40 hexadecimal characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate and ensure address format is correct, throws error if invalid
 *
 * @param address - Address string to validate
 * @param fieldName - Field name for error message (default: "address")
 * @throws Throws detailed error message if address format is invalid
 *
 * @example
 * ```typescript
 * validateEthereumAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")  // Pass validation
 * validateEthereumAddress("0x123", "recipient address")  // Throws error: "Invalid recipient address: 0x123"
 * ```
 */
export function validateEthereumAddress(address: string, fieldName: string = 'address'): void {
  if (!isValidEthereumAddress(address)) {
    throw new Error(
      `Invalid ${fieldName}: ${address}\n` +
      `Ethereum address must follow this format:\n` +
      `- Start with "0x"\n` +
      `- Followed by 40 hexadecimal characters\n` +
      `- Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
    );
  }
}

/**
 * Validate hexadecimal value (for amount, nonce, etc.)
 *
 * @param hexValue - Hexadecimal string
 * @param fieldName - Field name for error message
 * @param allowNegative - Whether to allow negative numbers (default: false)
 * @throws Throws error if value is invalid
 *
 * @example
 * ```typescript
 * validateHexValue("0x3e8", "amount")           // Pass validation
 * validateHexValue("0xGGG", "amount")           // Throws error: Invalid hexadecimal format
 * validateHexValue("-0x1", "amount")            // Throws error: amount cannot be negative
 * validateHexValue("-0x1", "offset", true)      // Pass validation (allows negative)
 * ```
 */
export function validateHexValue(
  hexValue: string,
  fieldName: string = 'value',
  allowNegative: boolean = false
): void {
  // Check if it's negative
  const isNegative = hexValue.startsWith('-');
  const valueToCheck = isNegative ? hexValue.slice(1) : hexValue;

  // Validate hexadecimal format
  if (!isValidHex(valueToCheck)) {
    throw new Error(
      `Invalid ${fieldName} format: ${hexValue}\n` +
      `Must be a valid hexadecimal string (e.g., "0x3e8" or "3e8")`
    );
  }

  // Check negative restriction
  if (isNegative && !allowNegative) {
    throw new Error(`${fieldName} cannot be negative: ${hexValue}`);
  }

  // Validate value range (try converting to BigInt)
  try {
    const value = BigInt(hexValue);

    // If negative not allowed, check converted value again
    if (!allowNegative && value < 0n) {
      throw new Error(`${fieldName} cannot be negative: ${hexValue} (value: ${value})`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('cannot be negative')) {
      throw error; // Re-throw our own error
    }
    throw new Error(
      `${fieldName} out of valid range: ${hexValue}\n` +
      `Details: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate timestamps (validAfter and validBefore)
 *
 * @param validAfter - Effective time (hexadecimal string)
 * @param validBefore - Expiration time (hexadecimal string)
 * @throws Throws error if time range is invalid
 *
 * @example
 * ```typescript
 * validateTimestamps("0x0", "0x67890abc")     // Pass validation
 * validateTimestamps("0x67890abc", "0x0")     // Throws error: validBefore must be greater than validAfter
 * ```
 */
export function validateTimestamps(validAfter: string, validBefore: string): void {
  // Validate format first
  validateHexValue(validAfter, 'validAfter');
  validateHexValue(validBefore, 'validBefore');

  // Convert to BigInt for comparison
  const afterValue = BigInt(validAfter);
  const beforeValue = BigInt(validBefore);

  // Validate time range logic
  if (beforeValue <= afterValue) {
    throw new Error(
      `Invalid time range: validBefore (${validBefore}) must be greater than validAfter (${validAfter})\n` +
      `Current: validAfter=${afterValue}, validBefore=${beforeValue}`
    );
  }

  // Optional: Validate validAfter is not too far in the future (skip if 0)
  if (afterValue > 0n) {
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    const maxFutureTimestamp = currentTimestamp + 86400n; // Max 24 hours ahead

    if (afterValue > maxFutureTimestamp) {
      console.warn(
        `⚠️  Warning: validAfter (${afterValue}) is set in the distant future (current: ${currentTimestamp})\n` +
        `   This may cause the signature to be unusable in the short term`
      );
    }
  }

  // Optional: Validate validity window is not too short
  const timeWindow = beforeValue - afterValue;
  const minTimeWindow = 300n; // Minimum 5 minutes

  if (timeWindow < minTimeWindow) {
    console.warn(
      `⚠️  Warning: Validity window is short (${timeWindow} seconds)\n` +
      `   Recommended to set at least ${minTimeWindow} seconds to avoid signature expiring before use`
    );
  }
}

/**
 * Validate nonce value
 *
 * @param nonce - Nonce value (hexadecimal string)
 * @throws Throws error if nonce is invalid
 *
 * @example
 * ```typescript
 * validateNonce("0x1234567890abcdef")  // Pass validation
 * validateNonce("0xGGG")               // Throws error
 * ```
 */
export function validateNonce(nonce: string): void {
  validateHexValue(nonce, 'nonce');

  // Validate nonce cannot be 0 (optional, based on business requirements)
  const nonceValue = BigInt(nonce);
  if (nonceValue === 0n) {
    console.warn(
      `⚠️  Warning: nonce value is 0\n` +
      `   Please ensure this is intentional. Recommend using randomly generated nonce for better security`
    );
  }
}

/**
 * Validate vault ID
 *
 * @param vaultId - Wallet ID
 * @throws Throws error if vault ID is invalid
 *
 * @example
 * ```typescript
 * validateVaultId(1n)   // Pass validation
 * validateVaultId(0n)   // Throws error: Vault ID must be greater than 0
 * validateVaultId(-1n)  // Throws error: Vault ID must be greater than 0
 * ```
 */
export function validateVaultId(vaultId: bigint): void {
  if (vaultId <= 0n) {
    throw new Error(
      `Invalid Vault ID: ${vaultId}\n` +
      `Vault ID must be a positive integer greater than 0`
    );
  }
}

/**
 * Validate contract address (verifyingContract)
 *
 * @param contractAddress - Contract address
 * @param fieldName - Field name (default: "contract address")
 * @throws Throws error if contract address is invalid
 *
 * @example
 * ```typescript
 * validateContractAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e")  // Pass validation
 * validateContractAddress("0x0000000000000000000000000000000000000000")  // Warning: zero address
 * ```
 */
export function validateContractAddress(
  contractAddress: string,
  fieldName: string = 'contract address'
): void {
  // Use Ethereum address validation
  validateEthereumAddress(contractAddress, fieldName);

  // Check if it's the zero address (0x0000...0000)
  if (contractAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    console.warn(
      `⚠️  Warning: ${fieldName} is zero address (0x0000000000000000000000000000000000000000)\n` +
      `   This may indicate a native token (like ETH). Please confirm this is intentional`
    );
  }
}

/**
 * Validate domain chain ID
 *
 * @param domainChainId - Chain ID (hexadecimal string)
 * @throws Throws error if chain ID is invalid
 *
 * @example
 * ```typescript
 * validateDomainChainId("0x14a34")  // Pass validation (Base Sepolia)
 * validateDomainChainId("0x2105")   // Pass validation (Base)
 * ```
 */
export function validateDomainChainId(domainChainId: string): void {
  // Special case: Solana uses string "solana" instead of hexadecimal
  if (domainChainId === 'solana') {
    return; // Solana chain ID is valid
  }

  // Validate hexadecimal format
  validateHexValue(domainChainId, 'domainChainId');

  // Validate chain ID cannot be 0
  const chainIdValue = BigInt(domainChainId);
  if (chainIdValue === 0n) {
    throw new Error(
      `Invalid domainChainId: ${domainChainId}\n` +
      `Chain ID cannot be 0`
    );
  }
}

/**
 * Validate domain name and version
 *
 * @param domainName - Domain name (e.g., "USDC")
 * @param domainVersion - Domain version (e.g., "2")
 * @throws Throws error if parameters are invalid
 *
 * @example
 * ```typescript
 * validateDomainParams("USDC", "2")  // Pass validation
 * validateDomainParams("", "2")      // Throws error: domainName cannot be empty
 * ```
 */
export function validateDomainParams(domainName: string, domainVersion: string): void {
  // Validate domainName cannot be empty
  if (!domainName || domainName.trim() === '') {
    throw new Error(`domainName cannot be empty`);
  }

  // Validate domainVersion cannot be empty
  if (!domainVersion || domainVersion.trim() === '') {
    throw new Error(`domainVersion cannot be empty`);
  }

  // Optional: Validate version format (usually numeric)
  if (!/^\d+$/.test(domainVersion)) {
    console.warn(
      `⚠️  Warning: domainVersion "${domainVersion}" is not purely numeric\n` +
      `   Common version formats are "1", "2", etc. Please confirm this is the intended format`
    );
  }
}

/**
 * Batch validate all fields of SignRequestParams
 *
 * This is a convenience function to validate all signature request parameters at once
 *
 * @param params - Signature request parameters object
 * @throws Throws detailed error if any parameter is invalid
 *
 * @example
 * ```typescript
 * import { SignRequestParams } from '../client.js';
 *
 * const params: SignRequestParams = {
 *   vaultId: 1n,
 *   to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   value: '0x3e8',
 *   validAfter: '0x0',
 *   validBefore: '0x67890abc',
 *   nonce: '0x1234567890abcdef',
 *   verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
 *   domainChainId: '0x14a34',
 *   domainName: 'USDC',
 *   domainVersion: '2'
 * };
 *
 * validateSignRequestParams(params);  // Validate all fields at once
 * ```
 */
export interface SignRequestParamsForValidation {
  vaultId: bigint;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  verifyingContract: string;
  domainChainId: string;
  domainName: string;
  domainVersion: string;
}

export function validateSignRequestParams(params: SignRequestParamsForValidation): void {
  // Validate Vault ID
  validateVaultId(params.vaultId);

  // Validate recipient address
  validateEthereumAddress(params.to, 'recipient address (to)');

  // Validate amount
  validateHexValue(params.value, 'transfer amount (value)');

  // Validate timestamps
  validateTimestamps(params.validAfter, params.validBefore);

  // Validate nonce
  validateNonce(params.nonce);

  // Validate contract address
  validateContractAddress(params.verifyingContract, 'verifying contract address (verifyingContract)');

  // Validate chain ID
  validateDomainChainId(params.domainChainId);

  // Validate domain parameters
  validateDomainParams(params.domainName, params.domainVersion);
}