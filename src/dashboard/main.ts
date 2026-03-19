// --- STACKS SDK POLYFILLS ---
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).global = window;
(window as any).process = { env: {} };

import { showConnect, showContractCall, AppConfig, UserSession, isStacksWalletInstalled } from '@stacks/connect';
import type { FinishedTxData } from '@stacks/connect';
import { stringAsciiCV, bufferCV } from '@stacks/transactions';
import { BriaSDK } from './sdk/index';

console.log('BRIA: Script loaded');

// --- Stacks Auth Setup (module-level, not inside async fn) ---
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

const REGISTRY_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const REGISTRY_NAME = 'bria-registry';

interface Agent {
    name: string;
    description: string;
    imageUrl: string;
    vouched: boolean;
    network: string;
}

// ─── Logging helper (no DOM deps — defined early so everyone can use it) ──────
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

// ─── Wallet button state ───────────────────────────────────────────────────────
function updateWalletButton() {
    const connectBtn = document.getElementById('connectWallet') as HTMLButtonElement | null;
    if (!connectBtn) return;
    if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        const addr = userData.profile?.stxAddress?.testnet || userData.profile?.stxAddress?.mainnet || '';
        const short = addr ? `${addr.slice(0, 5)}...${addr.slice(-4)}` : 'Connected';
        connectBtn.innerText = short;
        connectBtn.style.borderColor = '#ff9900';
        connectBtn.style.color = '#ff9900';
    } else {
        connectBtn.innerText = 'Connect Wallet';
        connectBtn.style.borderColor = '';
        connectBtn.style.color = '';
    }
}

// ─── Wire up wallet connect button (synchronous — no async deps) ──────────────
function setupWalletConnect() {
    const connectBtn = document.getElementById('connectWallet') as HTMLButtonElement | null;
    if (!connectBtn) return;

    // Restore existing session
    if (userSession.isSignInPending()) {
        userSession.handlePendingSignIn().then(updateWalletButton);
    } else {
        updateWalletButton();
    }

    connectBtn.addEventListener('click', () => {
        if (userSession.isUserSignedIn()) {
            userSession.signUserOut();
            updateWalletButton();
            logEvent('Wallet disconnected.', 'system');
            return;
        }

        if (!isStacksWalletInstalled()) {
            logEvent('No Stacks wallet detected — install Hiro Wallet or Leather to continue.', 'error');
            connectBtn.innerText = 'Install Hiro Wallet →';
            connectBtn.style.borderColor = '#ff4444';
            connectBtn.style.color = '#ff4444';
            window.open('https://wallet.hiro.so', '_blank');
            setTimeout(() => {
                connectBtn.innerText = 'Connect Wallet';
                connectBtn.style.borderColor = '';
                connectBtn.style.color = '';
            }, 3000);
            return;
        }

        logEvent('Opening wallet connection popup...', 'system');
        showConnect({
            appDetails: {
                name: 'BRIA — Bitcoin Identity Registry',
                icon: window.location.origin + '/-bria-bitcoin-identity/favicon.ico',
            },
            userSession,
            onFinish: () => {
                updateWalletButton();
                logEvent('Wallet connected successfully! ✓', 'system');
            },
            onCancel: () => {
                logEvent('Wallet connection cancelled.', 'system');
            },
        });
    });
}

