/**
 * IC Agent Client Wrapper Module
 *
 * This module is responsible for:
 * - Creating and configuring IC Agent instances
 * - Providing a unified Canister call interface
 * - Handling network connections and error retries
 */

import { HttpAgent, Actor, ActorSubclass } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

/**
 * IC Agent Client
 * Specifically designed for connecting to Internet Computer mainnet
 */
export class IcAgentClient {
  /** Underlying HttpAgent instance */
  private agent: HttpAgent;

  /** Identity being used */
  private identity: Identity;

  /**
   * Create a new IC Agent client (private constructor, use create static method)
   *
   * @param agent - HttpAgent instance
   * @param identity - Identity used for signing
   */
  private constructor(agent: HttpAgent, identity: Identity) {
    this.agent = agent;
    this.identity = identity;
  }

  /**
   * Create a new IC Agent client
   *
   * @param identity - Identity used for signing (contains Ed25519 key pair)
   * @param host - IC network host address (defaults to "https://ic0.app")
   * @returns IcAgentClient instance
   *
   * @example
   * ```typescript
   * const client = await IcAgentClient.create(identity, "https://ic0.app");
   * ```
   */
  static async create(identity: Identity, host: string = 'https://ic0.app'): Promise<IcAgentClient> {
    console.log('Creating IC Agent client...');
    console.log(`Host address: ${host}`);

    // Create Agent (specifically configured for mainnet)
    const agent = await HttpAgent.create({
      host, // Set IC mainnet URL
      identity, // Set identity for signing
    });

    // Mainnet environment does not need to fetch root key (built-in)
    // If in local development environment, need to call agent.fetchRootKey()
    if (host.includes('127.0.0.1') || host.includes('localhost')) {
      console.log('Local environment detected, fetching root key...');
      await agent.fetchRootKey();
    }

    return new IcAgentClient(agent, identity);
  }

  /**
   * Create Actor instance (for type-safe Canister calls)
   *
   * @param canisterId - Canister's Principal ID
   * @param idlFactory - Candid interface definition factory function
   * @returns Actor instance
   *
   * @example
   * ```typescript
   * const actor = client.createActor(canisterId, idlFactory);
   * const result = await actor.someMethod();
   * ```
   */
  createActor<T>(canisterId: Principal, idlFactory: IDL.InterfaceFactory): ActorSubclass<T> {
    return Actor.createActor<T>(idlFactory, {
      agent: this.agent,
      canisterId,
    });
  }

  /**
   * Call Canister's update method (modifies state)
   *
   * @param canisterId - Canister's Principal ID
   * @param methodName - Method name to call
   * @param args - Method arguments array
   * @param idlFactory - Candid interface definition factory function
   * @returns Decoded response
   *
   * @example
   * ```typescript
   * const result = await client.callUpdate(
   *   canisterId,
   *   'register_user',
   *   [username, displayName],
   *   idlFactory
   * );
   * ```
   *
   * @description
   * ### How it works
   * 1. Sign the request using the identity's private key
   * 2. Send the signed request to the IC network
   * 3. Wait for consensus and retrieve the result
   */
  async callUpdate<T>(
    canisterId: Principal,
    methodName: string,
    args: unknown[],
    idlFactory: IDL.InterfaceFactory
  ): Promise<T> {
    console.log(`Calling Canister update method: ${canisterId.toText()}::${methodName}`);

    try {
      // Create Actor
      const actor = this.createActor<Record<string, (...args: any[]) => Promise<any>>>(
        canisterId,
        idlFactory
      );

      // Call method
      const result = await actor[methodName](...args);

      console.log(`✅ Call successful: ${canisterId.toText()}::${methodName}`);
      return result as T;
    } catch (error) {
      console.error(`❌ Call failed: ${canisterId.toText()}::${methodName}`);
      throw new Error(`Failed to call update method: ${error}`);
    }
  }

  /**
   * Call Canister's query method (read-only, does not modify state)
   *
   * @param canisterId - Canister's Principal ID
   * @param methodName - Method name to call
   * @param args - Method arguments array
   * @param idlFactory - Candid interface definition factory function
   * @param silent - Whether to execute silently (no logging), defaults to false
   * @returns Decoded response
   *
   * @example
   * ```typescript
   * const result = await client.callQuery(
   *   canisterId,
   *   'get_user',
   *   [userId],
   *   idlFactory
   * );
   * ```
   */
  async callQuery<T>(
    canisterId: Principal,
    methodName: string,
    args: unknown[],
    idlFactory: IDL.InterfaceFactory,
    silent: boolean = false
  ): Promise<T> {
    // Do not print logs in silent mode
    if (!silent) {
      console.log(`Calling Canister query method: ${canisterId.toText()}::${methodName}`);
    }

    try {
      // Create Actor
      const actor = this.createActor<Record<string, (...args: any[]) => Promise<any>>>(
        canisterId,
        idlFactory
      );

      // Call method (query calls do not require consensus, faster)
      const result = await actor[methodName](...args);

      if (!silent) {
        console.log(`✅ Query successful: ${canisterId.toText()}::${methodName}`);
      }
      return result as T;
    } catch (error) {
      console.error(`❌ Query failed: ${canisterId.toText()}::${methodName}`);
      throw new Error(`Failed to call query method: ${error}`);
    }
  }

  /**
   * Get Agent status information
   *
   * @returns Agent status
   */
  async getStatus(): Promise<any> {
    try {
      const status = await this.agent.status();
      return status;
    } catch (error) {
      throw new Error(`Failed to get Agent status: ${error}`);
    }
  }

  /**
   * Get currently used Principal
   *
   * @returns Principal ID
   */
  getPrincipal(): Principal {
    return this.identity.getPrincipal();
  }

  /**
   * Get reference to underlying Agent instance (advanced usage)
   *
   * @returns HttpAgent instance
   */
  getAgent(): HttpAgent {
    return this.agent;
  }

  /**
   * Get currently used identity
   *
   * @returns Identity instance
   */
  getIdentity(): Identity {
    return this.identity;
  }
}

/**
 * Create default IC mainnet client
 * Creates client using default IC mainnet endpoint (https://ic0.app)
 *
 * @param identity - Identity used for signing
 * @returns IcAgentClient instance
 *
 * @example
 * ```typescript
 * import { Ed25519KeyIdentity } from '@dfinity/identity';
 *
 * const identity = Ed25519KeyIdentity.generate();
 * const client = await createMainnetClient(identity);
 * ```
 */
export async function createMainnetClient(identity: Identity): Promise<IcAgentClient> {
  return IcAgentClient.create(identity, 'https://ic0.app'); // IC mainnet default endpoint
}
