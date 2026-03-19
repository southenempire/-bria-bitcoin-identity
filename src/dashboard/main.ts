// --- STACKS SDK POLYFILLS ---
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).global = window;
(window as any).process = { env: {} };

import { showConnect, showContractCall, showContractDeploy, AppConfig, UserSession } from '@stacks/connect';
import { stringAsciiCV, bufferCV } from '@stacks/transactions';
import { BriaSDK } from './sdk/index';
import { CLARITY_CONTRACT } from './contract-source';

// ─── Configuration ─────────────────────────────────────────────────────────────
// Update this after deploying the contract to testnet
const REGISTRY_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const REGISTRY_NAME = 'bria-registry';
// Demo pubkey used when user doesn't provide one (33-byte compressed secp256k1)
const DEMO_PUBKEY = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

// ─── Stacks Auth ───────────────────────────────────────────────────────────────
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

interface Agent {
    name: string;
    description: string;
    imageUrl: string;
    vouched: boolean;
    network: string;
    isLive?: boolean;
}

// ─── Rich mock/fallback agents (shown before contract is deployed) ──────────────
const MOCK_AGENTS: Agent[] = [
    {
        name: 'SatoshiBot',
        description: 'Autonomous yield optimizer for sBTC markets. Executes covered calls and rebalances liquidity across Bitflow and Velar.',
        imageUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=400&q=80',
        vouched: true, network: 'Stacks'
    },
    {
        name: 'BtcOracle',
        description: 'Real-time Bitcoin consensus data aggregator. Provides signed price feeds to 14 DeFi protocols on Stacks.',
        imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=400&q=80',
        vouched: true, network: 'Bitcoin'
    },
    {
        name: 'StacksGuard',
        description: 'Security watchdog agent that monitors Clarity contracts for anomalous call patterns and alerts protocol teams in real time.',
        imageUrl: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=400&q=80',
        vouched: true, network: 'Stacks'
    },
    {
        name: 'RemitFlow',
        description: 'Cross-border payment agent converting STX→USDCx→local fiat for NGN, KES and GHS corridors. Powered by Bitflow swaps.',
        imageUrl: 'https://images.unsplash.com/photo-1580048915913-4f8f5cb481c4?auto=format&fit=crop&w=400&q=80',
        vouched: false, network: 'Bitcoin'
    },
    {
        name: 'ClarityScan',
        description: 'Automated smart contract auditor. Detects reentrancy, integer overflow and access control issues in Clarity source code.',
        imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80',
        vouched: true, network: 'Stacks'
    },
    {
        name: 'AgentMesh',
        description: 'Service broker that matches agent-to-agent service requests and handles escrow settlements via smart contracts.',
        imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=400&q=80',
        vouched: false, network: 'Stacks'
    },
];

// ─── Logging ───────────────────────────────────────────────────────────────────
function logEvent(message: string, type: 'system' | 'network' | 'error' = 'system') {
    const logContent = document.getElementById('activityLog');
    if (logContent) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.innerHTML = `<span class="timestamp">[${time}]</span> <span class="message">${message}</span>`;
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }
    console.log(`BRIA [${type.toUpperCase()}]: ${message}`);
}

// ─── Wallet UI ────────────────────────────────────────────────────────────────
function updateWalletButton() {
    const btn = document.getElementById('connectWallet') as HTMLButtonElement | null;
    if (!btn) return;
    if (userSession.isUserSignedIn()) {
        const addr = userSession.loadUserData()?.profile?.stxAddress?.testnet || '';
        btn.innerText = addr ? `${addr.slice(0, 5)}...${addr.slice(-4)}` : 'Connected';
        btn.style.borderColor = '#ff9900';
        btn.style.color = '#ff9900';
    } else {
        btn.innerText = 'Connect Wallet';
        btn.style.borderColor = '';
        btn.style.color = '';
    }
}

