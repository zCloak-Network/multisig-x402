/**
 * Ed25519 Identity Management Module
 *
 * This module is responsible for:
 * - Generating Ed25519 key pairs
 * - Importing/exporting keys (PEM format)
 * - Computing Principal ID
 * - Local secure storage (file permissions 0600 + optional encryption)
 */

import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Principal } from '@dfinity/principal';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Identity storage data structure
 * Contains key information and associated username, displayName
 */
export interface IdentityStorageData {
  /** Key data (result of Ed25519KeyIdentity.toJSON(), which is an array) */
  keyData: [string, string];
  /** Principal ID (used for verification) */
  principal: string;
  /** Associated username (optional) */
  username?: string;
  /** Display name (optional, defaults to "x402MultiSig") */
  displayName?: string;
  /** Creation time (ISO 8601 format) */
  createdAt: string;
  /** Last update time (ISO 8601 format) */
  updatedAt: string;
}

/**
 * Identity Manager, responsible for generating, storing, and loading key pairs
 */
export class IdentityManager {
  /** Identity storage directory */
  private identityDir: string;

  /** Currently active identity name */
  private activeIdentity?: string;

  /** Cache mapping identity names to usernames */
  private identityUsernameCache: Map<string, string | undefined> = new Map();

  /** Cache mapping identity names to display names */
  private identityDisplayNameCache: Map<string, string | undefined> = new Map();

  /**
   * Create a new Identity Manager
   *
   * @param identityDir - Directory path for storing identity files
   */
  constructor(identityDir: string) {
    this.identityDir = identityDir;
  }

  /**
   * Initialize the Identity Manager
   * Ensure the storage directory exists and has correct permissions
   */
  async initialize(): Promise<void> {
    // Ensure directory exists
    if (!fsSync.existsSync(this.identityDir)) {
      await fs.mkdir(this.identityDir, { recursive: true, mode: 0o700 });
      console.log(`Identity storage directory created: ${this.identityDir}`);
    } else {
      // Directory already exists, ensure correct permissions (Unix systems)
      if (process.platform !== 'win32') {
        try {
          await fs.chmod(this.identityDir, 0o700);
        } catch (error) {
          console.warn(`Failed to set identity directory permissions: ${error}`);
        }
      }
    }
  }

  /**
   * Generate and save a new Ed25519 key pair
   *
   * @param name - Identity name (used as filename)
   * @param overwrite - Whether to overwrite existing identity
   * @param username - Optional associated username
   * @param displayName - Optional display name (defaults to "x402MultiSig")
   * @returns Generated Ed25519KeyIdentity
   * @throws If identity already exists and overwrite is not allowed
   */
  async generateIdentity(
    name: string,
    overwrite: boolean = false,
    username?: string,
    displayName?: string
  ): Promise<Ed25519KeyIdentity> {
    const keyPath = this.getKeyPath(name);

    // Check if already exists
    if (fsSync.existsSync(keyPath) && !overwrite) {
      throw new Error(`Identity '${name}' already exists. Use overwrite parameter to replace it.`);
    }

    // If no displayName is provided, use default value 'x402MultiSig'
    if (!displayName) {
      displayName = 'x402MultiSig';
    }

    // Generate new key pair
    console.log('Generating new Ed25519 key pair...');
    const identity = Ed25519KeyIdentity.generate();

    // Save to file (including username and displayName)
    await this.saveIdentity(name, identity, username, displayName);

    // Set as current active identity
    this.activeIdentity = name;

    const principal = identity.getPrincipal();
    console.log(`Successfully generated new identity '${name}', Principal: ${principal.toText()}`);

    return identity;
  }