// ─── Main dashboard (async discovery + registration) ─────────────────────────
async function startDashboard() {
    console.log('BRIA: Dashboard Initialization Started');

    const sdk = new BriaSDK('testnet', REGISTRY_ADDRESS, REGISTRY_NAME);

    const mockAgents: Agent[] = [
        {
            name: 'SatoshiBot',
            description: 'Autonomous yield optimizer for sBTC markets.',
            imageUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=400&q=80',
            vouched: true,
            network: 'Stacks'
        },
        {
            name: 'BtcOracle',
            description: 'Real-time Bitcoin consensus data aggregator.',
            imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=400&q=80',
            vouched: true,
            network: 'Bitcoin'
        }
    ];

    let agents: Agent[] = [...mockAgents];
    const agentGrid = document.getElementById('agentGrid');
    if (!agentGrid) return;

    const statusText = document.createElement('div');
    statusText.id = 'networkStatus';
    statusText.style.cssText = 'font-size:0.9rem;color:#ff9900;margin-bottom:2rem;font-weight:bold;';
    statusText.innerText = '📡 Connecting to Stacks Testnet...';
    agentGrid.parentElement?.insertBefore(statusText, agentGrid);

    function renderAgents() {
        agentGrid!.innerHTML = '';
        agents.forEach(agent => {
            const card = document.createElement('div');
            card.className = 'agent-card';
            card.innerHTML = `
                <div class="agent-image" style="background-image:url('${agent.imageUrl}');background-size:cover;height:200px;border-radius:16px;margin-bottom:1.5rem;"></div>
                <div class="agent-info">
                    <h3>${agent.name}</h3>
                    <p>${agent.description}</p>
                    <div class="agent-badges">
                        ${agent.vouched ? '<span class="badge verified">Verified</span>' : ''}
                        <span class="badge ${agent.network.toLowerCase()}">${agent.network}</span>
                    </div>
                </div>`;
            agentGrid!.appendChild(card);
        });
    }

    async function discoverAgents() {
        logEvent('Starting Agent Discovery loop...', 'network');
        try {
            logEvent('Querying Stacks Registry...', 'network');
            const total = await sdk.getTotalAgents();
            logEvent(`Stacks node reported ${total} agents in registry.`, 'system');

            if (total > 0) {
                statusText.innerText = `🟢 Connected: ${total} Agents Discovered on Stacks.`;
                const discovered: Agent[] = [];
                for (let i = 1; i <= total; i++) {
                    const profile = await sdk.getAgentById(i);
                    if (profile) {
                        logEvent(`Resolved identity: ${profile.name}`, 'system');
                        discovered.push({ name: profile.name, description: profile.description, imageUrl: profile.imageUrl, vouched: profile.vouched, network: 'Stacks' });
                    }
                }
                agents = discovered;
            } else {
                logEvent('No live agents found. Showing Demo Directory.', 'system');
                statusText.innerText = '🟡 Connected: 0 Live Agents (Testnet). Showing Demo Directory.';
                agents = [...mockAgents];
            }
        } catch (_err) {
            logEvent('Stacks node unreachable — showing local demo agents.', 'error');
            statusText.innerText = '🔴 Stacks Sync Error: Showing Local Registry.';
            agents = [...mockAgents];
        }

        // Merge optimistic pending agents
        const localAgents: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
        if (localAgents.length > 0) {
            logEvent(`Injecting ${localAgents.length} pending local agent(s)...`, 'system');
            agents = [...localAgents, ...agents];
        }
        renderAgents();
    }

    // Run discovery (errors fully caught — won't crash listener setup)
    discoverAgents().catch(() => {});

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
            const pubKeyHex = (document.getElementById('agentPubKey') as HTMLInputElement).value;

            if (!pubKeyHex || pubKeyHex.replace('0x', '').length < 66) {
                logEvent('Invalid Bitcoin public key — must be 33-byte hex (66 chars).', 'error');
                return;
            }

            submitBtn.innerText = 'Waiting for wallet...';
            submitBtn.disabled = true;
            logEvent(`Initiating on-chain registration for "${name}"...`, 'network');

            const imageUrl = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80';
            const pubKeyBytes = Buffer.from(pubKeyHex.replace('0x', ''), 'hex');

            showContractCall({
                contractAddress: REGISTRY_ADDRESS,
                contractName: REGISTRY_NAME,
                functionName: 'register-agent',
                functionArgs: [
                    stringAsciiCV(name),
                    stringAsciiCV(desc),
                    stringAsciiCV(imageUrl),
                    bufferCV(pubKeyBytes),
                ],
                network: 'testnet',
                appDetails: {
                    name: 'BRIA — Bitcoin Identity Registry',
                    icon: window.location.origin + '/-bria-bitcoin-identity/favicon.ico',
                },
                userSession,
                onFinish: (data: FinishedTxData) => {
                    logEvent(`Tx broadcasted! TXID: ${data.txId.substring(0, 10)}...`, 'system');
                    const pending: Agent = { name, description: desc, imageUrl, vouched: false, network: 'Pending...' };
                    const local: Agent[] = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                    local.unshift(pending);
                    localStorage.setItem('bria_pending_agents', JSON.stringify(local));
                    submitBtn.innerText = 'Tx Broadcasted! ✓';
                    submitBtn.style.background = 'linear-gradient(135deg, #00ff88 0%, #00aa66 100%)';
                    submitBtn.disabled = false;
                    setTimeout(async () => {
                        registrationForm.reset();
                        submitBtn.innerText = originalText;
                        submitBtn.style.background = '';
                        await discoverAgents();
                        document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
                    }, 3000);
                },
                onCancel: () => {
                    logEvent('Transaction signing cancelled.', 'system');
                    submitBtn.innerText = originalText;
                    submitBtn.style.background = '';
                    submitBtn.disabled = false;
                },
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

// ─── Boot sequence ─────────────────────────────────────────────────────────────
// Setup wallet SYNCHRONOUSLY first (no async deps), then start async dashboard
function init() {
    setupWalletConnect();      // ← always runs, no await, no crash risk
    startDashboard().catch(console.error);  // ← async errors fully caught
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
