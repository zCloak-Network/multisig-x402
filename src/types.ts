/**
 * X402MultiSig SDK Type Definitions
 *
 * Centralized management of all types for clarity and simplicity
 */

import { Principal } from '@dfinity/principal';

// ==================== X402 Signature Related ====================

/**
 * X402 Signature Parameters
 * Used for calling X402 Canister to perform EIP-712 signing
 */
export interface X402SignParams {
  /** Wallet ID (vault_id) */
  vaultId: bigint;
  /** Recipient address */
  to: string;
  /** Transfer amount (hex string) */
  value: string;
  /** Valid after timestamp (hex string) */
  validAfter: string;
  /** Valid before timestamp (hex string) */
  validBefore: string;
  /** Nonce (hex string) */
  nonce: string;
  /** Verifying contract address (token contract address) */
  verifyingContract: string;
  /** EIP-712 domain chain ID (hex string, required) */
  domainChainId: string;
  /** EIP-712 domain name (required, e.g., "USDC") */
  domainName: string;
  /** EIP-712 domain version (required, e.g., "2") */
  domainVersion: string;
}

/**
 * Signature Result
 * Contains complete signature information
 */
export interface SignatureResult {
  /** Signature string (without 0x prefix) */
  signature: string;
  /** Signature string (with 0x prefix) */
  signatureWithPrefix: string;
  /** Original signature parameters */
  params: X402SignParams;
}

/**
 * Supported Network Types
 * Multi-signature wallet only supports the following networks:
 * - BASE Mainnet
 * - BASE Testnet (Sepolia)
 * - Solana Mainnet
 */
export type SupportedNetwork =
  | 'base'           // BASE Mainnet
  | 'base-sepolia'   // BASE Testnet
  | 'solana';        // Solana Mainnet

/**
 * List of supported blockchain networks
 */
export const SUPPORTED_NETWORKS: readonly SupportedNetwork[] = [
  'base',
  'base-sepolia',
  'solana',
] as const;

/**
 * Mapping between networks and Chain IDs
 * Used to verify if domainChainId matches supported networks
 */
export const NETWORK_CHAIN_IDS: Record<SupportedNetwork, string> = {
  'base': '0x2105',           // 8453
  'base-sepolia': '0x14a34',  // 84532
  'solana': 'solana',         // Solana does not use EVM chain ID
};

/**
 * Reverse mapping from Chain ID to network name
 * Used to find network from domainChainId
 */
export const CHAIN_ID_TO_NETWORK: Record<string, SupportedNetwork> = {
  '0x2105': 'base',
  '0x14a34': 'base-sepolia',
  'solana': 'solana',
};

/**
 * Supported token types
 */
export type SupportedToken = 'USDC' | 'USDT' | 'ETH' | 'SOL';

/**
 * Token configuration interface
 */
export interface TokenConfig {
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: SupportedToken;
  /** Contract address (Solana uses program address) */
  address: string;
  /** Number of decimals */
  decimals: number;
}

/**
 * Token configuration supported by each network
 * Multi-signature wallet is restricted to using only these configured tokens
 */
export const SUPPORTED_TOKENS: Record<SupportedNetwork, TokenConfig[]> = {
  'base': [
    {
      name: 'Ether',
      symbol: 'ETH',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
    },
  ],
  'base-sepolia': [
    {
      name: 'Ether',
      symbol: 'ETH',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      decimals: 6,
    },
  ],
  'solana': [
    {
      name: 'USD Coin',
      symbol: 'USDC',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
    },
    {
      name: 'SOL',
      symbol: 'SOL',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 9,
    },
  ],
};

/**
 * Validate if a token contract address is in the supported list for the specified network
 *
 * @param network - Network name
 * @param contractAddress - Token contract address
 * @returns Returns true if supported, otherwise false
 */
export function isSupportedToken(network: SupportedNetwork, contractAddress: string): boolean {
  const tokens = SUPPORTED_TOKENS[network];
  if (!tokens) {
    return false;
  }

  // Case-insensitive address comparison (EVM address)
  const normalizedAddress = contractAddress.toLowerCase();
  return tokens.some(token => token.address.toLowerCase() === normalizedAddress);
}

/**
 * Get token configuration by contract address
 *
 * @param network - Network name
 * @param contractAddress - Token contract address
 * @returns Token configuration, or undefined if not found
 */
export function getTokenConfig(network: SupportedNetwork, contractAddress: string): TokenConfig | undefined {
  const tokens = SUPPORTED_TOKENS[network];
  if (!tokens) {
    return undefined;
  }

  const normalizedAddress = contractAddress.toLowerCase();
  return tokens.find(token => token.address.toLowerCase() === normalizedAddress);
}

/**
 * Get token configuration by token symbol
 *
 * @param network - Network name
 * @param tokenSymbol - Token symbol (e.g., 'USDC', 'USDT', 'ETH')
 * @returns Token configuration, or undefined if not found
 */
export function getTokenConfigBySymbol(network: SupportedNetwork, tokenSymbol: SupportedToken): TokenConfig | undefined {
  const tokens = SUPPORTED_TOKENS[network];
  if (!tokens) {
    return undefined;
  }

  return tokens.find(token => token.symbol === tokenSymbol);
}

