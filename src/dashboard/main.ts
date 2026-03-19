// --- STACKS SDK POLYFILLS ---
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).global = window;
(window as any).process = { env: {} };

import { showConnect, showContractCall, showContractDeploy, AppConfig, UserSession } from '@stacks/connect';
import { stringAsciiCV, bufferCV } from '@stacks/transactions';
import { BriaSDK } from './sdk/index';
import { CLARITY_CONTRACT } from './contract-source';

// ─── Config ──────────────────────────────────────────────────────────────────
const REGISTRY_ADDRESS = 'ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB';
const REGISTRY_NAME = 'bria-registry';
const DEMO_PUBKEY = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

// ─── Auth ─────────────────────────────────────────────────────────────────────
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

interface Agent {
    name: string;
    description: string;
    vouched: boolean;
    network: string;
    isLive?: boolean;
}

// ─── Mock agents shown before contract is live ────────────────────────────────
const MOCK_AGENTS: Agent[] = [
    { name: 'SatoshiBot', description: 'Autonomous yield optimizer for sBTC markets. Executes covered calls and rebalances liquidity across Bitflow and Velar.', vouched: true, network: 'Stacks' },
    { name: 'BtcOracle', description: 'Real-time Bitcoin consensus data aggregator. Provides signed price feeds to 14 DeFi protocols on Stacks.', vouched: true, network: 'Bitcoin' },
    { name: 'StacksGuard', description: 'Security watchdog agent monitoring Clarity contracts for anomalous call patterns and alerting protocol teams in real time.', vouched: true, network: 'Stacks' },
    { name: 'RemitFlow', description: 'Cross-border payment agent converting STX→USDCx→local fiat for NGN, KES and GHS corridors via Bitflow swaps.', vouched: false, network: 'Bitcoin' },
    { name: 'ClarityScan', description: 'Automated smart contract auditor detecting reentrancy, integer overflow and access control issues in Clarity source code.', vouched: true, network: 'Stacks' },
    { name: 'AgentMesh', description: 'Service broker matching agent-to-agent service requests and handling escrow settlements via smart contracts.', vouched: false, network: 'Stacks' },
];

// ─── Log ─────────────────────────────────────────────────────────────────────
function logEvent(message: string, type: 'system' | 'network' | 'error' = 'system') {
    const logBox = document.getElementById('activityLog');
    if (logBox) {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        line.innerHTML = `<span class="timestamp">[${time}]</span> <span>${message}</span>`;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
    }
    console.log(`BRIA [${type.toUpperCase()}]: ${message}`);
}

// ─── Agent rendering ──────────────────────────────────────────────────────────
function renderAgents(agents: Agent[], agentGrid: HTMLElement, statusText: HTMLElement, isLiveData: boolean) {
    agentGrid.innerHTML = '';
    agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = `agent-card${agent.isLive ? ' live-agent' : ''}`;
        const networkLower = agent.network.toLowerCase().replace('...', 'pending');
        card.innerHTML = `
            ${agent.isLive ? '<div class="live-indicator"><span class="live-dot"></span>LIVE · TESTNET</div>' : ''}
            <div class="agent-name">${agent.name}</div>
            <div class="agent-desc">${agent.description}</div>
            <div class="agent-tags">
                ${agent.vouched ? '<span class="tag verified">✓ Verified</span>' : ''}
                <span class="tag ${networkLower}">${agent.network}</span>
            </div>`;
        agentGrid.appendChild(card);
    });
    if (isLiveData) {
        statusText.innerHTML = `<span style="color:var(--green)">●</span> ${agents.filter(a => a.isLive).length} live agents on Stacks Testnet`;
    }
}

