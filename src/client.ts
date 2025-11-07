/**
 * X402MultiSig - SDK
 *
 * Provides a minimal API interface with automatic identity management:
 * 1. getPrincipalId() - Get the bot's Principal ID
 * 2. createSignRequest() - Create a multi-signature request
 * 3. getSignature() - Query signature (single query)
 *
 * Features:
 * - Automatic identity management: Auto-create identity on first use, auto-load thereafter
 * - Code-based configuration: All configurations passed via code, optional configs have defaults
 */

import { Ed25519KeyIdentity } from '@dfinity/identity';
import * as fs from 'fs';
import * as path from 'path';
import { IcAgentClient } from './agent/client.js';
import { X402Client } from './canisters/x402.js';
import { RegisterClient } from './canisters/register.js';
import { IdentityManager } from './identity/manager.js';
import type { X402SignParams, SupportedNetwork, SupportedToken } from './types.js';
import { CHAIN_ID_TO_NETWORK, isSupportedToken, getEIP712DomainParams, DEFAULT_CONFIG } from './types.js';
import { preparePaymentHeader } from 'x402/client';
import { encodePayment } from 'x402/schemes';
import { toHex } from 'viem';

/**
 * Signature Request Parameters (Full Version)
 * All parameters are required, EIP-712 domain parameters must be manually specified
 */
export interface SignRequestParams {
  /** Vault ID (wallet ID) */
  vaultId: bigint;
  /** Recipient address */
  to: string;
  /** Transfer amount (hex string, e.g. "0x3e8") */
  value: string;
  /** Valid after timestamp (hex string, e.g. "0x0") */
  validAfter: string;
  /** Valid before timestamp (hex string) */
  validBefore: string;
  /** Nonce (hex string) */
  nonce: string;
  /** Verifying contract address (token contract address) */
  verifyingContract: string;
  /** EIP-712 domain chain ID (hex string, e.g. "0x14a34") */
  domainChainId: string;
  /** EIP-712 domain name (e.g. "USDC") */
  domainName: string;
  /** EIP-712 domain version (e.g. "2") */
  domainVersion: string;
}

/**
 * Signature Request Parameters (Simplified Version)
 * Only need to specify network and token, SDK will auto-fill EIP-712 domain parameters
 */
export interface SimpleSignRequestParams {
  /** Vault ID (wallet ID) */
  vaultId: bigint;
  /** Recipient address */
  to: string;
  /** Transfer amount (hex string, e.g. "0x3e8") */
  value: string;
  /** Valid after timestamp (hex string, e.g. "0x0") */
  validAfter: string;
  /** Valid before timestamp (hex string) */
  validBefore: string;
  /** Nonce (hex string) */
  nonce: string;
  /** Network name (e.g. 'base-sepolia', 'base', 'solana') */
  network: SupportedNetwork;
  /** Token symbol (e.g. 'USDC', 'USDT', 'ETH') */
  token: SupportedToken;
  /** EIP-712 domain version (e.g. "2", optional, defaults to "2") */
  domainVersion?: string;
}

/**
 * Signature Result
 */
export interface SignatureResult {
  /** Request status: Pending | Approved | Rejected | Executed | Expired */
  status: string;
  /** Signature string (only exists when status is Executed) */
  signature?: string;
  /** Request ID */
  requestId: bigint;
  /** Creation timestamp (milliseconds) */
  createdAt: number;
  /** Execution timestamp (milliseconds, only exists when executed) */
  executedAt?: number;
}

/**
 * X402 Payment Protocol - Payment Requirements Configuration
 * Used to describe payment rules and network configuration for paid services
 */
export interface PaymentRequirements {
  /** Payment scheme (fixed as 'exact') */
  scheme: 'exact';
  /** Target network */
  network: SupportedNetwork;
  /** Maximum payment amount (smallest unit, e.g. 6 decimals for USDC) */
  maxAmountRequired: string;
  /** Resource URL (API address of paid service) */
  resource: string;
  /** Service description */
  description: string;
  /** Response content type */
  mimeType: string;
  /** Payment recipient address */
  payTo: string;
  /** Maximum timeout (seconds) */
  maxTimeoutSeconds: number;
  /** Token contract address */
  asset: string;
  /** Domain Chain ID (hex format) */
  domainChainId: string;
  /** Output schema (optional, used to describe API input/output format) */
  outputSchema?: {
    input: {
      type: string;
      method: string;
      discoverable: boolean;
    };
  };
  /** Additional EIP-712 domain parameters */
  extra: {
    /** Token name (e.g. "USDC") */
    name: string;
    /** Token version (e.g. "2") */
    version: string;
    /** Other additional parameters */
    [key: string]: any;
  };
}

