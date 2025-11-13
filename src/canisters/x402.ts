/**
 * X402 Canister Client
 *
 * This module handles interaction with the multisig wallet Canister to execute X402 payment signatures
 * Main features:
 * - Call create_request method to create X402 approval requests
 * - Query request status and retrieve EIP-712 signature results
 * - Support transferWithAuthorization authorization signatures
 */

import { Principal } from '@dfinity/principal';
import { IcAgentClient } from '../agent/client.js';
import {
  MultisigIdlFactory,
  X402TransferWithAuthorizationAction,
  RequestRecord,
  CreateRequestParams,
} from './idl/multisig.idl.js';
import type { X402SignParams } from '../types.js';
import { normalizeUint256 } from '../utils/hex.js';

/**
 * X402 Canister Client
 */
export class X402Client {
  /** IC Agent client reference */
  private agentClient: IcAgentClient;

  /** Canister Principal ID */
  private canisterId: Principal;

  /**
   * Create a new X402 client
   *
   * @param agentClient - IC Agent client reference
   * @param canisterId - Multisig wallet Canister ID (required, must be specified when using)
   */
  constructor(agentClient: IcAgentClient, canisterId: string) {
    this.agentClient = agentClient;

    // Validate that canisterId cannot be empty
    if (!canisterId || canisterId.trim() === '') {
      throw new Error('X402 Canister ID cannot be empty. Please specify a valid Canister ID.');
    }

    try {
      this.canisterId = Principal.fromText(canisterId);
    } catch (error) {
      throw new Error(
        `Failed to parse X402 Canister ID: ${canisterId}`
      );
    }

    console.log(`Creating X402 client, target Canister: ${this.canisterId.toText()}`);
  }

  /**
   * Create X402 signature request (without waiting for execution)
   *
   * Suitable for scenarios that require asynchronous processing. Returns request_id immediately after creating the request.
   * Can use getRequest() later to query the result.
   *
   * @param params - X402 signature parameters
   * @returns Request ID (request_id)
   * @throws If request creation fails
   *
   * @example
   * ```typescript
   * const client = new X402Client(agentClient, 'your-canister-id');
   * const requestId = await client.createRequestOnly({
   *   vaultId: 1n,
   *   to: '0x...',
   *   value: '0x3e8',
   *   validAfter: '0x0',
   *   validBefore: '0x...',
   *   nonce: '0x...',
   *   verifyingContract: '0x...',
   *   domainChainId: '0x14a34',
   *   domainName: 'USDC',
   *   domainVersion: '2'
   * });
   * console.log('Request ID:', requestId);
   * ```
   */
  async createRequestOnly(params: X402SignParams): Promise<bigint> {

    // ==================== Normalize hex parameters ====================
    // EIP-712 and Solidity require uint256 type to be 32 bytes (64 hexadecimal characters)
    // Need to left-pad 0 for the following fields: value, validAfter, validBefore, nonce
    const normalizedValue = normalizeUint256(params.value);
    const normalizedValidAfter = normalizeUint256(params.validAfter);
    const normalizedValidBefore = normalizeUint256(params.validBefore);
    const normalizedNonce = normalizeUint256(params.nonce);

    // Build X402TransferWithAuthorizationAction (using normalized parameters)
    const action: X402TransferWithAuthorizationAction = {
      vault_id: params.vaultId,
      to: params.to,
      value: normalizedValue,          // Use normalized value
      valid_after: normalizedValidAfter,  // Use normalized value
      valid_before: normalizedValidBefore, // Use normalized value
      nonce: normalizedNonce,          // Use normalized value
      verifying_contract: params.verifyingContract,
      domain_chain_id: params.domainChainId,
      domain_name: params.domainName,
      domain_version: params.domainVersion,
    };

    // Build request parameters for create_request
    const request: CreateRequestParams = {
      request_type: {
        X402TransferWithAuthorization: {
          action: action,
        },
      },
      expire_time: [], // Empty array means null (Opt<Nat64>)
    };

    try {
      // Call canister to create approval request and get request_id
      const requestId = await this.agentClient.callUpdate<bigint>(
        this.canisterId,
        'create_request',
        [request],
        MultisigIdlFactory
      );
      return requestId;
    } catch (error) {
      // Extract detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log detailed error for debugging
      console.error('❌ Failed to create X402 signature request');
      console.error(`   Error: ${errorMessage}`);
      if (errorStack) {
        console.error(`   Stack: ${errorStack}`);
      }

      // Throw a more informative error
      throw new Error(
        `Failed to create X402 signature request\n\n` +
        `Error Details:\n` +
        `  ${errorMessage}\n\n` +
        `Request Context:\n` +
        `  Canister ID: ${this.canisterId.toText()}\n` +
        `  Vault ID: ${params.vaultId}\n` +
        `  Recipient Address: ${params.to}\n` +
        `  Transfer Amount: ${params.value}\n` +
        `  Verifying Contract: ${params.verifyingContract}\n` +
        `  Chain ID: ${params.domainChainId}\n\n` +
        `Possible Causes:\n` +
        `  1. Canister does not exist or is inaccessible\n` +
        `  2. Vault ID does not exist or lacks permission\n` +
        `  3. Network connection issue\n` +
        `  4. Invalid parameter format\n\n` +
        `Recommendations:\n` +
        `  - Verify Canister ID is correct\n` +
        `  - Confirm current identity has permission to operate this Vault\n` +
        `  - Check network connection is stable\n` +
        `  - Validate parameter formats meet requirements`
      );
    }
  }

  /**
   * Query request status and execution result
   *
   * Used to get the current status and execution result of a specified request.
   * Supports silent mode query without logging.
   *
   * @param requestId - Request ID
   * @param silent - Whether to query silently (without logging), defaults to false
   * @returns Request record, returns null if not exists
   *
   * @example
   * ```typescript
   * const record = await client.getRequest(1n);
   * if (record && record.execution_result) {
   *   console.log('Signature result:', record.execution_result);
   * }
   * ```
   */
  async getRequest(requestId: bigint, silent: boolean = false): Promise<RequestRecord | null> {
    try {
      const response = await this.agentClient.callQuery<[RequestRecord] | []>(
        this.canisterId,
        'get_request',
        [requestId],
        MultisigIdlFactory,
        silent // Pass silent mode parameter
      );

      // Canister returns Opt(RequestRecord), which is in array form
      if (Array.isArray(response) && response.length > 0 && response[0]) {
        return response[0];
      }
      return null;
    } catch (error) {
      // Extract detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log error (unless in silent mode)
      if (!silent) {
        console.error(`❌ Failed to query request ${requestId}`);
        console.error(`   Error: ${errorMessage}`);
      }

      // Throw a more informative error
      throw new Error(
        `Failed to query X402 signature request\n\n` +
        `Error Details:\n` +
        `  ${errorMessage}\n\n` +
        `Request Context:\n` +
        `  Canister ID: ${this.canisterId.toText()}\n` +
        `  Request ID: ${requestId}\n\n` +
        `Possible Causes:\n` +
        `  1. Canister does not exist or is inaccessible\n` +
        `  2. Network connection issue\n` +
        `  3. Request ID does not exist\n\n` +
        `Recommendations:\n` +
        `  - Verify Canister ID is correct\n` +
        `  - Validate Request ID is valid\n` +
        `  - Confirm network connection is stable`
      );
    }
  }
}