/**
 * Register Canister Client
 *
 * This module handles interaction with the user registration Canister
 * Main features:
 * - Register Internet Identity users
 * - Query user information
 * - Check if username is already taken
 */

import { Principal } from '@dfinity/principal';
import { IcAgentClient } from '../agent/client.js';
import { RegisterIdlFactory, type User } from './idl/register.idl.js';

// Re-export User type for external use
export type { User } from './idl/register.idl.js';

/**
 * Registration result type
 * Corresponds to Rust's Result<User, String>
 */
export type RegisterResult = { Ok: User } | { Err: string };

/**
 * Register Canister Client
 */
export class RegisterClient {
  /** IC Agent client reference */
  private agentClient: IcAgentClient;

  /** Canister Principal ID */
  private canisterId: Principal;

  /**
   * Create a new Register client
   *
   * @param agentClient - IC Agent client reference
   * @param canisterId - Register Canister ID
   */
  constructor(agentClient: IcAgentClient, canisterId: string) {
    this.agentClient = agentClient;

    // Validate that canisterId cannot be empty
    if (!canisterId || canisterId.trim() === '' || canisterId === 'default') {
      throw new Error(
        'Register Canister ID cannot be empty or "default". Please specify a valid Canister ID.'
      );
    }

    try {
      this.canisterId = Principal.fromText(canisterId);
    } catch (error) {
      throw new Error(
        `Failed to parse Register Canister ID: ${canisterId}. Error: ${error}`
      );
    }

    console.log(`Creating Register client, target Canister: ${this.canisterId.toText()}`);
  }

  /**
   * Register Internet Identity user
   *
   * Calls register_ii_user method to register a new user.
   * Returns an error if username already exists or Principal is already registered.
   *
   * @param username - Username (unique, cannot be duplicated)
   * @param displayName - Display name
   * @param principal - User's Principal ID
   * @returns Returns User object on success, throws exception on failure
   * @throws If username already exists, Principal already registered, or other errors
   *
   * @example
   * ```typescript
   * const client = new RegisterClient(agentClient, 'register-canister-id');
   * try {
   *   const user = await client.registerUser(
   *     'bot_user_001',
   *     'X402 Bot User',
   *     principal
   *   );
   *   console.log('Registration successful:', user);
   * } catch (error) {
   *   console.error('Registration failed:', error);
   * }
   * ```
   */
  async registerUser(
    username: string,
    displayName: string,
    principal: Principal
  ): Promise<User> {
    console.log('📝 Preparing to register user to Register Canister...');
    console.log(`  Username: ${username}`);
    console.log(`  Display name: ${displayName}`);
    console.log(`  Principal: ${principal.toText()}`);

    try {
      // Call canister's register_ii_user method
      const result = await this.agentClient.callUpdate<RegisterResult>(
        this.canisterId,
        'register_ii_user',
        [username, displayName, principal],
        RegisterIdlFactory
      );

      // Process return result
      if ('Ok' in result) {
        console.log('✅ User registration successful');
        return result.Ok;
      } else if ('Err' in result) {
        // Registration failed
        throw new Error(`Registration failed: ${result.Err}`);
      } else {
        throw new Error('Unknown return result format');
      }
    } catch (error) {
      console.error('❌ Failed to register user:', error);
      throw error;
    }
  }

  /**
   * Check if username is already taken (query method)
   *
   * @param username - Username
   * @returns true means taken, false means available
   *
   * @example
   * ```typescript
   * const isTaken = await client.isUsernameTaken('bot_user_001');
   * if (isTaken) {
   *   console.log('Username already taken');
   * }
   * ```
   */
  async isUsernameTaken(username: string): Promise<boolean> {
    try {
      const isTaken = await this.agentClient.callQuery<boolean>(
        this.canisterId,
        'is_username_taken',
        [username],
        RegisterIdlFactory,
        true // Silent mode
      );

      return isTaken;
    } catch (error) {
      console.error(`❌ Failed to check username: ${username}`, error);
      throw error;
    }
  }

  /**
   * Get user information by username (query method)
   *
   * @param username - Username
   * @returns User object, returns null if not exists
   *
   * @example
   * ```typescript
   * const user = await client.getUser('bot_user_001');
   * if (user) {
   *   console.log('User info:', user);
   * }
   * ```
   */
  async getUser(username: string): Promise<User | null> {
    try {
      const response = await this.agentClient.callQuery<[User] | []>(
        this.canisterId,
        'get_user',
        [username],
        RegisterIdlFactory,
        true // Silent mode
      );

      // Canister returns Opt(User), which is in array form
      if (Array.isArray(response) && response.length > 0 && response[0]) {
        return response[0];
      }
      return null;
    } catch (error) {
      console.error(`❌ Failed to query user: ${username}`, error);
      throw error;
    }
  }
}