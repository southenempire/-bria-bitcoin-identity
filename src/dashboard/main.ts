// --- POLYFILLS ---
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).global = window;
(window as any).process = { env: {} };

// ─── Official @stacks/connect v8 API (per docs.stacks.co/stacks-connect/connect-wallet) ───
import { connect, disconnect, isConnected, getLocalStorage, request } from '@stacks/connect';
import { BriaSDK } from './sdk/index';
import { CLARITY_CONTRACT } from './contract-source';

// ─── Config ──────────────────────────────────────────────────────────────────
const REGISTRY_ADDRESS = 'ST2H22XKBY041E5SX124HC7NJK2P09W1JPX6VYFBB';
const REGISTRY_NAME = 'bria-registry';
const DEMO_PUBKEY = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

interface Agent { name: string; description: string; vouched: boolean; network: string; isLive?: boolean; }

// ─── Mock agents ──────────────────────────────────────────────────────────────
const MOCK_AGENTS: Agent[] = [
    { name: 'SatoshiBot', description: 'Autonomous yield optimizer for sBTC markets. Executes covered calls and rebalances liquidity across Bitflow and Velar.', vouched: true, network: 'Stacks' },
    { name: 'BtcOracle', description: 'Real-time Bitcoin price aggregator providing signed feeds to 14 DeFi protocols on Stacks.', vouched: true, network: 'Bitcoin' },
    { name: 'StacksGuard', description: 'Security watchdog monitoring Clarity contracts for anomalous call patterns in real time.', vouched: true, network: 'Stacks' },
    { name: 'RemitFlow', description: 'Cross-border payment agent converting STX→USDCx→local fiat for NGN, KES and GHS corridors.', vouched: false, network: 'Bitcoin' },
    { name: 'ClarityScan', description: 'Automated smart contract auditor detecting reentrancy and access control issues in Clarity.', vouched: true, network: 'Stacks' },
    { name: 'AgentMesh', description: 'Service broker matching agent-to-agent requests and handling escrow settlements on-chain.', vouched: false, network: 'Stacks' },
];