  /**
   * Save identity private key to file
   *
   * @param name - Identity name
   * @param identity - Ed25519KeyIdentity instance
   * @param username - Optional associated username
   * @param displayName - Optional display name
   */
  private async saveIdentity(
    name: string,
    identity: Ed25519KeyIdentity,
    username?: string,
    displayName?: string
  ): Promise<void> {
    const keyPath = this.getKeyPath(name);
    const principal = identity.getPrincipal().toText();

    // Check if file already exists, if so preserve original creation time and unprovided fields
    let createdAt = new Date().toISOString();
    if (fsSync.existsSync(keyPath)) {
      try {
        const existingContent = await fs.readFile(keyPath, 'utf-8');
        const existingData = JSON.parse(existingContent) as IdentityStorageData;
        // Preserve original creation time
        createdAt = existingData.createdAt;
        // If no new username is provided, preserve the old username
        if (!username && existingData.username) {
          username = existingData.username;
        }
        // If no new displayName is provided, preserve the old displayName
        if (!displayName && existingData.displayName) {
          displayName = existingData.displayName;
        }
      } catch (error) {
        // If read or parse fails, use current time
        console.warn(`Failed to read existing identity file, will use current time: ${error}`);
      }
    }

    // Create new format storage data
    const storageData: IdentityStorageData = {
      keyData: identity.toJSON(),
      principal,
      username,
      displayName,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    // Write to file
    await fs.writeFile(keyPath, JSON.stringify(storageData, null, 2), {
      encoding: 'utf-8',
      mode: 0o600, // Owner read/write only
    });

    console.log(`Private key saved to: ${keyPath}`);
    if (username) {
      console.log(`Associated username: ${username}`);
      // Update cache
      this.identityUsernameCache.set(name, username);
    }
    if (displayName) {
      console.log(`Display name: ${displayName}`);
      // Update cache
      this.identityDisplayNameCache.set(name, displayName);
    }

    // Double-check file permissions are 0600 on Unix systems (extra safety)
    if (process.platform !== 'win32') {
      try {
        await fs.chmod(keyPath, 0o600);
      } catch (error) {
        console.warn(`Failed to set private key file permissions: ${error}`);
      }
    }
  }

  /**
   * Load identity from file
   *
   * @param name - Identity name
   * @returns Loaded Ed25519KeyIdentity
   * @throws If identity does not exist or loading fails
   */
  async loadIdentity(name: string): Promise<Ed25519KeyIdentity> {
    const keyPath = this.getKeyPath(name);

    if (!fsSync.existsSync(keyPath)) {
      throw new Error(`Identity '${name}' does not exist`);
    }

    // Read JSON file
    const fileContent = await fs.readFile(keyPath, 'utf-8');
    const storageData = JSON.parse(fileContent) as IdentityStorageData;

    // Create identity from storage data
    const identity = Ed25519KeyIdentity.fromJSON(JSON.stringify(storageData.keyData));

    // Verify Principal matches
    const loadedPrincipal = identity.getPrincipal().toText();
    if (loadedPrincipal !== storageData.principal) {
      console.warn(
        `Principal mismatch for identity '${name}': ` +
          `stored=${storageData.principal}, loaded=${loadedPrincipal}`
      );
    }

    // Set as current active identity
    this.activeIdentity = name;

    // Update cache
    this.identityUsernameCache.set(name, storageData.username);
    this.identityDisplayNameCache.set(name, storageData.displayName);

    const principal = identity.getPrincipal();
    console.log(`Successfully loaded identity '${name}', Principal: ${principal.toText()}`);
    if (storageData.username) {
      console.log(`Associated username: ${storageData.username}`);
    }
    if (storageData.displayName) {
      console.log(`Display name: ${storageData.displayName}`);
    }

    return identity;
  }

  /**
   * List all saved identities
   *
   * @returns Array of identity names
   */
  async listIdentities(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.identityDir);
      const identities: string[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const name = path.basename(file, '.json');
          identities.push(name);
        }
      }

      return identities;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete identity file
   *
   * @param name - Name of identity to delete
   * @throws If identity does not exist
   */
  async deleteIdentity(name: string): Promise<void> {
    const keyPath = this.getKeyPath(name);

    if (!fsSync.existsSync(keyPath)) {
      throw new Error(`Identity '${name}' does not exist`);
    }

    await fs.unlink(keyPath);

    // If the deleted identity is the current active one, clear active status
    if (this.activeIdentity === name) {
      this.activeIdentity = undefined;
    }

    console.warn(`Identity '${name}' deleted`);
  }

  /**
   * Export identity as JSON format string
   *
   * @param name - Identity name
   * @returns JSON format private key string
   * @throws If identity does not exist
   */
  async exportIdentity(name: string): Promise<string> {
    const keyPath = this.getKeyPath(name);

    if (!fsSync.existsSync(keyPath)) {
      throw new Error(`Identity '${name}' does not exist`);
    }

    const fileContent = await fs.readFile(keyPath, 'utf-8');
    return fileContent;
  }