/**
 * Paid Service Response Format
 */
export interface PaidServiceResponse {
  /** Whether successful */
  success: boolean;
  /** Response message */
  message: string;
  /** Response data (optional) */
  data?: any;
  /** Whether payment verification passed */
  paymentVerified: boolean;
  /** Response timestamp */
  timestamp: number;
}

/**
 * Parameters for callPaidService Method
 */
export interface CallPaidServiceParams {
  /** Vault ID (wallet ID) */
  vaultId: bigint;
  /** Payer address (your multi-sig wallet address) */
  fromAddress: `0x${string}`;
  /** Payment requirements configuration for paid service */
  paymentRequirements: PaymentRequirements;
  /** API URL of paid service */
  apiUrl: string;
  /** Polling configuration (optional) */
  polling?: {
    /** Maximum polling attempts (default: 120) */
    maxAttempts?: number;
    /** Polling interval (milliseconds, default: 3000) */
    interval?: number;
  };
}

/**
 * X402MultiSig Configuration Options
 */
export interface X402MultiSigOptions {
  /** X402 Canister ID (required) */
  x402CanisterId: string;
  /** Register Canister ID (optional, default: 'vkxj3-biaaa-aaaau-abyra-cai') */
  registerCanisterId?: string;
  /** Identity name (default: 'default') */
  identityName?: string;
  /** Identity storage directory (default: <project_dir>/.multisig-x402/identities) */
  identityDir?: string;
  /** IC network (default: 'mainnet') */
  network?: 'mainnet' | 'local';
  /** IC host address (optional, will be inferred from network) */
  host?: string;
  /** User display name (optional, default: 'x402MultiSig', only used when creating new identity) */
  displayName?: string;
  /** Username (optional, only used when creating new identity) */
  username?: string;
}

/**
 * X402MultiSig - Intelligent SDK Client
 *
 * Usage Example:
 * ```typescript
 * // 1. Initialize (automatic identity handling)
 * const bot = await X402MultiSig.create({
 *   x402CanisterId: 'unn7l-aqaaa-aaaau-ab7ka-cai'
 * });
 *
 * // 2. Get Principal ID
 * const pid = bot.getPrincipalId();
 *
 * // 3. Create signature request
 * const requestId = await bot.createSignRequest({
 *   vaultId: 1n,
 *   to: '0x...',
 *   value: '0x3e8',
 *   // ... other parameters
 * });
 *
 * // 4. Query signature
 * const result = await bot.getSignature(requestId);
 * if (result.status === 'Executed') {
 *   console.log('Signature:', result.signature);
 * }
 * ```
 */
export class X402MultiSig {
  /** Current identity in use */
  private identity: Ed25519KeyIdentity;
  /** IC Agent client */
  private agentClient: IcAgentClient;
  /** X402 Canister client */
  private x402Client: X402Client;
  /** Configuration options */
  private options: Required<X402MultiSigOptions>;

  /**
   * Private Constructor
   * Please use X402MultiSig.create() to create instances
   */
  private constructor(
    identity: Ed25519KeyIdentity,
    agentClient: IcAgentClient,
    x402Client: X402Client,
    options: Required<X402MultiSigOptions>
  ) {
    this.identity = identity;
    this.agentClient = agentClient;
    this.x402Client = x402Client;
    this.options = options;
  }

