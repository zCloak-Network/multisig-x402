/**
 * X402MultiSig SDK Main Entry File
 *
 * Minimalist design, exporting only core APIs:
 * - Smart client class: X402MultiSig
 * - Low-level client class: X402Client (advanced usage)
 * - Necessary type definitions
 * - Constants and version information
 */

// ==================== Smart Client ====================

export {
  X402MultiSig,
  type X402MultiSigOptions,
  type SignRequestParams,
  type SimpleSignRequestParams,
  type SignatureResult,
  type PaymentRequirements,
  type PaidServiceResponse,
  type CallPaidServiceParams,
} from './client.js';

// ==================== Advanced Usage ====================

export { X402Client } from './canisters/x402.js';
export { RegisterClient, type User as RegisterUser } from './canisters/register.js';
export { IdentityManager, type IdentityStorageData } from './identity/manager.js';

// ==================== Type Definitions ====================

export type {
  // X402 signature related
  X402SignParams,
  // EIP-712 Domain parameters
  EIP712DomainParams,
  // Networks and users
  SupportedNetwork,
  SupportedToken,
  TokenConfig,
  UserRecord,
  // Request status query
  RequestRecord,
  RequestStatus,
} from './types.js';

// ==================== Constants ====================

/**
 * List of supported blockchain networks
 * Multi-signature wallet is restricted to: BASE, BASE Testnet, Solana
 */
export { SUPPORTED_NETWORKS } from './types.js';

/**
 * Mapping between networks and Chain IDs
 */
export { NETWORK_CHAIN_IDS, CHAIN_ID_TO_NETWORK } from './types.js';

/**
 * Token configuration supported by each network
 */
export { SUPPORTED_TOKENS } from './types.js';

// ==================== Utility Functions ====================

/**
 * Validate if a token contract address is in the supported list for the specified network
 */
export { isSupportedToken, getTokenConfig } from './types.js';

/**
 * Get token configuration by token symbol
 */
export { getTokenConfigBySymbol } from './types.js';

/**
 * Automatically retrieve EIP-712 Domain parameters
 * Automatically populates EIP-712 domain parameters based on network and token symbol
 */
export { getEIP712DomainParams } from './types.js';

/**
 * Hex utility functions
 * Used to normalize hexadecimal strings to ensure compliance with EIP-712 and Solidity format requirements
 *
 * Note: The SDK automatically handles hex formatting internally, so manual calls to these functions are typically not needed.
 * These utility functions are mainly used in the following scenarios:
 * - Pre-formatting parameters before passing to the SDK
 * - Using standard uint256 hex format elsewhere
 * - Generating compliant nonce values
 */
export {
  padHex,
  normalizeUint256,
  normalizeHexFields,
  isValidHex,
  numberToHex,
  generateNonce,
} from './utils/hex.js';

// ==================== Version Information ====================

/**
 * SDK version number
 */
export const VERSION = '1.0.0';