  /**
   * Import identity from JSON string
   *
   * @param name - Identity name
   * @param jsonContent - JSON format private key string
   * @param overwrite - Whether to overwrite existing identity
   * @param username - Optional associated username
   * @param displayName - Optional display name (defaults to "x402MultiSig")
   * @returns Imported Ed25519KeyIdentity
   * @throws If identity already exists and overwrite is not allowed, or JSON format is invalid
   */
  async importIdentity(
    name: string,
    jsonContent: string,
    overwrite: boolean = false,
    username?: string,
    displayName?: string
  ): Promise<Ed25519KeyIdentity> {
    const keyPath = this.getKeyPath(name);

    // Check if already exists
    if (fsSync.existsSync(keyPath) && !overwrite) {
      throw new Error(`Identity '${name}' already exists. Use overwrite parameter to replace it.`);
    }

    // If no displayName is provided, use default value 'x402MultiSig'
    if (!displayName) {
      displayName = 'x402MultiSig';
    }

    // Validate JSON format and create identity
    let identity: Ed25519KeyIdentity;
    try {
      const jsonKey = JSON.parse(jsonContent);
      identity = Ed25519KeyIdentity.fromJSON(JSON.stringify(jsonKey));
    } catch (error) {
      throw new Error(`Invalid Ed25519 private key JSON format: ${error}`);
    }

    // Save to file (including username and displayName)
    await this.saveIdentity(name, identity, username, displayName);

    // Set as current active identity
    this.activeIdentity = name;

    const principal = identity.getPrincipal();
    console.log(`Successfully imported identity '${name}', Principal: ${principal.toText()}`);

    return identity;
  }

  /**
   * Import identity from PEM string (compatibility method)
   * Note: @dfinity/identity primarily uses JSON format, PEM format requires conversion
   *
   * @param name - Identity name
   * @param pemContent - PEM format private key string
   * @param overwrite - Whether to overwrite existing identity
   * @param username - Optional associated username
   * @param displayName - Optional display name (defaults to "x402MultiSig")
   * @returns Imported Ed25519KeyIdentity
   */
  async importIdentityFromPEM(
    name: string,
    pemContent: string,
    overwrite: boolean = false,
    username?: string,
    displayName?: string
  ): Promise<Ed25519KeyIdentity> {
    const keyPath = this.getKeyPath(name);

    // Check if already exists
    if (fsSync.existsSync(keyPath) && !overwrite) {
      throw new Error(`Identity '${name}' already exists. Use overwrite parameter to replace it.`);
    }

    // If no displayName is provided, use default value 'x402MultiSig'
    if (!displayName) {
      displayName = 'x402MultiSig';
    }

    // Parse PEM format to extract private key
    let identity: Ed25519KeyIdentity;
    try {
      // Remove PEM header/footer and newlines, extract base64 encoded key data
      const pemHeader = '-----BEGIN PRIVATE KEY-----';
      const pemFooter = '-----END PRIVATE KEY-----';

      if (!pemContent.includes(pemHeader) || !pemContent.includes(pemFooter)) {
        throw new Error('Invalid PEM format: missing required header or footer markers');
      }

      // Extract base64 portion
      const base64Content = pemContent
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, ''); // Remove all whitespace characters

      // Decode base64 to byte array
      const binaryKey = Buffer.from(base64Content, 'base64');

      // PKCS#8 format Ed25519 private key structure:
      // - Total length is typically 48 bytes
      // - First 16 bytes are PKCS#8 header (contains OID and other info)
      // - Last 32 bytes are the actual Ed25519 private key
      // We need to extract the last 32 bytes as the private key
      let secretKeyBytes: Uint8Array;
      if (binaryKey.length === 32) {
        // If it's pure 32 bytes, use directly
        secretKeyBytes = new Uint8Array(binaryKey);
      } else if (binaryKey.length >= 48) {
        // If it's PKCS#8 format (48 bytes or longer), extract last 32 bytes
        // Convert Buffer to Uint8Array to avoid deprecation warnings
        const fullArray = new Uint8Array(binaryKey);
        secretKeyBytes = fullArray.slice(-32);
      } else {
        throw new Error(`Invalid key length: ${binaryKey.length} bytes, expected 32 or 48 bytes`);
      }

      // Create identity from private key (create new ArrayBuffer to ensure correct type)
      // Create a new ArrayBuffer and copy data
      const secretKeyBuffer = new ArrayBuffer(secretKeyBytes.length);
      const view = new Uint8Array(secretKeyBuffer);
      view.set(secretKeyBytes);

      identity = Ed25519KeyIdentity.fromSecretKey(secretKeyBuffer);
    } catch (error) {
      throw new Error(`Invalid PEM format: ${error}`);
    }