/**
 * EIP-712 Domain Parameters
 * Used for automatically configuring domain parameters in signature requests
 */
export interface EIP712DomainParams {
  /** Verifying contract address (token contract address) */
  verifyingContract: string;
  /** EIP-712 domain chain ID (hex string) */
  domainChainId: string;
  /** EIP-712 domain name (token name, e.g., "USDC") */
  domainName: string;
  /** EIP-712 domain version (e.g., "2") */
  domainVersion: string;
}

/**
 * Automatically retrieve EIP-712 Domain parameters
 *
 * Automatically populates EIP-712 domain parameters based on network and token symbol, simplifying the developer workflow
 *
 * @param network - Network name (e.g., 'base', 'base-sepolia', 'ethereum')
 * @param tokenSymbol - Token symbol (e.g., 'USDC', 'USDT', 'ETH')
 * @param domainVersion - EIP-712 version (e.g., "2")
 * @returns EIP-712 Domain parameters
 * @throws Throws an error if the network or token is not supported
 *
 * @example
 * ```typescript
 * // Automatically get domain parameters for Base Sepolia USDC
 * const domain = getEIP712DomainParams('base-sepolia', 'USDC', '2');
 * // Returns:
 * // {
 * //   verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
 * //   domainChainId: '0x14a34',
 * //   domainName: 'USDC',
 * //   domainVersion: '2'
 * // }
 * ```
 */
export function getEIP712DomainParams(
  network: SupportedNetwork,
  tokenSymbol: SupportedToken,
  domainVersion: string
): EIP712DomainParams {
  // Validate network support
  if (!SUPPORTED_NETWORKS.includes(network)) {
    throw new Error(
      `❌ Unsupported network: ${network}\n` +
      `   Supported networks: ${SUPPORTED_NETWORKS.join(', ')}`
    );
  }

  // Get network Chain ID
  const domainChainId = NETWORK_CHAIN_IDS[network];
  if (!domainChainId) {
    throw new Error(`❌ Unable to retrieve Chain ID for network ${network}`);
  }

  // Get token configuration
  const tokenConfig = getTokenConfigBySymbol(network, tokenSymbol);
  if (!tokenConfig) {
    const supportedTokens = SUPPORTED_TOKENS[network]?.map(t => t.symbol).join(', ') || 'none';
    throw new Error(
      `❌ Network ${network} does not support token ${tokenSymbol}\n` +
      `   Tokens supported by this network: ${supportedTokens}`
    );
  }

  // Return complete EIP-712 Domain parameters
  return {
    verifyingContract: tokenConfig.address,
    domainChainId,
    domainName: tokenConfig.symbol, // Use token symbol as domain name
    domainVersion,
  };
}

// ==================== Canister Related ====================

/**
 * User record structure (returned from canister)
 */
export interface UserRecord {
  /** User's Principal ID */
  user_principal: Principal;
  /** Username */
  user_name: string;
  /** Creation time (nanosecond timestamp) */
  create_time: bigint;
  /** Update time (nanosecond timestamp) */
  update_time: bigint;
  /** Display name (optional) */
  display_name: string[];
  /** Passkey name list (optional) */
  passkey_name: Array<Array<string>>;
}

/**
 * register_ii_user response result
 */
export type RegisterUserResponse =
  | { Ok: UserRecord }
  | { Err: string };

/**
 * Request status type
 */
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Executed' | 'Expired';

/**
 * Approval record
 */
export interface Approval {
  /** Approver */
  approver: string;
  /** Approval time */
  approved_at: bigint;
}

/**
 * Request record (returned from multi-sig canister)
 * Used to query the execution status of signature requests
 */
export interface RequestRecord {
  /** Request ID */
  id: bigint;
  /** Execution result (signature) - optional, Candid Opt type decoded as [] or [string] */
  execution_result: [] | [string];
  /** Request status */
  status: { [key in RequestStatus]?: null };
  /** Execution time - optional, Candid Opt type decoded as [] or [bigint] */
  executed_at: [] | [bigint];
  /** Request details */
  request: any;
  /** Creation time */
  created_at: bigint;
  /** Proposer */
  proposer: string;
  /** Approval list */
  approvals: Approval[];
}

// ==================== Constants ====================

/**
 * X402MultiSig default configuration constants
 * Centralized management of all default configurations for easy maintenance and modification
 */
export const DEFAULT_CONFIG = {
  /** Default Register Canister ID (used for registering and managing user identities) */
  registerCanisterId: 'jsinc-qqaaa-aaaab-ab55q-cai',

  /** Default identity name */
  identityName: 'default',

  /** Default identity storage directory (relative to project root) */
  identityDirRelativePath: '.multisig-x402/identities',

  /** Default network type */
  network: 'mainnet' as const,

  /** Default display name */
  displayName: 'x402MultiSig',

  /** Default username (empty string means not set) */
  username: '',

  /** Network host address configuration */
  hosts: {
    /** Local network host address */
    local: 'http://127.0.0.1:4943',
    /** Mainnet host address */
    mainnet: 'https://ic0.app',
  },
} as const;