// ─── Cursor spotlight ─────────────────────────────────────────────────────────
function setupCursorSpotlight() {
    const spotlight = document.createElement('div');
    spotlight.id = 'cursor-spotlight';
    spotlight.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        pointer-events:none;z-index:999;
        background:radial-gradient(600px circle at var(--cx,-200px) var(--cy,-200px),
            rgba(255,153,0,0.06) 0%, rgba(255,153,0,0.02) 40%, transparent 70%);
        transition:background 0.1s ease;
    `;
    document.body.appendChild(spotlight);

    const update = (x: number, y: number) => {
        document.documentElement.style.setProperty('--cx', x + 'px');
        document.documentElement.style.setProperty('--cy', y + 'px');
    };

    document.addEventListener('mousemove', e => update(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => {
        const t = e.touches[0];
        update(t.clientX, t.clientY);
    }, { passive: true });
}

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

// ─── Live demo activity feed (runs even without wallet) ───────────────────────
const DEMO_EVENTS = [
    { msg: 'Agent "NeuralTrader" queried registry for peers', type: 'network' },
    { msg: 'sBTC yield position rebalanced by SatoshiBot', type: 'system' },
    { msg: 'BtcOracle signed price feed — BTC/USD: $67,420', type: 'network' },
    { msg: 'New agent registration pending confirmation…', type: 'system' },
    { msg: 'StacksGuard flagged anomalous call on testnet contract', type: 'error' },
    { msg: 'RemitFlow completed NGN corridor transfer — 0.12 sBTC', type: 'system' },
    { msg: 'ClarityScan audited 3 new contracts — 0 critical issues', type: 'system' },
    { msg: 'AgentMesh brokered service agreement: job #4819', type: 'network' },
    { msg: 'Reputation vouch: SatoshiBot → BtcOracle', type: 'system' },
    { msg: 'Registry queried by external agent at ST3K9…', type: 'network' },
];

function startDemoActivityFeed() {
    let idx = 0;
    const tick = () => {
        const ev = DEMO_EVENTS[idx % DEMO_EVENTS.length];
        logEvent(ev.msg, ev.type as any);
        idx++;
        setTimeout(tick, 3000 + Math.random() * 4000);
    };
    setTimeout(tick, 2000);
}

// ─── Agent rendering ──────────────────────────────────────────────────────────
function renderAgents(agents: Agent[], agentGrid: HTMLElement) {
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
}

// ─── Wallet helpers ───────────────────────────────────────────────────────────
function getStxAddress(): string | null {
    const data = getLocalStorage();
    return data?.addresses?.stx?.[0]?.address ?? null;
}

function updateWalletBtn(btn: HTMLButtonElement) {
    if (isConnected()) {
        const addr = getStxAddress();
        btn.innerText = addr ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : 'Connected';
        btn.style.borderColor = 'var(--orange)';
        btn.style.color = 'var(--orange)';
        btn.style.background = 'var(--orange-dim)';
    } else {
        btn.innerText = 'Connect Wallet';
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.style.background = '';
    }
    btn.disabled = false;
}

// ─── Wallet connect (correct v8 API from official Stacks docs) ────────────────
function setupWalletConnect() {
    const btn = document.getElementById('connectWallet') as HTMLButtonElement | null;
    if (!btn) return;

    // Restore state on page load
    updateWalletBtn(btn);

    btn.addEventListener('click', async () => {
        if (isConnected()) {
            disconnect();
            updateWalletBtn(btn);
            logEvent('Wallet disconnected.', 'system');
            return;
        }

        btn.innerText = 'Connecting…';
        btn.disabled = true;
        logEvent('Connecting wallet via Stacks Connect…', 'system');

        try {
            const result = await connect();
            updateWalletBtn(btn);
            const addr = (result?.addresses as any)?.stx?.[0]?.address;
            logEvent(`✓ Connected: ${addr ? addr.slice(0, 10) + '…' : 'wallet'}`, 'system');
        } catch (err: any) {
            logEvent(`Wallet error: ${err?.message ?? 'cancelled'}`, 'error');
            updateWalletBtn(btn);
        }
    });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function startDashboard() {
    const sdk = new BriaSDK('testnet', REGISTRY_ADDRESS, REGISTRY_NAME);
    const agentGrid = document.getElementById('agentGrid') as HTMLElement;
    if (!agentGrid) return;

    // Status line above registry
    const statusText = document.createElement('div');
    statusText.id = 'networkStatus';
    statusText.innerText = '○ Connecting to Stacks Testnet…';
    agentGrid.parentElement?.insertBefore(statusText, agentGrid);

    renderAgents(MOCK_AGENTS, agentGrid);

    // ─── Discover live agents ─────────────────────────────────────────────────
    async function discoverAgents() {
        logEvent('Querying bria-registry on Stacks Testnet…', 'network');
        try {
            const total = await sdk.getTotalAgents();
            const statEl = document.getElementById('statAgents');
            if (statEl) statEl.innerText = String(total);
            logEvent(`Registry: ${total} agents registered.`, 'system');

            if (total > 0) {
                const liveAgents: Agent[] = [];
                for (let i = 1; i <= Math.min(total, 20); i++) {
                    const p = await sdk.getAgentById(i);
                    if (p) liveAgents.push({ name: p.name, description: p.description, vouched: p.vouched, network: 'Stacks', isLive: true });
                }
                const local: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                renderAgents([...local, ...liveAgents], agentGrid);
                statusText.innerHTML = `<span style="color:var(--green)">●</span> ${liveAgents.length} live agents on Stacks Testnet`;
            } else {
                statusText.innerText = '○ Testnet live · deploy contract to populate registry';
                renderAgents(MOCK_AGENTS, agentGrid);
            }
        } catch {
            statusText.innerText = '✗ Registry unreachable · showing demo data';
            renderAgents(MOCK_AGENTS, agentGrid);
        }
    }
    discoverAgents().catch(() => {});

    // ─── Deploy button ────────────────────────────────────────────────────────
    document.getElementById('deployContract')?.addEventListener('click', async () => {
        if (!isConnected()) { logEvent('Connect wallet first to deploy.', 'error'); return; }
        logEvent('Opening wallet to deploy bria-registry…', 'network');
        try {
            const res = await (request as any)('stx_deployContract', {
                name: REGISTRY_NAME,
                clarityCode: CLARITY_CONTRACT,
                network: 'testnet',
            });
            logEvent(`✓ Deployed! TXID: ${String(res?.txid ?? '').slice(0, 12)}…`, 'system');
        } catch (err: any) {
            logEvent(`Deploy failed: ${err?.message ?? 'cancelled'}`, 'error');
        }
    });

    // ─── Registration form ────────────────────────────────────────────────────
    const form = document.getElementById('registrationForm') as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        const orig = submitBtn.innerText;

        if (!isConnected()) {
            logEvent('Connect your wallet first.', 'error');
            submitBtn.innerText = 'Connect wallet first →';
            setTimeout(() => { submitBtn.innerText = orig; }, 2500);
            return;
        }

        const name = (document.getElementById('agentName') as HTMLInputElement).value;
        const desc = (document.getElementById('agentDesc') as HTMLTextAreaElement).value;
        const pubKeyHex = ((document.getElementById('agentPubKey') as HTMLInputElement).value.trim() || DEMO_PUBKEY).replace('0x', '');

        submitBtn.innerText = 'Waiting for wallet…';
        submitBtn.disabled = true;
        logEvent(`Registering "${name}" on-chain…`, 'network');

        try {
            const res = await (request as any)('stx_callContract', {
                contract: `${REGISTRY_ADDRESS}.${REGISTRY_NAME}`,
                functionName: 'register-agent',
                functionArgs: [
                    { type: 'string-ascii', value: name },
                    { type: 'string-ascii', value: desc },
                    { type: 'string-ascii', value: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80' },
                    { type: 'buffer', value: pubKeyHex },
                ],
                network: 'testnet',
            });

            logEvent(`✓ Registered! TXID: ${String(res?.txid ?? '').slice(0, 12)}…`, 'system');
            const pending: Agent = { name, description: desc, vouched: false, network: 'Pending…' };
            const local: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
            local.unshift(pending);
            localStorage.setItem('bria_pending_agents', JSON.stringify(local));
            submitBtn.innerText = 'Registered ✓';
            setTimeout(() => { form.reset(); submitBtn.innerText = orig; submitBtn.disabled = false; discoverAgents(); }, 3000);
        } catch (err: any) {
            logEvent(`Registration failed: ${err?.message ?? 'cancelled'}`, 'error');
            submitBtn.innerText = orig;
            submitBtn.disabled = false;
        }
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
function init() {
    setupCursorSpotlight();
    setupWalletConnect();
    startDemoActivityFeed();
    startDashboard().catch(console.error);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