  /**
   * Create X402MultiSig Instance
   *
   * Automatically handles identity management:
   * - If identity doesn't exist, automatically creates new identity
   * - If identity exists, automatically loads it
   *
   * @param options - Configuration options
   * @returns X402MultiSig instance
   *
   * @example
   * ```typescript
   * const bot = await X402MultiSig.create({
   *   x402CanisterId: 'unn7l-aqaaa-aaaau-ab7ka-cai'
   * });
   * ```
   */
  static async create(options: X402MultiSigOptions): Promise<X402MultiSig> {
    // Fill in default configuration (using unified config defined in types.ts)
    const fullOptions: Required<X402MultiSigOptions> = {
      x402CanisterId: options.x402CanisterId,
      // Use default Register Canister ID
      registerCanisterId: options.registerCanisterId || DEFAULT_CONFIG.registerCanisterId,
      // Use default identity name
      identityName: options.identityName || DEFAULT_CONFIG.identityName,
      // Use relative path: create identity storage directory in project directory
      identityDir: options.identityDir || path.join(process.cwd(), DEFAULT_CONFIG.identityDirRelativePath),
      // Use default network type
      network: options.network || DEFAULT_CONFIG.network,
      // Automatically select host address based on network
      host: options.host || (
        options.network === 'local'
          ? DEFAULT_CONFIG.hosts.local
          : DEFAULT_CONFIG.hosts.mainnet
      ),
      // Use default display name
      displayName: options.displayName || DEFAULT_CONFIG.displayName,
      // Use default username
      username: options.username || DEFAULT_CONFIG.username,
    };

    // Intelligent identity management: check if identity exists
    const identityManager = new IdentityManager(fullOptions.identityDir);

    // Initialize identity manager, ensure directory exists
    await identityManager.initialize();

    const identityPath = path.join(fullOptions.identityDir, `${fullOptions.identityName}.json`);

    let identity: Ed25519KeyIdentity;
    let isNewIdentity = false; // Flag whether it's a newly created identity

    if (fs.existsSync(identityPath)) {
      // Identity exists, load it
      identity = await identityManager.loadIdentity(fullOptions.identityName);
    } else {
      // Identity doesn't exist, auto-create
      console.log('Identity does not exist, creating new identity...');
      identity = await identityManager.generateIdentity(
        fullOptions.identityName,
        false,
        fullOptions.username || undefined,
        fullOptions.displayName || undefined
      );
      console.log('✅ New identity created successfully');
      isNewIdentity = true; // Mark as new identity
    }
    const agentClient = await IcAgentClient.create(identity, fullOptions.host);

    // If it's a newly created identity, automatically register user
    if (isNewIdentity) {
      console.log('');
      console.log('New identity detected, automatically registering user...');

      try {
        // Create Register client
        const registerClient = new RegisterClient(agentClient, fullOptions.registerCanisterId);

        // Get Principal
        const principal = identity.getPrincipal();

        // Prepare registration parameters
        const username = fullOptions.username || `bot_${fullOptions.identityName}`;
        const displayName = fullOptions.displayName || 'x402MultiSig Bot';

        // Call registration method
        const user = await registerClient.registerUser(username, displayName, principal);

        console.log('✅ User registration successful');
        console.log(`   Username: ${user.user_name}`);
        console.log(`   Display name: ${user.display_name || '(None)'}`);
        console.log(`   Principal: ${user.user_principal.toText()}`);
        console.log('');
      } catch (error: any) {
        // If registration fails (e.g. username already exists), print warning but don't interrupt initialization
        console.warn('⚠️  User registration failed:', error.message);
        console.warn('   Continuing initialization, but this identity may not be able to use certain features');
        console.log('');
      }
    }

    // Create X402 Canister client
    const x402Client = new X402Client(agentClient, fullOptions.x402CanisterId);

    return new X402MultiSig(identity, agentClient, x402Client, fullOptions);
  }


  /**
   * Method 1: Get Bot's Principal ID
   *
   * @returns Principal ID string
   *
   * @example
   * ```typescript
   * const principalId = bot.getPrincipalId();
   * console.log('Bot Principal:', principalId);
   * // Output: "xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
   * ```
   */
  getPrincipalId(): string {
    return this.identity.getPrincipal().toText();
  }

