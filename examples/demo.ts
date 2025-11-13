import { X402MultiSig, type PaymentRequirements } from '../src/index.js';
async function main() {
  try { // Configuration section (please replace the following placeholders according to actual situation)
    const x402CanisterId = 'pvs3u-xaaaa-aaaab-acbna-cai'; // Your Canister ID (required, replace with your Canister ID, i.e., organization ID)
    const vaultId = 2n; // Vault ID (wallet ID, replace with your actual using Vault ID)
    const fromAddress: `0x${string}` = '0x54f045da3C02C3BDF5c3282C57cBdF41A0d53DF4'; // Payer address
    const payToAddress = '0x2f795904540BE35c3B66A9643F58DAC14E8fA30B'; // Payee address (payment address for the paid service)
    const apiUrl = 'http://35.93.41.95:4021/weather'; // Paid service API URL
    const paymentRequirements: PaymentRequirements = { // Payment requirements configuration
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: '1000', // 1000 (0.001 USDC with 6 decimals)
      resource: apiUrl,
      description: 'Weather API Access',
      mimeType: 'application/json',
      payTo: payToAddress,
      maxTimeoutSeconds: 3600, // 1 hour
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
      domainChainId: '0x14a34', // Base Sepolia Chain ID
      extra: {
        name: 'USDC',
        version: '2',
      },
    };
    const bot = await X402MultiSig.create({ // Call SDK to create bot client
      x402CanisterId,
      displayName: 'X402 Payment Bot',
      username: 'payment_bot',
    });
    const serviceResponse = await bot.callPaidService({ // Call SDK to paid service
      vaultId,
      fromAddress,
      paymentRequirements,
      apiUrl,
      // Optional: custom polling configuration
      // polling: {
      //   maxAttempts: 120,  // Maximum number of polling attempts (default: 120)
      //   interval: 3000,    // Polling interval in milliseconds (default: 3000)
      // }
    });
    console.log('Payment verification: Passed');
    console.log('Response data:');
    console.log(JSON.stringify(serviceResponse, null, 2));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error message: ${error.message}`);
      if (error.stack) {
        console.error('Error stack:');
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}
main().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});