function setupWalletConnect() {
    const btn = document.getElementById('connectWallet') as HTMLButtonElement | null;
    if (!btn) return;

    if (userSession.isSignInPending()) {
        userSession.handlePendingSignIn().then(updateWalletButton);
    } else {
        updateWalletButton();
    }

    btn.addEventListener('click', () => {
        if (userSession.isUserSignedIn()) {
            userSession.signUserOut();
            updateWalletButton();
            logEvent('Wallet disconnected.', 'system');
            return;
        }
        logEvent('Opening wallet connection popup...', 'system');
        showConnect({
            appDetails: { name: 'BRIA — Bitcoin Identity Registry', icon: `${window.location.origin}${window.location.pathname}favicon.ico` },
            userSession,
            onFinish: () => { updateWalletButton(); logEvent('Wallet connected successfully! ✓', 'system'); },
            onCancel: () => logEvent('Wallet connection cancelled.', 'system'),
        });
    });
}

// ─── Agent rendering ──────────────────────────────────────────────────────────
function renderAgents(agents: Agent[], agentGrid: HTMLElement, statusText: HTMLElement, isLiveData: boolean) {
    agentGrid.innerHTML = '';
    agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = `agent-card${agent.isLive ? ' live-agent' : ''}`;
        const networkLower = agent.network.toLowerCase().replace('...', 'pending');
        card.innerHTML = `
            <div class="agent-image" style="background-image:url('${agent.imageUrl}');background-size:cover;height:200px;border-radius:16px;margin-bottom:1.5rem;position:relative;">
                ${agent.isLive ? '<div class="live-badge">🟢 LIVE</div>' : ''}
            </div>
            <div class="agent-info">
                <h3>${agent.name}</h3>
                <p>${agent.description}</p>
                <div class="agent-badges">
                    ${agent.vouched ? '<span class="badge verified">✓ Verified</span>' : ''}
                    <span class="badge ${networkLower}">${agent.network}</span>
                </div>
            </div>`;
        agentGrid.appendChild(card);
    });

    if (isLiveData) {
        statusText.innerHTML = `🟢 <strong>${agents.filter(a => a.isLive).length} Live Agents</strong> on Stacks Testnet`;
        statusText.style.color = '#00ff88';
    }
}