  /**
   * Method 2: Create Multi-Signature Request
   *
   * Submit signature request to X402 Canister, returns request ID.
   * All parameters are required.
   *
   * @param params - Signature request parameters (all fields required)
   * @returns Request ID (for subsequent signature queries)
   *
   * @example
   * ```typescript
   * const requestId = await bot.createSignRequest({
   *   vaultId: 1n,
   *   to: '0x0987654321098765432109876543210987654321',
   *   value: '0x3e8',                    // 1000 (0.001 USDC with 6 decimals)
   *   validAfter: '0x0',
   *   validBefore: '0x67890abc',
   *   nonce: '0x123456',
   *   verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
   *   domainChainId: '0x14a34',         // Base Sepolia
   *   domainName: 'USDC',
   *   domainVersion: '2'
   * });
   *
   * console.log('Request ID:', requestId); // 1n
   * ```
   */
  async createSignRequest(params: SignRequestParams): Promise<bigint> {
    console.log('Creating multi-signature request...');
    console.log('');

    // ==================== Step 1: Verify Network Support ====================
    // Identify network from domainChainId
    const network: SupportedNetwork | undefined = CHAIN_ID_TO_NETWORK[params.domainChainId];

    if (!network) {
      const supportedChainIds = Object.keys(CHAIN_ID_TO_NETWORK).join(', ');
      throw new Error(
        `❌ Unsupported network Chain ID: ${params.domainChainId}\n` +
        `   Multi-sig wallet only supports the following networks:\n` +
        `   - BASE mainnet (Chain ID: 0x2105)\n` +
        `   - BASE testnet (Chain ID: 0x14a34)\n` +
        `   - Solana (Chain ID: solana)\n` +
        `   Supported Chain IDs: ${supportedChainIds}`
      );
    }

    // ==================== Step 2: Verify Token Contract Address ====================
    if (!isSupportedToken(network, params.verifyingContract)) {
      throw new Error(
        `❌ Unsupported token contract address: ${params.verifyingContract}\n` +
        `   Network: ${network}\n` +
        `   Multi-sig wallet only supports the following token contracts on ${network}:\n` +
        `${this.getSupportedTokensMessage(network)}\n` +
        `   Please verify the contract address or select a supported token.`
      );
    }

    // ==================== Step 3: Create Signature Request ====================
    // Convert to X402SignParams format
    const signParams: X402SignParams = {
      vaultId: params.vaultId,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      nonce: params.nonce,
      verifyingContract: params.verifyingContract,
      domainChainId: params.domainChainId,
      domainName: params.domainName,
      domainVersion: params.domainVersion,
    };

    // Directly call canister's create_request method (without waiting for execution)
    const requestId = await this.x402Client.createRequestOnly(signParams);

    console.log(`Request created, ID: ${requestId}`);
    console.log('');

    return requestId;
  }

  /**
   * Create Signature Request (Simplified Version)
   *
   * Only need to specify network and token, SDK will auto-fill EIP-712 domain parameters
   *
   * @param params - Simplified signature request parameters
   * @returns Request ID, for subsequent signature result queries
   *
   * @example
   * ```typescript
   * // Use simplified parameters, auto-configure domain
   * const requestId = await bot.createSignRequestSimple({
   *   vaultId: 1n,
   *   to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
   *   value: '0x3e8', // 1000
   *   validAfter: '0x0',
   *   validBefore: '0x64d9c5f0', // Valid period
   *   nonce: '0x1234567890abcdef',
   *   network: 'base-sepolia',  // Just specify network
   *   token: 'USDC',             // Just specify token
   *   domainVersion: '2'         // Optional, defaults to "2"
   * });
   *
   * console.log('Request ID:', requestId); // 1n
   * ```
   */
  async createSignRequestSimple(params: SimpleSignRequestParams): Promise<bigint> {

    // Use default version "2" (if not specified)
    const domainVersion = params.domainVersion || '2';
    console.log(`   Domain Version: ${domainVersion}`);
    console.log('');

    // Auto-retrieve domain parameters
    const domainParams = getEIP712DomainParams(params.network, params.token, domainVersion);

    // Convert to full parameter format
    const fullParams: SignRequestParams = {
      vaultId: params.vaultId,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      nonce: params.nonce,
      verifyingContract: domainParams.verifyingContract,
      domainChainId: domainParams.domainChainId,
      domainName: domainParams.domainName,
      domainVersion: domainParams.domainVersion,
    };

    // Call the full version of create request method
    return this.createSignRequest(fullParams);
  }

