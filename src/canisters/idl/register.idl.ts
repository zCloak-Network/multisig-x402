/**
 * Register Canister IDL Definition
 *
 * This file defines the interface for the user registration Canister
 * Main feature: Register Internet Identity users
 */

import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';

/**
 * User information
 */
export interface User {
  /** User's Principal ID */
  user_principal: Principal;
  /** Username (unique) */
  user_name: string;
  /** Display name (optional) */
  display_name?: string;
  /** Passkey name list (optional) */
  passkey_name?: string[];
  /** Creation time (millisecond timestamp) */
  create_time: number;
  /** Update time (millisecond timestamp) */
  update_time: number;
}

/**
 * Register Canister IDL Factory Function
 * Defines the Canister interface
 */
export const RegisterIdlFactory: IDL.InterfaceFactory = ({ IDL }) => {
  // ========== Basic Type Definitions ==========

  /**
   * User type definition
   * Corresponds to Rust's User struct
   */
  const User = IDL.Record({
    user_principal: IDL.Principal,
    user_name: IDL.Text,
    display_name: IDL.Opt(IDL.Text),
    passkey_name: IDL.Opt(IDL.Vec(IDL.Text)),
    create_time: IDL.Nat64,
    update_time: IDL.Nat64,
  });

  // ========== Service Interface Definition ==========
  return IDL.Service({
    /**
     * Register Internet Identity user
     *
     * @param username - Username (unique, cannot be duplicated)
     * @param display_name - Display name
     * @param principal - User's Principal ID
     * @returns User object (success) or error message (failure)
     *
     * @example
     * ```typescript
     * const result = await actor.register_ii_user(
     *   'bot_user_001',
     *   'X402 Bot User',
     *   principal
     * );
     * ```
     */
    register_ii_user: IDL.Func(
      [IDL.Text, IDL.Text, IDL.Principal],
      [IDL.Variant({ Ok: User, Err: IDL.Text })],
      []
    ),

    /**
     * Get user information by username (query method)
     *
     * @param username - Username
     * @returns User object (optional)
     */
    get_user: IDL.Func(
      [IDL.Text],
      [IDL.Opt(User)],
      ['query']
    ),

    /**
     * Check if username is already registered (query method)
     *
     * @param username - Username
     * @returns true means registered, false means not registered
     */
    is_username_taken: IDL.Func(
      [IDL.Text],
      [IDL.Bool],
      ['query']
    ),
  });
};