// ─── Main dashboard ────────────────────────────────────────────────────────────
async function startDashboard() {
    const sdk = new BriaSDK('testnet', REGISTRY_ADDRESS, REGISTRY_NAME);

    const agentGrid = document.getElementById('agentGrid') as HTMLElement;
    if (!agentGrid) return;

    const statusText = document.createElement('div');
    statusText.id = 'networkStatus';
    statusText.style.cssText = 'font-size:0.9rem;color:#ff9900;margin-bottom:2rem;font-weight:bold;';
    statusText.innerText = '📡 Connecting to Stacks Testnet...';
    agentGrid.parentElement?.insertBefore(statusText, agentGrid);

    let agents: Agent[] = MOCK_AGENTS;
    renderAgents(agents, agentGrid, statusText, false);

    async function discoverAgents() {
        logEvent('Querying BRIA Registry on Stacks...', 'network');
        try {
            const total = await sdk.getTotalAgents();
            logEvent(`Registry reports ${total} registered agents.`, 'system');

            // Update stats banner
            const statEl = document.getElementById('statAgents');
            if (statEl) statEl.innerText = total > 0 ? String(total) : '0';

            if (total > 0) {
                const liveAgents: Agent[] = [];
                for (let i = 1; i <= total; i++) {
                    const profile = await sdk.getAgentById(i);
                    if (profile) {
                        logEvent(`✓ Resolved identity: ${profile.name}`, 'system');
                        liveAgents.push({ name: profile.name, description: profile.description, imageUrl: profile.imageUrl, vouched: profile.vouched, network: 'Stacks', isLive: true });
                    }
                }
                const localAgents: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                agents = [...localAgents, ...liveAgents];
                renderAgents(agents, agentGrid, statusText, true);
            } else {
                logEvent('Registry empty — showing curated demo agents.', 'system');
                statusText.innerText = '🟡 Testnet Live. Deploy contract to populate registry.';
                const localAgents: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                agents = [...localAgents, ...MOCK_AGENTS];
                renderAgents(agents, agentGrid, statusText, false);
            }
        } catch (_err) {
            logEvent('Registry query failed — showing demo agents.', 'error');
            statusText.innerText = '🔴 Registry unreachable — showing demo agents.';
            renderAgents(MOCK_AGENTS, agentGrid, statusText, false);
        }
    }

    discoverAgents().catch(() => {});

    // ─── Deploy Contract button ───────────────────────────────────────────────
    const deployBtn = document.getElementById('deployContract');
    if (deployBtn) {
        deployBtn.addEventListener('click', () => {
            if (!userSession.isUserSignedIn()) {
                logEvent('Connect your wallet first to deploy the contract.', 'error');
                return;
            }
            logEvent('Opening wallet to deploy bria-registry contract...', 'network');
            showContractDeploy({
                contractName: REGISTRY_NAME,
                codeBody: CLARITY_CONTRACT,
                network: 'testnet',
                appDetails: { name: 'BRIA — Bitcoin Identity Registry', icon: `${window.location.origin}${window.location.pathname}favicon.ico` },
                userSession,
                onFinish: (data: any) => {
                    logEvent(`Contract deployed! TXID: ${data.txId?.substring(0, 10)}... Update REGISTRY_ADDRESS in code.`, 'system');
                    (deployBtn as HTMLButtonElement).innerText = 'Contract Deployed ✓';
                    (deployBtn as HTMLButtonElement).style.background = 'linear-gradient(135deg, #00ff88 0%, #00aa66 100%)';
                },
                onCancel: () => logEvent('Contract deployment cancelled.', 'system'),
            });
        });
    }

    // ─── Registration form ─────────────────────────────────────────────────────
    const registrationForm = document.getElementById('registrationForm') as HTMLFormElement | null;
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = registrationForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalText = submitBtn.innerText;

            if (!userSession.isUserSignedIn()) {
                logEvent('Please connect your wallet first!', 'error');
                submitBtn.innerText = 'Connect Wallet First!';
                submitBtn.style.background = '#ff4444';
                setTimeout(() => { submitBtn.innerText = originalText; submitBtn.style.background = ''; }, 2500);
                return;
            }

            const name = (document.getElementById('agentName') as HTMLInputElement).value;
            const desc = (document.getElementById('agentDesc') as HTMLTextAreaElement).value;
            const pubKeyHex = ((document.getElementById('agentPubKey') as HTMLInputElement).value || DEMO_PUBKEY).replace('0x', '');
            const imageUrl = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80';

            submitBtn.innerText = 'Waiting for wallet...';
            submitBtn.disabled = true;
            logEvent(`Registering "${name}" on-chain...`, 'network');

            const pubKeyBytes = Buffer.from(pubKeyHex, 'hex');

            showContractCall({
                contractAddress: REGISTRY_ADDRESS,
                contractName: REGISTRY_NAME,
                functionName: 'register-agent',
                functionArgs: [stringAsciiCV(name), stringAsciiCV(desc), stringAsciiCV(imageUrl), bufferCV(pubKeyBytes)],
                network: 'testnet',
                appDetails: { name: 'BRIA — Bitcoin Identity Registry', icon: `${window.location.origin}${window.location.pathname}favicon.ico` },
                userSession,
                onFinish: (data: { txId: string }) => {
                    logEvent(`✓ Registered! TXID: ${data.txId.substring(0, 10)}...`, 'system');
                    const pending: Agent = { name, description: desc, imageUrl, vouched: false, network: 'Pending...' };
                    const local: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                    local.unshift(pending);
                    localStorage.setItem('bria_pending_agents', JSON.stringify(local));
                    submitBtn.innerText = 'Registered! ✓';
                    submitBtn.style.background = 'linear-gradient(135deg, #00ff88 0%, #00aa66 100%)';
                    submitBtn.disabled = false;
                    setTimeout(async () => { registrationForm.reset(); submitBtn.innerText = originalText; submitBtn.style.background = ''; await discoverAgents(); document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' }); }, 3000);
                },
                onCancel: () => { logEvent('Transaction cancelled.', 'system'); submitBtn.innerText = originalText; submitBtn.style.background = ''; submitBtn.disabled = false; },
            });
        });
    }

    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (this: HTMLAnchorElement, e: Event) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href) document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
function init() {
    setupWalletConnect();
    startDashboard().catch(console.error);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