// ─── Wallet ──────────────────────────────────────────────────────────────────
function setupWalletConnect() {
    const btn = document.getElementById('connectWallet') as HTMLButtonElement | null;
    if (!btn) return;

    const storedAddr = localStorage.getItem('bria_stx_address');
    if (storedAddr) {
        btn.innerText = `${storedAddr.slice(0, 5)}...${storedAddr.slice(-4)}`;
        btn.style.background = 'var(--orange-dim)';
    }

    btn.addEventListener('click', async () => {
        if (localStorage.getItem('bria_stx_address')) {
            localStorage.removeItem('bria_stx_address');
            btn.innerText = 'Connect Wallet';
            btn.style.background = '';
            logEvent('Wallet disconnected.', 'system');
            return;
        }

        btn.innerText = 'Connecting...';
        btn.disabled = true;
        logEvent('Detecting wallet...', 'system');

        // Poll for provider — Xverse injects async
        let provider: any = null;
        for (let i = 0; i < 15; i++) {
            provider = (window as any).XverseProviders?.StacksProvider
                    || (window as any).StacksProvider
                    || (window as any).LeatherProvider;
            if (provider) break;
            await new Promise(r => setTimeout(r, 200));
        }

        if (!provider) {
            logEvent('No wallet detected — open Xverse to install.', 'error');
            window.open('https://www.xverse.app/download', '_blank');
            btn.innerText = 'Install Xverse →';
            setTimeout(() => { btn.innerText = 'Connect Wallet'; btn.style.background = ''; btn.disabled = false; }, 3000);
            return;
        }

        logEvent('Wallet found — requesting access...', 'system');

        try {
            showConnect({
                appDetails: { name: 'BRIA — Bitcoin Identity Registry', icon: `${window.location.origin}/favicon.ico` },
                userSession,
                onFinish: () => {
                    const addr = userSession.loadUserData()?.profile?.stxAddress?.testnet
                              || userSession.loadUserData()?.profile?.stxAddress?.mainnet || '';
                    if (addr) {
                        localStorage.setItem('bria_stx_address', addr);
                        btn.innerText = `${addr.slice(0, 5)}...${addr.slice(-4)}`;
                        btn.style.background = 'var(--orange-dim)';
                        logEvent(`✓ Connected: ${addr.slice(0, 10)}...`, 'system');
                    }
                    btn.disabled = false;
                },
                onCancel: () => {
                    logEvent('Connection cancelled.', 'system');
                    btn.innerText = 'Connect Wallet';
                    btn.style.background = '';
                    btn.disabled = false;
                },
            });
        } catch (err: any) {
            logEvent(`Wallet error: ${err.message || 'Unknown'}`, 'error');
            btn.innerText = 'Connect Wallet';
            btn.style.background = '';
            btn.disabled = false;
        }
    });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function startDashboard() {
    const sdk = new BriaSDK('testnet', REGISTRY_ADDRESS, REGISTRY_NAME);

    const agentGrid = document.getElementById('agentGrid') as HTMLElement;
    if (!agentGrid) return;

    const statusText = document.createElement('div');
    statusText.id = 'networkStatus';
    statusText.style.cssText = 'font-family:var(--mono);font-size:0.78rem;color:var(--text-muted);margin-bottom:1.5rem;';
    statusText.innerText = '○ Connecting to Stacks Testnet...';
    agentGrid.parentElement?.insertBefore(statusText, agentGrid);

    renderAgents(MOCK_AGENTS, agentGrid, statusText, false);

    async function discoverAgents() {
        logEvent('Querying bria-registry on Stacks Testnet...', 'network');
        try {
            const total = await sdk.getTotalAgents();
            logEvent(`Registry: ${total} agents registered.`, 'system');

            const statEl = document.getElementById('statAgents');
            if (statEl) statEl.innerText = String(total);

            if (total > 0) {
                const liveAgents: Agent[] = [];
                for (let i = 1; i <= total; i++) {
                    const profile = await sdk.getAgentById(i);
                    if (profile) {
                        logEvent(`✓ Resolved: ${profile.name}`, 'system');
                        liveAgents.push({ name: profile.name, description: profile.description, vouched: profile.vouched, network: 'Stacks', isLive: true });
                    }
                }
                const localAgents: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                renderAgents([...localAgents, ...liveAgents], agentGrid, statusText, true);
            } else {
                logEvent('Registry empty — showing demo agents.', 'system');
                statusText.innerHTML = '○ Testnet live · deploy contract to populate registry';
                const local: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                renderAgents([...local, ...MOCK_AGENTS], agentGrid, statusText, false);
            }
        } catch {
            logEvent('Registry unreachable — showing demo agents.', 'error');
            statusText.innerText = '✗ Registry unreachable · showing demo data';
            renderAgents(MOCK_AGENTS, agentGrid, statusText, false);
        }
    }

    discoverAgents().catch(() => {});

    // ─── Deploy button ────────────────────────────────────────────────────────
    const deployBtn = document.getElementById('deployContract');
    if (deployBtn) {
        deployBtn.addEventListener('click', () => {
            if (!userSession.isUserSignedIn() && !localStorage.getItem('bria_stx_address')) {
                logEvent('Connect wallet first to deploy.', 'error');
                return;
            }
            logEvent('Opening wallet to deploy bria-registry...', 'network');
            showContractDeploy({
                contractName: REGISTRY_NAME,
                codeBody: CLARITY_CONTRACT,
                network: 'testnet',
                appDetails: { name: 'BRIA — Bitcoin Identity Registry', icon: `${window.location.origin}/favicon.ico` },
                userSession,
                onFinish: (data: any) => {
                    logEvent(`✓ Deployed! TXID: ${data.txId?.slice(0, 12)}...`, 'system');
                    (deployBtn as HTMLButtonElement).innerText = 'Deployed ✓';
                },
                onCancel: () => logEvent('Deploy cancelled.', 'system'),
            });
        });
    }

    // ─── Registration form ────────────────────────────────────────────────────
    const form = document.getElementById('registrationForm') as HTMLFormElement | null;
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
            const orig = submitBtn.innerText;

            if (!userSession.isUserSignedIn() && !localStorage.getItem('bria_stx_address')) {
                logEvent('Connect your wallet first.', 'error');
                submitBtn.innerText = 'Connect wallet first';
                setTimeout(() => { submitBtn.innerText = orig; }, 2500);
                return;
            }

            const name = (document.getElementById('agentName') as HTMLInputElement).value;
            const desc = (document.getElementById('agentDesc') as HTMLTextAreaElement).value;
            const pubKeyHex = ((document.getElementById('agentPubKey') as HTMLInputElement).value || DEMO_PUBKEY).replace('0x', '');
            const imageUrl = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80';

            submitBtn.innerText = 'Waiting for wallet...';
            submitBtn.disabled = true;
            logEvent(`Registering "${name}" on-chain...`, 'network');

            showContractCall({
                contractAddress: REGISTRY_ADDRESS,
                contractName: REGISTRY_NAME,
                functionName: 'register-agent',
                functionArgs: [stringAsciiCV(name), stringAsciiCV(desc), stringAsciiCV(imageUrl), bufferCV(Buffer.from(pubKeyHex, 'hex'))],
                network: 'testnet',
                appDetails: { name: 'BRIA — Bitcoin Identity Registry', icon: `${window.location.origin}/favicon.ico` },
                userSession,
                onFinish: (data: { txId: string }) => {
                    logEvent(`✓ Registered! TXID: ${data.txId.slice(0, 12)}...`, 'system');
                    const pending: Agent = { name, description: desc, vouched: false, network: 'Pending...' };
                    const local: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                    local.unshift(pending);
                    localStorage.setItem('bria_pending_agents', JSON.stringify(local));
                    submitBtn.innerText = 'Registered ✓';
                    setTimeout(() => { form.reset(); submitBtn.innerText = orig; submitBtn.disabled = false; discoverAgents(); }, 3000);
                },
                onCancel: () => { logEvent('Transaction cancelled.', 'system'); submitBtn.innerText = orig; submitBtn.disabled = false; },
            });
        });
    }

    // Smooth scroll
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
