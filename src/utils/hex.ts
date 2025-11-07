/**
 * Hexadecimal utility functions
 *
 * Used to process and normalize hexadecimal strings to ensure compliance with EIP-712 and Solidity format requirements
 */

/**
 * Pad a short hex string to a fixed length (left-padded with zeros)
 *
 * In EIP-712 and Solidity, the uint256 type requires 32 bytes (64 hexadecimal characters)
 * Examples:
 * - Input: "0x3e8"     -> Output: "0x00000000000000000000000000000000000000000000000000000000000003e8"
 * - Input: "0x1234"    -> Output: "0x0000000000000000000000000000000000000000000000000000000000001234"
 *
 * @param hexString - Hexadecimal string (with or without "0x" prefix)
 * @param targetLength - Target length (number of characters, excluding "0x" prefix), defaults to 64 (corresponding to 32 bytes for uint256)
 * @returns Normalized hexadecimal string (with "0x" prefix)
 *
 * @throws Throws an error if the input hex string exceeds the target length
 *
 * @example
 * ```typescript
 * padHex("0x3e8")    // "0x00000000000000000000000000000000000000000000000000000000000003e8"
 * padHex("3e8")      // "0x00000000000000000000000000000000000000000000000000000000000003e8"
 * padHex("0x1234", 8) // "0x00001234" (target length 8 characters)
 * ```
 */
export function padHex(hexString: string, targetLength: number = 64): string {
  // Remove "0x" prefix (if present)
  let hex = hexString.toLowerCase();
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }

  // Validate if it's a valid hexadecimal string
  if (!/^[0-9a-f]*$/.test(hex)) {
    throw new Error(`Invalid hex string: ${hexString}`);
  }

  // Check length
  if (hex.length > targetLength) {
    throw new Error(
      `Hex string too long: ${hexString} (${hex.length} chars, max ${targetLength})`
    );
  }

  // Left-pad with zeros
  const padded = hex.padStart(targetLength, '0');

  // Add "0x" prefix
  return `0x${padded}`;
}

/**
 * Normalize a hex string for uint256 type
 *
 * Ensures that the hex string conforms to the uint256 format requirements (32 bytes = 64 hexadecimal characters)
 * This is a convenient wrapper for padHex, specifically designed for uint256 type
 *
 * @param hexString - Hexadecimal string
 * @returns Normalized hex string (64 characters + "0x" prefix)
 *
 * @example
 * ```typescript
 * normalizeUint256("0x3e8")     // "0x00000000000000000000000000000000000000000000000000000000000003e8"
 * normalizeUint256("0x1234567") // "0x0000000000000000000000000000000000000000000000000000000001234567"
 * ```
 */
export function normalizeUint256(hexString: string): string {
  return padHex(hexString, 64);
}

/**
 * Batch normalize hex string fields in an object
 *
 * Perform hex normalization on specified fields in the object
 *
 * @param obj - Object containing hex strings
 * @param fields - Array of field names to normalize
 * @returns New normalized object (does not modify the original object)
 *
 * @example
 * ```typescript
 * const params = {
 *   value: "0x3e8",
 *   nonce: "0x1234",
 *   name: "USDC"  // Non-hex fields will not be processed
 * };
 *
 * const normalized = normalizeHexFields(params, ['value', 'nonce']);
 * // {
 * //   value: "0x00000000000000000000000000000000000000000000000000000000000003e8",
 * //   nonce: "0x0000000000000000000000000000000000000000000000000000000000001234",
 * //   name: "USDC"
 * // }
 * ```
 */
export function normalizeHexFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };

  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string') {
      result[field] = normalizeUint256(value) as T[keyof T];
    }
  }

  return result;
}

/**
 * Validate hex string format
 *
 * Check if the string is in valid hexadecimal format
 *
 * @param hexString - String to validate
 * @returns Returns true if it's a valid hex format, otherwise returns false
 *
 * @example
 * ```typescript
 * isValidHex("0x3e8")     // true
 * isValidHex("3e8")       // true
 * isValidHex("0xGGG")     // false
 * isValidHex("hello")     // false
 * ```
 */
export function isValidHex(hexString: string): boolean {
  let hex = hexString.toLowerCase();
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }
  return /^[0-9a-f]+$/.test(hex);
}

/**
 * Create a normalized hex string from a number or bigint
 *
 * @param value - Number or bigint
 * @param targetLength - Target length (defaults to 64, corresponding to uint256)
 * @returns Normalized hex string
 *
 * @example
 * ```typescript
 * numberToHex(1000)        // "0x00000000000000000000000000000000000000000000000000000000000003e8"
 * numberToHex(1000n)       // "0x00000000000000000000000000000000000000000000000000000000000003e8"
 * numberToHex(255, 4)      // "0x00ff"
 * ```
 */
export function numberToHex(value: number | bigint, targetLength: number = 64): string {
  const hex = value.toString(16);
  return padHex(hex, targetLength);
}

/**
 * Generate a random nonce (conforming to uint256 format)
 *
 * Generates a random 32-byte nonce for EIP-712 signatures
 *
 * @returns Normalized nonce string
 *
 * @example
 * ```typescript
 * generateNonce() // "0x000000000000000000000000000000000000000000000000018d4a8f1e3c2b1a"
 * ```
 */
export function generateNonce(): string {
  // Use timestamp + random number to ensure uniqueness
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 0xffffff); // 24-bit random number
  const nonce = (BigInt(timestamp) << 24n) | BigInt(random);
  return numberToHex(nonce);
}
