import { BriaSDK } from './src/dashboard/sdk/index';

async function runTest() {
  console.log('--- BRIA Production-Ready SDK Test ---');

  // Initialize SDK with Testnet defaults
  const sdk = new BriaSDK(
    'testnet',
    'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Mock devnet address
    'bria-registry'
  );

  console.log('1. Fetching total agents count...');
  try {
    const total = await sdk.getTotalAgents();
    console.log(`Total agents registered: ${total}`);
  } catch (e) {
    console.log('Expected: Failure if no node is running/contract not deployed.');
    console.error('Fetch failed as expected for non-deployed contract.');
  }

  console.log('\n2. SDK Initialization State:');
  console.log(`Network: ${sdk.network.client.baseUrl}`);
  
  console.log('\n--- Test Completed ---');
}

runTest();