  /**
   * Get Supported Token List for Specified Network (for error messages)
   *
   * @param network - Network name
   * @returns Formatted token list string
   */
  private getSupportedTokensMessage(network: SupportedNetwork): string {
    // Dynamically import SUPPORTED_TOKENS to avoid circular dependencies
    const { SUPPORTED_TOKENS } = require('./types.js');
    const tokens = SUPPORTED_TOKENS[network];

    if (!tokens || tokens.length === 0) {
      return `   (No supported tokens on this network yet)`;
    }

    return tokens
      .map((token: any) =>
        `   - ${token.symbol} (${token.name}): ${token.address}`
      )
      .join('\n');
  }

  /**
   * Method 3: Query Signature
   *
   * Query signature result for specified request (single query, no polling).
   * Returns current status immediately, polling logic controlled by caller.
   *
   * @param requestId - Request ID (returned by createSignRequest)
   * @returns Signature result
   *
   * @example
   * ```typescript
   * // Single query
   * const result = await bot.getSignature(requestId);
   * console.log('Current status:', result.status);
   *
   * if (result.status === 'Executed') {
   *   console.log('Signature:', result.signature);
   * }
   *
   * // User controls polling
   * let result = await bot.getSignature(requestId);
   * while (result.status !== 'Executed') {
   *   await new Promise(resolve => setTimeout(resolve, 3000));
   *   result = await bot.getSignature(requestId);
   * }
   * console.log('Final signature:', result.signature);
   * ```
   */
  async getSignature(requestId: bigint): Promise<SignatureResult> {
    console.log('Querying signature...\n');

    const record = await this.x402Client.getRequest(requestId, true);

    if (!record) {
      throw new Error(`Request does not exist: ${requestId}`);
    }

    const statusKey = Object.keys(record.status)[0] as string;

    const result: SignatureResult = {
      status: statusKey,
      requestId,
      createdAt: Number(record.created_at / BigInt(1_000_000)),
    };

    // If executed, add signature and execution time
    if (statusKey === 'Executed' && record.execution_result.length > 0) {
      result.signature = record.execution_result[0];
      if (record.executed_at && record.executed_at.length > 0 && record.executed_at[0]) {
        result.executedAt = Number(record.executed_at[0] / BigInt(1_000_000));
      }
    }

    return result;
  }

  /**
   * Get Underlying X402Client (Advanced Usage)
   *
   * If you need to directly call advanced methods of X402 Canister, you can get the underlying client.
   *
   * @returns X402Client instance
   *
   * @example
   * ```typescript
   * const x402 = bot.getX402Client();
   * const record = await x402.getRequest(requestId, true);
   * ```
   */
  getX402Client(): X402Client {
    return this.x402Client;
  }

  /**
   * Get Underlying IC Agent Client (Advanced Usage)
   *
   * If you need to directly call other Canisters or perform underlying operations, you can get the Agent client.
   *
   * @returns IcAgentClient instance
   *
   * @example
   * ```typescript
   * const agent = bot.getAgentClient();
   * const result = await agent.callQuery(...);
   * ```
   */
  getAgentClient(): IcAgentClient {
    return this.agentClient;
  }

  /**
   * Get Current Identity in Use
   *
   * @returns Ed25519KeyIdentity instance
   *
   * @example
   * ```typescript
   * const identity = bot.getIdentity();
   * console.log('Principal:', identity.getPrincipal().toText());
   * ```
   */
  getIdentity(): Ed25519KeyIdentity {
    return this.identity;
  }

  /**
   * Get Configuration Options (Read-only)
   *
   * @returns Current configuration options
   */
  getOptions(): Readonly<Required<X402MultiSigOptions>> {
    return { ...this.options };
  }

