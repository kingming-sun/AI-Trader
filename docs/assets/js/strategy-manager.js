// Strategy Management Frontend
// Handles strategy creation, management, and mode switching

class StrategyManager {
    constructor() {
        // Use API_CONFIG if available (from api-config.js), otherwise fallback to localhost
        this.apiBase = window.API_CONFIG?.strategyApi || 'http://localhost:8005';
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
            'design': '设计中',
            'backtest': '回测中',
            'simulate': '模拟中',
            'real': '实盘中'
        };
        return texts[status] || status;
    }

    async deleteStrategy(strategyId, strategyName) {
        // Show confirmation dialog
        const confirmed = confirm(
            `⚠️ 删除策略：${strategyName}\n\n` +
            `此操作将删除策略的所有配置和数据，且不可恢复。\n\n` +
            `是否确定删除？`
        );
        
        if (!confirmed) {
            return false;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${strategyId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete strategy');
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting strategy:', error);
            alert(`删除策略失败：${error.message}`);
            return false;
        }
    }

}

const strategyManager = new StrategyManager();

async function loadStrategies() {
    const strategies = await strategyManager.listStrategies();
    const container = document.getElementById('strategyList');
    
    if (!container) {
        console.error('Strategy list container not found');
        return;
    }
    
    if (strategies.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">还没有策略，创建您的第一个策略开始！</p>';
        return;
    }
    
    container.innerHTML = strategies.map(strategy => `
        <div class="strategy-card">
            <div class="strategy-card-header">
                <div>
                    <h4 style="margin: 0 0 0.5rem 0;">${strategy.strategy_name}</h4>
                    <p style="color: var(--text-muted); font-size: 0.875rem; margin: 0;">${strategy.description || '无描述'}</p>
                </div>
                <span class="strategy-status ${strategyManager.getStatusClass(strategy.status)}">
                    ${strategyManager.getStatusText(strategy.status)}
                </span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                创建时间: ${new Date(strategy.created_at).toLocaleDateString('zh-CN')}
            </div>
            <div class="strategy-actions">
                <button class="btn-small btn-edit" onclick="editStrategy('${strategy.strategy_id}')">查看详情</button>
                <button class="btn-small btn-delete" style="background: var(--danger); margin-left: auto;" onclick="deleteStrategy('${strategy.strategy_id}', '${strategy.strategy_name}')">删除</button>
            </div>
        </div>
    `).join('');
}

async function runStrategy(strategyId, mode) {
    if (mode === 'real') {
        if (!confirm(`⚠️ 确定要启动实盘交易吗？\n\n这将使用真实资金并执行真实交易。`)) {
            return;
        }
    }
    
    try {
        await strategyManager.runStrategy(strategyId, mode, mode === 'real');
        const modeText = mode === 'backtest' ? '回测' : mode === 'simulate' ? '模拟' : '实盘';
        alert(`✅ 策略已在${modeText}模式下启动！`);
        loadStrategies();
    } catch (error) {
        alert(`❌ 错误：${error.message}`);
    }
}

function editStrategy(strategyId) {
    // Redirect to strategy detail page
    window.location.href = `strategy-detail.html?id=${strategyId}`;
}

async function deleteStrategy(strategyId, strategyName) {
    const result = await strategyManager.deleteStrategy(strategyId, strategyName);
    if (result) {
        alert('✅ 策略已成功删除');
        loadStrategies(); // Reload the strategy list
    }
}

document.getElementById('createStrategyBtn')?.addEventListener('click', async () => {
    const name = prompt('请输入策略名称:');
    if (!name) return;
    
    const description = prompt('请输入策略描述（可选）:') || '';
    
    try {
        const result = await strategyManager.createStrategy(name, description);
        alert(`✅ 策略创建成功：${result.strategy_id}`);
        loadStrategies();
    } catch (error) {
        alert(`❌ 错误：${error.message}`);
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Strategy Manager initialized');
    loadStrategies();
});

