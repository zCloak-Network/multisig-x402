# multisig-x402

X402 Multi-Signature Wallet SDK for AI Agents. Provides simple APIs for calling paid services and managing multi-signature wallet signatures.

## Installation

```bash
npm install multisig-x402
```

## Run Demo

Please note that the demo has already uploaded the bot's private key and added the bot to the multisignature wallet.

You need to configure your own multisignature wallet and add the bot's PrincipalId to the wallet operator before it can run.

Please do not share your private key with others in production projects.

```bash
npm install

npm run demo
```

## Quick Start

```typescript
import { X402MultiSig } from 'multisig-x402';

// Initialize SDK
const bot = await X402MultiSig.create({
  x402CanisterId: 'unn7l-aqaaa-aaaau-ab7ka-cai'
});

// Get Principal ID
const principalId = bot.getPrincipalId();
console.log('Bot Principal:', principalId);
```

## Calling Paid Services

Complete example: Create signature request → Poll and wait → Call service

```typescript
import { X402MultiSig } from 'multisig-x402';

const bot = await X402MultiSig.create({
  x402CanisterId: 'unn7l-aqaaa-aaaau-ab7ka-cai',
  displayName: 'My Bot',
  username: 'my_bot'
});

// Configure payment requirements
const paymentRequirements = {
  scheme: 'exact',
  network: 'base-sepolia',
  maxAmountRequired: '1000', // 0.001 USDC (6 decimals)
  resource: 'https://api.example.com/weather',
  description: 'Weather API Access',
  mimeType: 'application/json',
  payTo: '0x2f795904540BE35c3B66A9643F58DAC14E8fA30B',
  maxTimeoutSeconds: 3600,
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  domainChainId: '0x14a34',
  extra: {
    name: 'USDC',
    version: '2',
  },
};

// Call paid service (automatically handles signature flow)
const response = await bot.callPaidService({
  vaultId: 1n,
  fromAddress: '0x92e07732b23258Ac4c8b5856a11e1D0F5D72749d',
  paymentRequirements,
  apiUrl: 'https://api.example.com/weather',
});

console.log('Service response:', response);
```

## Manual Signature Request Creation

For more granular control, you can manually create and query signature requests:

```typescript
// Create signature request
const requestId = await bot.createSignRequest({
  vaultId: 1n,
  to: '0x2f795904540BE35c3B66A9643F58DAC14E8fA30B',
  value: '0x3e8', // 1000
  validAfter: '0x0',
  validBefore: '0x67890abc',
  nonce: '0x1234567890abcdef',
  verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  domainChainId: '0x14a34',
  domainName: 'USDC',
  domainVersion: '2'
});

console.log('Request ID:', requestId);

// Query signature status
const result = await bot.getSignature(requestId);
console.log('Status:', result.status);

if (result.status === 'Executed') {
  console.log('Signature:', result.signature);
}
```

## Simplified API

Use network and token symbols to automatically populate parameters:

```typescript
const requestId = await bot.createSignRequestSimple({
  vaultId: 1n,
  to: '0x2f795904540BE35c3B66A9643F58DAC14E8fA30B',
  value: '0x3e8',
  validAfter: '0x0',
  validBefore: '0x67890abc',
  nonce: '0x1234567890abcdef',
  network: 'base-sepolia',  // Just specify the network
  token: 'USDC',             // Just specify the token
});
```

## Configuration Options

```typescript
interface X402MultiSigOptions {
  x402CanisterId: string;              // Required: X402 Canister ID
  registerCanisterId?: string;         // Optional: Register Canister ID
  identityName?: string;               // Optional: Identity name (default 'default')
  identityDir?: string;                // Optional: Identity storage directory
  network?: 'mainnet' | 'local';       // Optional: Network type (default 'mainnet')
  host?: string;                       // Optional: Custom IC host
  displayName?: string;                // Optional: Display name
  username?: string;                   // Optional: Username
}
```

## Utility Functions

The SDK provides some useful utilities:

```typescript
import {
  padHex,
  normalizeUint256,
  generateNonce,
  getEIP712DomainParams,
  SUPPORTED_NETWORKS
} from 'multisig-x402';

// Generate random nonce
const nonce = generateNonce();

// Normalize hex string (pad to 64 bits)
const normalized = normalizeUint256('0x3e8');
// Result: '0x00000000000000000000000000000000000000000000000000000000000003e8'

// Get EIP-712 domain parameters
const domain = getEIP712DomainParams('base-sepolia', 'USDC', '2');
```

## Identity Management

The SDK automatically handles identity management:
- Automatically creates new identity on first use
- Identity is saved in `.multisig-x402/identities/` directory
- Automatically loads existing identity on subsequent use
- New identities are automatically registered to Register Canister

## Advanced Usage

Get underlying clients for advanced operations:

```typescript
// Get X402 Canister client
const x402Client = bot.getX402Client();
const record = await x402Client.getRequest(requestId);

// Get IC Agent client
const agentClient = bot.getAgentClient();
const principal = agentClient.getPrincipal();

// Get current identity
const identity = bot.getIdentity();
```

## Important Notes

1. **Private Key Security**: Identity files are stored locally with file permissions set to `0600` (owner read/write only)
2. **Network Restrictions**: Multi-signature wallet only supports Base, Base Sepolia, and Solana
3. **Token Restrictions**: Each network only supports specified token contracts
4. **Polling Configuration**: `callPaidService` polls 120 times by default with 3-second intervals (configurable)

## TypeScript Support

The SDK is written in TypeScript with full type definitions:

```typescript
import type {
  X402MultiSigOptions,
  SignRequestParams,
  SimpleSignRequestParams,
  SignatureResult,
  PaymentRequirements,
  SupportedNetwork,
  SupportedToken
} from 'multisig-x402';
```

## License

MIT

## Related Links

- [GitHub](https://github.com/zCloak-Network/multisig-x402)
- [Homepage](https://zcloak.money)
- [Issues](https://github.com/zCloak-Network/multisig-x402/issues)

## Contact & Community

- [Twitter/X](https://x.com/zCloakNetwork)
- [GitHub Organization](https://github.com/zCloak-Network)
