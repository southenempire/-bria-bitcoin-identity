#!/usr/bin/env node
// deploy-and-seed.mjs — Run: node deploy-and-seed.mjs
import txPkg from '@stacks/transactions';
import netPkg from '@stacks/network';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';

const {
  makeContractDeploy,
  makeContractCall,
  broadcastTransaction,
  getAddressFromPrivateKey,
  stringAsciiCV,
  bufferCV,
  AnchorMode,
  PostConditionMode,
} = txPkg;

const { STACKS_TESTNET } = netPkg;
const NETWORK = { ...STACKS_TESTNET, client: { baseUrl: 'https://api.testnet.hiro.so' } };

const CLARITY_CONTRACT = readFileSync('./contracts/bria-registry.clar', 'utf8');

// Use env var or generate fresh key
const privateKey = process.env.DEPLOYER_KEY || randomBytes(32).toString('hex');
const address = getAddressFromPrivateKey(privateKey, 'testnet');


const DEMO_AGENTS = [
  {
    name: 'SatoshiBot',
    description: 'Autonomous yield optimizer for sBTC markets. Executes covered calls across Bitflow and Velar.',
    imageUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=400&q=80',
    publicKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  },
  {
    name: 'BtcOracle',
    description: 'Real-time Bitcoin price aggregator providing signed feeds to DeFi protocols on Stacks.',
    imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=400&q=80',
    publicKey: '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
  },
  {
    name: 'StacksGuard',
    description: 'Security watchdog monitoring Clarity contracts for anomalous call patterns in real time.',
    imageUrl: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=400&q=80',
    publicKey: '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
  },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function requestFaucet() {
  console.log(`\n💧 Requesting testnet STX for ${address}...`);
  const res = await fetch(`https://api.testnet.hiro.so/extended/v1/faucets/stx?address=${address}&stacking=false`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.txId) {
    console.log(`✅ Faucet TXID: ${data.txId}`);
    console.log('⏳ Waiting 30s for faucet to settle...');
    await sleep(30000);
  } else {
    console.log('ℹ️  Faucet response:', JSON.stringify(data), '— continuing...');
    await sleep(5000);
  }
}

async function deployContract() {
  console.log(`\n🚀 Deploying bria-registry...`);
  const tx = await makeContractDeploy({
    contractName: 'bria-registry',
    codeBody: CLARITY_CONTRACT,
    senderKey: privateKey,
    network: NETWORK,
    anchorMode: AnchorMode.Any,
    fee: 50000,
  });
  const result = await broadcastTransaction({ transaction: tx, network: NETWORK });
  if (result.error) { console.error('❌ Deploy failed:', result); process.exit(1); }
  console.log(`✅ Deploy TXID: ${result.txid}`);
  console.log(`🔗 https://explorer.hiro.so/txid/${result.txid}?chain=testnet`);
  console.log('⏳ Waiting 90s for confirmation...');
  await sleep(90000);
  return address;
}

async function registerAgent(contractAddress, agent, nonce) {
  console.log(`\n📝 Registering: ${agent.name}`);
  const tx = await makeContractCall({
    contractAddress,
    contractName: 'bria-registry',
    functionName: 'register-agent',
    functionArgs: [
      stringAsciiCV(agent.name),
      stringAsciiCV(agent.description),
      stringAsciiCV(agent.imageUrl),
      bufferCV(Buffer.from(agent.publicKey, 'hex')),
    ],
    senderKey: privateKey,
    network: NETWORK,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000,
    nonce,
  });
  const result = await broadcastTransaction({ transaction: tx, network: NETWORK });
  if (result.error) { console.error(`❌ Failed:`, result); return; }
  console.log(`✅ ${agent.name} TXID: ${result.txid}`);
  await sleep(20000);
}

async function main() {
  console.log(`\n📍 Deployer: ${address}`);
  console.log(`🔑 Private key: ${privateKey}`);
  console.log('\n⚠️  Save this key if you want to reuse it: DEPLOYER_KEY=' + privateKey);

  await requestFaucet();
  const contractAddress = await deployContract();

  // Seed 3 agents — use staggered nonces
  for (let i = 0; i < DEMO_AGENTS.length; i++) {
    await registerAgent(contractAddress, DEMO_AGENTS[i], i + 1);
  }

  console.log(`\n🎉 DONE! Update main.ts:`);
  console.log(`const REGISTRY_ADDRESS = '${contractAddress}';`);
  console.log(`const REGISTRY_NAME = 'bria-registry';`);
}

main().catch(e => { console.error(e); process.exit(1); });
