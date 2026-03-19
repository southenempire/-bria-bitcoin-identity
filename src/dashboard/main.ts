// --- STACKS SDK POLYFILLS (CRITICAL FOR PRODUCTION-READY DASHBOARD) ---
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).global = window;
(window as any).process = { env: {} };

import { showConnect, showContractCall, AppConfig, UserSession, FinishedTxData } from '@stacks/connect';
import { stringAsciiCV, bufferCV, uintCV } from '@stacks/transactions';
import { BriaSDK, AgentProfile } from './sdk/index';

console.log('BRIA: Script loaded');

// --- Stacks Auth Setup ---
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

async function startDashboard() {
    console.log('BRIA: Dashboard Initialization Started');

    // Initialize Production SDK (read-only queries)
    const sdk = new BriaSDK('testnet', REGISTRY_ADDRESS, REGISTRY_NAME);

    // Mock Fallback Data (for demo if node is empty)
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

    if (!agentGrid) {
        console.error('BRIA: agentGrid not found in DOM');
        return;
    }

    const statusText = document.createElement('div');
    statusText.id = 'networkStatus';
    statusText.style.fontSize = '0.9rem';
    statusText.style.color = '#ff9900';
    statusText.style.marginBottom = '2rem';
    statusText.style.fontWeight = 'bold';
    statusText.innerText = '📡 Connecting to Stacks Testnet...';
    agentGrid.parentElement?.insertBefore(statusText, agentGrid);

    // --- Wallet Connect ---
    const connectBtn = document.getElementById('connectWallet') as HTMLButtonElement | null;

    function updateWalletButton() {
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

    // Restore session on load
    if (userSession.isSignInPending()) {
        await userSession.handlePendingSignIn();
    }
    updateWalletButton();

    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            if (userSession.isUserSignedIn()) {
                userSession.signUserOut();
                updateWalletButton();
                logEvent('Wallet disconnected.', 'system');
                return;
            }
            showConnect({
                appDetails: {
                    name: 'BRIA — Bitcoin Identity Registry',
                    icon: window.location.origin + '/favicon.ico',
                },
                userSession,
                onFinish: () => {
                    updateWalletButton();
                    logEvent('Wallet connected successfully!', 'system');
                },
                onCancel: () => {
                    logEvent('Wallet connection cancelled.', 'system');
                },
            });
        });
    }

    function renderAgents() {
        console.log(`BRIA: Rendering ${agents.length} agents`);
        agentGrid!.innerHTML = '';
        agents.forEach(agent => {
            const card = document.createElement('div');
            card.className = 'agent-card';
            card.innerHTML = `
                <div class="agent-image" style="background-image: url('${agent.imageUrl}'); background-size: cover; height: 200px; border-radius: 16px; margin-bottom: 1.5rem;"></div>
                <div class="agent-info">
                    <h3>${agent.name}</h3>
                    <p>${agent.description}</p>
                    <div class="agent-badges">
                        ${agent.vouched ? '<span class="badge verified">Verified</span>' : ''}
                        <span class="badge ${agent.network.toLowerCase()}">${agent.network}</span>
                    </div>
                </div>
            `;
            agentGrid!.appendChild(card);
        });
    }

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

    async function discoverAgents() {
        logEvent('Starting Agent Discovery loop...', 'network');
        try {
            logEvent('Querying Stacks Registry (getTotalAgents)...', 'network');
            const total = await sdk.getTotalAgents();
            logEvent(`Stacks node reported ${total} agents in registry.`, 'system');

            if (total > 0) {
                statusText.innerText = `🟢 Connected: ${total} Agents Discovered on Stacks.`;
                const discovered: Agent[] = [];
                for (let i = 1; i <= total; i++) {
                    logEvent(`Fetching profile for Agent ID #${i}...`, 'network');
                    const profile = await sdk.getAgentById(i);
                    if (profile) {
                        logEvent(`Resolved identity: ${profile.name}`, 'system');
                        discovered.push({
                            name: profile.name,
                            description: profile.description,
                            imageUrl: profile.imageUrl,
                            vouched: profile.vouched,
                            network: 'Stacks'
                        });
                    }
                }
                agents = discovered;
            } else {
                logEvent('No live agents found. Switching to Demo Directory fallback.', 'system');
                statusText.innerText = '🟡 Connected: 0 Live Agents Found (Testnet). Showing Demo Directory.';
                agents = [...mockAgents];
            }
        } catch (error) {
            logEvent('Stacks synchronization failed. Is the node reachable?', 'error');
            console.error('BRIA: Discovery Error', error);
            statusText.innerText = '🔴 Stacks Sync Error: Falling back to Local Registry.';
            agents = [...mockAgents];
        }

        // Merge Optimistic (Local) Agents
        const localAgents = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
        if (localAgents.length > 0) {
            logEvent(`Injecting ${localAgents.length} pending local agent(s)...`, 'system');
            agents = [...localAgents, ...agents];
        }

        renderAgents();
    }

    // Initial Discovery
    discoverAgents();

    // --- Registration Form — Signs via Hiro/Leather Wallet ---
    const registrationForm = document.getElementById('registrationForm') as HTMLFormElement;
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = registrationForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalText = submitBtn.innerText;

            if (!userSession.isUserSignedIn()) {
                logEvent('Please connect your wallet first!', 'error');
                submitBtn.innerText = 'Connect Wallet First!';
                submitBtn.style.background = '#ff4444';
                setTimeout(() => {
                    submitBtn.innerText = originalText;
                    submitBtn.style.background = '';
                }, 2500);
                return;
            }

            const name = (document.getElementById('agentName') as HTMLInputElement).value;
            const desc = (document.getElementById('agentDesc') as HTMLTextAreaElement).value;
            const pubKeyHex = (document.getElementById('agentPubKey') as HTMLInputElement).value;

            if (!pubKeyHex || pubKeyHex.length < 66) {
                logEvent('Invalid Bitcoin public key — must be 33-byte hex (66 chars).', 'error');
                return;
            }

            submitBtn.innerText = 'Waiting for wallet...';
            submitBtn.disabled = true;

            logEvent(`Initiating on-chain registration for "${name}"...`, 'network');
            logEvent('Opening wallet to sign transaction...', 'system');

            try {
                const pubKeyBytes = Buffer.from(pubKeyHex.replace('0x', ''), 'hex');
                const imageUrl = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80';

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
                        icon: window.location.origin + '/favicon.ico',
                    },
                    userSession,
                    onFinish: (data: FinishedTxData) => {
                        const txid = data.txId;
                        logEvent(`Registration broadcasted! TXID: ${txid.substring(0, 10)}...`, 'system');

                        // Optimistic UI — show pending agent immediately
                        const pendingAgent: Agent = {
                            name,
                            description: desc,
                            imageUrl,
                            vouched: false,
                            network: 'Pending...'
                        };
                        const localAgents = JSON.parse(localStorage.getItem('bria_pending_agents') || '[]');
                        localAgents.unshift(pendingAgent);
                        localStorage.setItem('bria_pending_agents', JSON.stringify(localAgents));

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
                        logEvent('Transaction signing cancelled by user.', 'system');
                        submitBtn.innerText = originalText;
                        submitBtn.style.background = '';
                        submitBtn.disabled = false;
                    },
                });
            } catch (error) {
                logEvent('Blockchain registration failed.', 'error');
                console.error('BRIA: Registration Failed', error);
                submitBtn.innerText = 'Registration Failed';
                submitBtn.style.background = '#ff4444';
                setTimeout(() => {
                    submitBtn.innerText = originalText;
                    submitBtn.style.background = '';
                    submitBtn.disabled = false;
                }, 3000);
            }
        });
    }

    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (this: HTMLAnchorElement, e: Event) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href) {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// Ensure startup regardless of event timing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDashboard);
} else {
    startDashboard();
}