    // Save to file (in JSON format, including username and displayName)
    await this.saveIdentity(name, identity, username, displayName);

    // Set as current active identity
    this.activeIdentity = name;

    const principal = identity.getPrincipal();
    console.log(`Successfully imported identity '${name}' from PEM, Principal: ${principal.toText()}`);

    return identity;
  }

  /**
   * Get the current active identity name
   *
   * @returns Current active identity name, or undefined if none
   */
  getActiveIdentity(): string | undefined {
    return this.activeIdentity;
  }

  /**
   * Get the Principal corresponding to an identity
   *
   * @param identity - Ed25519KeyIdentity instance
   * @returns Principal ID
   */
  static getPrincipal(identity: Ed25519KeyIdentity): Principal {
    return identity.getPrincipal();
  }

  /**
   * Get the username for a specified identity
   *
   * @param name - Identity name
   * @returns username (if exists), otherwise returns undefined
   */
  async getUsername(name: string): Promise<string | undefined> {
    // Check cache first
    if (this.identityUsernameCache.has(name)) {
      return this.identityUsernameCache.get(name);
    }

    // Read from file
    const keyPath = this.getKeyPath(name);
    if (!fsSync.existsSync(keyPath)) {
      return undefined;
    }

    try {
      const fileContent = await fs.readFile(keyPath, 'utf-8');
      const jsonData = JSON.parse(fileContent);

      // Check if it's the new format
      if (jsonData.username) {
        const username = jsonData.username as string;
        // Update cache
        this.identityUsernameCache.set(name, username);
        return username;
      }
    } catch (error) {
      console.warn(`Failed to read username for identity '${name}': ${error}`);
    }

    return undefined;
  }

  /**
   * Get the username of the current active identity
   *
   * @returns Username of current active identity, or undefined if no active identity or username does not exist
   */
  async getActiveUsername(): Promise<string | undefined> {
    if (!this.activeIdentity) {
      return undefined;
    }
    return this.getUsername(this.activeIdentity);
  }

  /**
   * Get the displayName for a specified identity
   *
   * @param name - Identity name
   * @returns displayName (if exists), otherwise returns undefined
   */
  async getDisplayName(name: string): Promise<string | undefined> {
    // Check cache first
    if (this.identityDisplayNameCache.has(name)) {
      return this.identityDisplayNameCache.get(name);
    }

    // Read from file
    const keyPath = this.getKeyPath(name);
    if (!fsSync.existsSync(keyPath)) {
      return undefined;
    }

    try {
      const fileContent = await fs.readFile(keyPath, 'utf-8');
      const jsonData = JSON.parse(fileContent);

      // Check if it's the new format
      if (jsonData.displayName) {
        const displayName = jsonData.displayName as string;
        // Update cache
        this.identityDisplayNameCache.set(name, displayName);
        return displayName;
      }
    } catch (error) {
      console.warn(`Failed to read displayName for identity '${name}': ${error}`);
    }

    return undefined;
  }

  /**
   * Get the displayName of the current active identity
   *
   * @returns DisplayName of current active identity, or undefined if no active identity or displayName does not exist
   */
  async getActiveDisplayName(): Promise<string | undefined> {
    if (!this.activeIdentity) {
      return undefined;
    }
    return this.getDisplayName(this.activeIdentity);
  }

  /**
   * Get the key file path
   *
   * @param name - Identity name
   * @returns Full path of the key file
   */
  private getKeyPath(name: string): string {
    return path.join(this.identityDir, `${name}.json`);
  }
}
