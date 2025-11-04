// Strategy Management Frontend
// Handles strategy creation, management, and mode switching

class StrategyManager {
    constructor() {
        this.apiBase = 'http://localhost:8005';
    }

    async listStrategies() {
        try {
            const response = await fetch(`${this.apiBase}/api/strategies`);
            if (!response.ok) throw new Error('Failed to load strategies');
            const data = await response.json();
            return data.strategies || [];
        } catch (error) {
            console.error('Error loading strategies:', error);
            return [];
        }
    }

    async createStrategy(name, description) {
        try {
            const response = await fetch(`${this.apiBase}/api/strategies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy_name: name, description })
            });
            if (!response.ok) throw new Error('Failed to create strategy');
            return await response.json();
        } catch (error) {
            console.error('Error creating strategy:', error);
            throw error;
        }
    }

    async runStrategy(strategyId, mode, confirm = false) {
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${strategyId}/run/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm })
            });
            if (!response.ok) {
                const error = await response.json();
                if (error.requires_confirmation) {
                    return { requires_confirmation: true };
                }
                throw new Error(error.error || 'Failed to run strategy');
            }
            return await response.json();
        } catch (error) {
            console.error('Error running strategy:', error);
            throw error;
        }
    }

    getStatusClass(status) {
        const classes = {
            'design': 'status-design',
            'backtest': 'status-backtest',
            'simulate': 'status-simulate',
            'real': 'status-real'
        };
        return classes[status] || 'status-design';
    }

    getStatusText(status) {
        const texts = {
            'design': 'Design',
            'backtest': 'Backtesting',
            'simulate': 'Simulating',
            'real': 'Real Trading'
        };
        return texts[status] || status;
    }

    async getServicesStatus() {
        try {
            const response = await fetch(`${this.apiBase}/api/services/status`);
            if (!response.ok) throw new Error('Failed to load services status');
            const data = await response.json();
            return data.status || {};
        } catch (error) {
            console.error('Error loading services status:', error);
            return {};
        }
    }

    async startMCPServices() {
        try {
            const response = await fetch(`${this.apiBase}/api/services/mcp/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Failed to start MCP services');
            return await response.json();
        } catch (error) {
            console.error('Error starting MCP services:', error);
            throw error;
        }
    }

    async stopMCPServices() {
        try {
            const response = await fetch(`${this.apiBase}/api/services/mcp/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Failed to stop MCP services');
            return await response.json();
        } catch (error) {
            console.error('Error stopping MCP services:', error);
            throw error;
        }
    }

    updateServicesStatus(status) {
        const container = document.getElementById('servicesStatus');
        if (!container) return;

        const mcpServices = status.mcp_services || {};
        const apiServices = status.api_services || {};

        const mcpItems = Object.entries(mcpServices).map(([name, running]) => `
            <div style="background: var(--card-bg); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">MCP ${name}</span>
                    <span style="color: ${running ? 'var(--success)' : 'var(--danger)'};">
                        ${running ? '✅ Running' : '❌ Stopped'}
                    </span>
                </div>
            </div>
        `).join('');

        const apiItems = Object.entries(apiServices).map(([name, running]) => `
            <div style="background: var(--card-bg); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">${name.replace('_', ' ').toUpperCase()}</span>
                    <span style="color: ${running ? 'var(--success)' : 'var(--danger)'};">
                        ${running ? '✅ Running' : '❌ Stopped'}
                    </span>
                </div>
            </div>
        `).join('');

        container.innerHTML = mcpItems + apiItems;
    }
}

const strategyManager = new StrategyManager();

async function loadStrategies() {
    const strategies = await strategyManager.listStrategies();
    const container = document.getElementById('strategyList');
    
    if (strategies.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No strategies yet. Create your first strategy to get started!</p>';
        return;
    }
    
    container.innerHTML = strategies.map(strategy => `
        <div class="strategy-card">
            <div class="strategy-card-header">
                <div>
                    <h4 style="margin: 0 0 0.5rem 0;">${strategy.strategy_name}</h4>
                    <p style="color: var(--text-muted); font-size: 0.875rem; margin: 0;">${strategy.description || 'No description'}</p>
                </div>
                <span class="strategy-status ${strategyManager.getStatusClass(strategy.status)}">
                    ${strategyManager.getStatusText(strategy.status)}
                </span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                Created: ${new Date(strategy.created_at).toLocaleDateString()}
            </div>
            <div class="strategy-actions">
                <button class="btn-small btn-edit" onclick="editStrategy('${strategy.strategy_id}')">Edit</button>
                <button class="btn-small btn-run" onclick="runStrategy('${strategy.strategy_id}', 'backtest')">Backtest</button>
                <button class="btn-small btn-run" onclick="runStrategy('${strategy.strategy_id}', 'simulate')">Simulate</button>
                <button class="btn-small btn-run" style="background: var(--danger);" onclick="runStrategy('${strategy.strategy_id}', 'real')">Real</button>
            </div>
        </div>
    `).join('');
}

async function runStrategy(strategyId, mode) {
    if (mode === 'real') {
        if (!confirm(`⚠️ Are you sure you want to start REAL trading for this strategy?\n\nThis will use real funds and execute real trades.`)) {
            return;
        }
    }
    
    try {
        const result = await strategyManager.runStrategy(strategyId, mode, mode === 'real');
        alert(`✅ Strategy started in ${mode} mode!`);
        loadStrategies();
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
}

function editStrategy(strategyId) {
    // Redirect to config page with strategy ID
    window.location.href = `config.html?strategy=${strategyId}`;
}

document.getElementById('createStrategyBtn').addEventListener('click', async () => {
    const name = prompt('Enter strategy name:');
    if (!name) return;
    
    const description = prompt('Enter strategy description (optional):') || '';
    
    try {
        const result = await strategyManager.createStrategy(name, description);
        alert(`✅ Strategy created: ${result.strategy_id}`);
        loadStrategies();
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
});

// Load services status
async function loadServicesStatus() {
    const status = await strategyManager.getServicesStatus();
    strategyManager.updateServicesStatus(status);
}

// Start MCP services
document.getElementById('startMCPServicesBtn').addEventListener('click', async () => {
    try {
        const btn = document.getElementById('startMCPServicesBtn');
        btn.textContent = 'Starting...';
        btn.disabled = true;
        
        const result = await strategyManager.startMCPServices();
        alert(result.message || '✅ MCP services started');
        await loadServicesStatus();
        
        btn.textContent = 'Start MCP Services';
        btn.disabled = false;
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
        const btn = document.getElementById('startMCPServicesBtn');
        btn.textContent = 'Start MCP Services';
        btn.disabled = false;
    }
});

// Stop MCP services
document.getElementById('stopMCPServicesBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to stop all MCP services?')) {
        return;
    }
    
    try {
        const result = await strategyManager.stopMCPServices();
        alert(result.message || '✅ MCP services stopped');
        await loadServicesStatus();
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
});

// Refresh services status
document.getElementById('refreshServicesBtn').addEventListener('click', async () => {
    await loadServicesStatus();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStrategies();
    loadServicesStatus();
    
    // Auto-refresh services status every 10 seconds
    setInterval(loadServicesStatus, 10000);
});