  /**
   * Call Paid Service (using X402 Payment Protocol)
   *
   * This method encapsulates the complete X402 payment flow:
   * 1. Prepare unsigned payment header (using x402 library)
   * 2. Extract signature parameters
   * 3. Create signature request
   * 4. Poll and wait for signature completion
   * 5. Build signed payment header
   * 6. Encode to standard x-payment header
   * 7. Send HTTP request with x-payment header
   *
   * @param params - Parameters for calling paid service
   * @returns Response from paid service (format may vary by service)
   *
   * @example
   * ```typescript
   * // Define payment requirements
   * const paymentRequirements = {
   *   scheme: 'exact',
   *   network: 'base-sepolia',
   *   maxAmountRequired: '1000', // 1000 smallest units (0.001 USDC with 6 decimals)
   *   resource: 'http://example.com/api/weather',
   *   description: 'Weather API Access',
   *   mimeType: 'application/json',
   *   payTo: '0x2f795904540BE35c3B66A9643F58DAC14E8fA30B',
   *   maxTimeoutSeconds: 3600,
   *   asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
   *   domainChainId: '0x14a34', // Base Sepolia Chain ID
   *   extra: {
   *     name: 'USDC',
   *     version: '2',
   *   },
   * };
   *
   * // Call paid service
   * const response = await bot.callPaidService({
   *   vaultId: 1n,
   *   fromAddress: '0x92e07732b23258Ac4c8b5856a11e1D0F5D72749d',
   *   paymentRequirements,
   *   apiUrl: 'http://example.com/api/weather',
   * });
   *
   * console.log('Service response:', response);
   * ```
   */
  async callPaidService(params: CallPaidServiceParams): Promise<any> {

    const { vaultId, fromAddress, paymentRequirements, apiUrl, polling } = params;

    // Polling configuration (use default values)
    const maxAttempts = polling?.maxAttempts || 120;  // Default 120 times (6 minutes)
    const interval = polling?.interval || 3000;        // Default 3 seconds

    // ==================== Step 1: Prepare Unsigned Payment Header ====================
    const x402Version = 1;
    const unsignedPaymentHeader = preparePaymentHeader(
      fromAddress,
      x402Version,
      paymentRequirements
    );

    // ==================== Step 2: Extract Signature Parameters ====================
    const to = unsignedPaymentHeader.payload.authorization.to;
    const value = toHex(BigInt(unsignedPaymentHeader.payload.authorization.value));
    const validAfter = toHex(BigInt(unsignedPaymentHeader.payload.authorization.validAfter));
    const validBefore = toHex(BigInt(unsignedPaymentHeader.payload.authorization.validBefore));
    const nonce = unsignedPaymentHeader.payload.authorization.nonce;

    // ==================== Step 3: Create Signature Request ====================
    const requestId = await this.createSignRequest({
      vaultId,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
      verifyingContract: paymentRequirements.asset,
      domainChainId: paymentRequirements.domainChainId,
      domainName: paymentRequirements.extra.name,
      domainVersion: paymentRequirements.extra.version,
    });

    // ==================== Step 4: Poll and Wait for Signature Completion ====================
    let result = await this.getSignature(requestId);

    // If signature not yet completed, start polling
    if (result.status !== 'Executed') {
      console.log('Signature request not yet completed, starting polling...');

      let attempts = 0;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts}... Status: ${result.status}`);

        // Wait for interval
        await new Promise(resolve => setTimeout(resolve, interval));

        // Query latest status
        result = await this.getSignature(requestId);

        // Check if completed
        if (result.status === 'Executed') {
          console.log('');
          console.log('✅ Signature request completed');
          console.log('');
          break;
        } else if (result.status === 'Rejected') {
          throw new Error('Signature request rejected');
        } else if (result.status === 'Expired') {
          throw new Error('Signature request expired');
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error('Polling timeout, signature request not completed');
      }
    } else {
      console.log('✅ Signature completed');
      console.log('');
    }

    // Check if signature exists
    if (!result.signature) {
      throw new Error('Failed to retrieve signature');
    }

    // ==================== Step 5: Build Complete Signed Payment Header ====================
    // Ensure signature has 0x prefix
    const signatureWithPrefix = result.signature.startsWith('0x')
      ? result.signature
      : '0x' + result.signature;

    // Add signature to payment header
    const signedPayload = {
      ...unsignedPaymentHeader,
      payload: {
        ...unsignedPaymentHeader.payload,
        signature: signatureWithPrefix,
      },
    };

    // ==================== Step 6: Encode to Standard x-payment Header ====================
    const encodedPayment = encodePayment(signedPayload);

    // ==================== Step 7: Send Request with Standard x-payment Header ====================
    console.log(`Sending request to: ${apiUrl}`);
    console.log('');

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-payment': encodedPayment,
        'User-Agent': 'X402MultiSig-SDK/1.0',
      },
    });
    // Check response status
    if (!response.ok) {
      throw new Error(
        `Server returned error: ${response.status} ${response.statusText}`
      );
    }
    // Parse response
    const serviceResponse = await response.json();
    console.log('Paid service call successful');
    return serviceResponse;
  }
}