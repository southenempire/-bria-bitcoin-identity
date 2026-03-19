# BRIA — Bitcoin Agent Identity Registry

> **The on-chain identity layer for autonomous Bitcoin AI agents.**  
> Built with [Clarity](https://docs.stacks.co/clarity) on [Stacks](https://www.stacks.co/) · Bitcoin-anchored · Censorship-resistant

[![Live Demo](https://img.shields.io/badge/Live%20Demo-southenempire.github.io-orange?style=flat-square)](https://southenempire.github.io/-bria-bitcoin-identity/)
[![Contract](https://img.shields.io/badge/Stacks%20Testnet-Deployed-green?style=flat-square)](https://explorer.hiro.so/address/ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB?chain=testnet)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

---

## Overview

AI agents are multiplying fast — but every framework today routes identity through human-controlled API keys. Those keys are revocable, impersonatable, and siloed to a single platform. As agents go autonomous, that architecture collapses.

**BRIA** solves this: an open, trustless registry where any autonomous agent can establish a permanent, Bitcoin-anchored identity. One registration. Discoverable by any protocol, contract, or peer — forever.

```
Agent registers once → identity lives on Bitcoin (via Stacks) → anyone resolves it
```

---

## Features

- 🔐 **On-chain identity** — Agent name, description, and secp256k1 Bitcoin public key stored permanently in a Clarity smart contract
- 🔍 **Open discovery** — `get-agent` and `get-agent-by-id` are public read-only functions — zero permission required
- 🤝 **Web of Trust** — Agents vouch for each other via `vouch-agent`, building portable reputation
- 🪙 **Bitcoin-anchored** — Deployed on Stacks L2; identity is secured by Bitcoin's consensus
- 🌐 **Wallet-native** — Connects with Xverse, Hiro/Leather, and any Stacks-compatible wallet via the official `@stacks/connect` v8 API
- 📡 **Live registry** — Real-time agent discovery with auto-updating dashboard

---

## Architecture

```
┌────────────────────────────────────────────────┐
│              BRIA Dashboard (Vite + TS)        │
│  ┌──────────────┐  ┌──────────────────────┐   │
│  │ @stacks/     │  │  BriaSDK (TypeScript) │   │
│  │ connect v8   │  │  - getTotalAgents()   │   │
│  │ connect()    │  │  - getAgentById()     │   │
│  │ request()    │  │  - resolve(address)   │   │
│  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼────────────────────┼───────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────────────────────────────────┐
│          Stacks Testnet / Mainnet               │
│                                                 │
│  Contract: ST2H22...VYFBB.bria-registry         │
│  ┌─────────────────────────────────────────┐   │
│  │  register-agent (name, desc, img, key)  │   │
│  │  get-agent (address)                    │   │
│  │  get-agent-by-id (uint)                 │   │
│  │  vouch-agent (target)                   │   │
│  │  get-total-agents ()                    │   │
│  └─────────────────────────────────────────┘   │
│                        │                        │
│                        ▼                        │
│              Bitcoin (PoX settlement)           │
└─────────────────────────────────────────────────┘
```

---

## Smart Contract

**Contract address (Stacks Testnet):**
```
ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB.bria-registry
```

[View on Hiro Explorer →](https://explorer.hiro.so/address/ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB?chain=testnet)

### Public functions

| Function | Args | Description |
|---|---|---|
| `register-agent` | `name` `description` `image-url` `btc-pub-key` | Register a new agent identity |
| `vouch-agent` | `target` (principal) | Vouch for another agent's reputation |
| `get-agent` | `address` (principal) | Read-only: resolve agent by wallet address |
| `get-agent-by-id` | `id` (uint) | Read-only: resolve agent by numeric ID |
| `get-total-agents` | — | Read-only: total registered agents |

### Example Clarity call

```clarity
;; Read an agent's identity (no permission needed)
(contract-call? 'ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB.bria-registry
  get-agent 'SP2ABC...XYZ)
;; => (some { name: "SatoshiBot", description: "...", vouched: true, btc-pub-key: 0x027... })
```

---

## SDK

The `BriaSDK` TypeScript class wraps all read-only contract calls:

```typescript
import { BriaSDK } from './src/sdk';

const registry = new BriaSDK(
  'testnet',
  'ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB',
  'bria-registry'
);

// Get total registered agents
const total = await registry.getTotalAgents();

// Resolve agent by sequential ID
const agent = await registry.getAgentById(1);
// => { name: 'SatoshiBot', description: '...', vouched: true, ... }

// Resolve agent by Stacks address
const profile = await registry.resolve('ST3K9...');
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | [Clarity](https://docs.stacks.co/clarity) on Stacks |
| Frontend | Vite + TypeScript (vanilla) |
| Wallet | [@stacks/connect](https://github.com/hirosystems/stacks.js/tree/main/packages/connect) v8 |
| Contract SDK | [@stacks/transactions](https://github.com/hirosystems/stacks.js) |
| Network | Stacks Testnet → Bitcoin PoX |
| Hosting | GitHub Pages |
| Fonts | IBM Plex Mono / IBM Plex Sans |

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Xverse](https://www.xverse.app/) or [Hiro/Leather](https://leather.io/) wallet browser extension
- Testnet STX from [Hiro Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)

### Install & run locally

```bash
git clone https://github.com/southenempire/-bria-bitcoin-identity.git
cd -bria-bitcoin-identity
npm install
npm run dev
# → http://localhost:3000/-bria-bitcoin-identity/
```

### Build for production

```bash
npm run build
npm run deploy   # deploys to GitHub Pages via gh-pages
```

---

## Deploying the Contract

### Option A — Via the dashboard

1. Open the live site or `localhost:3000`
2. Connect your wallet (Xverse recommended)
3. Get testnet STX from the [Hiro Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)
4. Navigate to **Deploy** section and click `🚀 Deploy bria-registry`
5. Sign the transaction in your wallet

### Option B — Programmatic (Node.js)

```bash
node deploy-and-seed.mjs
```

This script:
1. Generates a fresh testnet keypair
2. Requests STX from the Hiro faucet automatically
3. Deploys `contracts/bria-registry.clar`
4. Seeds 3 demo agents via `register-agent` calls

---

## Registering an Agent

### Via the dashboard UI

1. Connect your wallet
2. Fill in **Agent Name**, **Description**, and optionally your Bitcoin public key
3. Click **Submit to Registry →**
4. Sign the transaction — your agent is live on-chain

### Via code

```typescript
import { request } from '@stacks/connect';
import { stringAsciiCV, bufferCV, serializeCV } from '@stacks/transactions';

const serHex = (cv: any) => Buffer.from(serializeCV(cv)).toString('hex');

await request('stx_callContract', {
  contract: 'ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB.bria-registry',
  functionName: 'register-agent',
  functionArgs: [
    serHex(stringAsciiCV('MyAgent')),
    serHex(stringAsciiCV('What my agent does')),
    serHex(stringAsciiCV('https://example.com/avatar.png')),
    serHex(bufferCV(Buffer.from('0279be667ef9...', 'hex'))),  // 33-byte compressed pubkey
  ],
  network: 'testnet',
});
```

---

## Project Structure

```
bria/
├── contracts/
│   └── bria-registry.clar      # Clarity smart contract
├── src/
│   └── dashboard/
│       ├── index.html           # App shell
│       ├── main.ts              # App logic, wallet connect, registry UI
│       ├── style.css            # Design system (dark, IBM Plex Mono)
│       ├── contract-source.ts   # Inlined contract for browser deploy
│       └── sdk/
│           └── index.ts         # BriaSDK — read-only contract queries
├── deploy-and-seed.mjs          # Node.js deploy + seed script
├── vite.config.ts
└── tsconfig.json
```

---

## Wallet Support

| Wallet | Status |
|---|---|
| Xverse | ✅ Fully supported |
| Hiro / Leather | ✅ Fully supported |
| Asigna Multisig | ✅ Detected |
| Fordefi | ✅ Detected |

Uses the official `@stacks/connect` v8 API: `connect()` / `request()` / `isConnected()`.

---

## Roadmap

- [ ] **Mainnet deployment** — migrate registry to Stacks mainnet
- [ ] **Agent search** — fuzzy search by name, capability tags
- [ ] **sBTC reputation staking** — agents stake sBTC to signal credibility
- [ ] **Service discovery API** — REST + WebSocket wrapper around read-only calls
- [ ] **Multi-sig agent identities** — Asigna multisig support for DAO-controlled agents
- [ ] **Composable trust** — `vouch-weight` by stake amount, not just boolean

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

```bash
git checkout -b feature/my-feature
# make changes
git commit -m "feat: describe your change"
git push origin feature/my-feature
# open a PR
```

---

## License

[MIT](LICENSE) — built for the Stacks Buidl Battle #2

---

<p align="center">
  Built on <a href="https://www.stacks.co">Stacks</a> · Secured by Bitcoin · Open source
</p>
