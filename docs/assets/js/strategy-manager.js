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
            'backtest_completed': 'status-backtest-completed',
            'simulate': 'status-simulate',
            'real': 'status-real'
        };
        return classes[status] || 'status-design';
    }

    getStatusText(status) {
        const texts = {
            'design': '设计中',
            'backtest': '回测中',
            'backtest_completed': '回测结束',
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

    async checkBacktestStatus(strategyId) {
        /**检查策略的回测状态*/
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${strategyId}/status/backtest`);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return data.status;
        } catch (error) {
            console.error(`Error checking backtest status for ${strategyId}:`, error);
            return null;
        }
    }

    async updateStrategyStatus(strategyId, newStatus) {
        /**更新策略状态*/
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${strategyId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            return response.ok;
        } catch (error) {
            console.error(`Error updating strategy status for ${strategyId}:`, error);
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
    
    // 检查每个策略的回测状态，动态确定显示状态
    // 使用与策略详情页面相同的判断逻辑
    const strategiesWithStatus = await Promise.all(strategies.map(async (strategy) => {
        let displayStatus = strategy.status;
        
        // 检查回测状态（与策略详情页面使用相同的API和判断逻辑）
        const runStatus = await strategyManager.checkBacktestStatus(strategy.strategy_id);
        if (runStatus) {
            // 使用与策略详情页面完全相同的判断逻辑
            if (runStatus.status === 'completed') {
                // 回测已完成，显示"回测结束"
                displayStatus = 'backtest_completed';
            } else if (runStatus.status === 'failed') {
                // 回测失败，也显示"回测结束"
                displayStatus = 'backtest_completed';
            } else if (runStatus.is_running) {
                // 回测正在运行，显示"回测中"
                displayStatus = 'backtest';
            } else if (runStatus.status === 'stopped' && runStatus.progress > 0) {
                // 回测已暂停但有进度，保持"回测中"状态
                displayStatus = 'backtest';
            } else if (strategy.status === 'backtest') {
                // 如果策略状态是"回测中"但回测未运行，保持原状态
                displayStatus = 'backtest';
            }
        }
        
        return { ...strategy, displayStatus };
    }));
    
    container.innerHTML = strategiesWithStatus.map(strategy => `
        <div class="strategy-card">
            <div class="strategy-card-header">
                <div>
                    <h4 style="margin: 0 0 0.5rem 0;">${strategy.strategy_name}</h4>
                    <p style="color: var(--text-muted); font-size: 0.875rem; margin: 0;">${strategy.description || '无描述'}</p>
                </div>
                <span class="strategy-status ${strategyManager.getStatusClass(strategy.displayStatus)}">
                    ${strategyManager.getStatusText(strategy.displayStatus)}
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

// 状态检查相关变量
let statusCheckInterval = null;
let strategiesToCheck = new Set(); // 需要检查回测状态的策略ID集合

// 检查并更新策略状态
async function checkAndUpdateStrategyStatuses() {
    const strategies = await strategyManager.listStrategies();
    const backtestStrategies = strategies.filter(s => s.status === 'backtest');
    
    // 更新需要检查的策略集合（包括所有状态为"回测中"的策略）
    backtestStrategies.forEach(s => strategiesToCheck.add(s.strategy_id));
    
    // 如果没有需要检查的策略，清理集合
    if (strategiesToCheck.size === 0 && backtestStrategies.length === 0) {
        return;
    }
    
    let needsReload = false;
    
    // 检查每个需要检查的策略
    const strategiesToRemove = [];
    for (const strategyId of strategiesToCheck) {
        const runStatus = await strategyManager.checkBacktestStatus(strategyId);
        
        if (runStatus) {
            // 如果回测已完成或失败，保持状态为"backtest"（前端会显示为"回测结束"）
            if (runStatus.status === 'completed' || runStatus.status === 'failed') {
                // 不需要更新状态，保持为"backtest"，前端会根据回测状态显示"回测结束"
                strategiesToRemove.push(strategyId);
                needsReload = true;
            } else if (!runStatus.is_running && runStatus.status !== 'stopped' && runStatus.status !== 'not_started') {
                // 如果回测已停止且不是暂停状态，保持状态为"backtest"
                strategiesToRemove.push(strategyId);
                needsReload = true;
            } else if (runStatus.is_running) {
                // 如果回测正在运行，确保策略状态是"回测中"（后端启动时会自动设置，这里只是同步）
                const strategy = strategies.find(s => s.strategy_id === strategyId);
                if (strategy && strategy.status !== 'backtest') {
                    await strategyManager.updateStrategyStatus(strategyId, 'backtest');
                    needsReload = true;
                }
            }
        }
    }
    
    // 移除已完成的策略
    strategiesToRemove.forEach(id => strategiesToCheck.delete(id));
    
    // 如果有状态更新，重新加载策略列表
    if (needsReload) {
        await loadStrategies();
    }
}

// 启动状态检查
function startStatusChecking() {
    // 每5秒检查一次回测状态
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    statusCheckInterval = setInterval(checkAndUpdateStrategyStatuses, 5000);
}

// 停止状态检查
function stopStatusChecking() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Strategy Manager initialized');
    await loadStrategies();
    // 加载策略后，识别正在回测的策略
    const strategies = await strategyManager.listStrategies();
    const backtestStrategies = strategies.filter(s => s.status === 'backtest');
    backtestStrategies.forEach(s => strategiesToCheck.add(s.strategy_id));
    
    // 立即检查一次所有策略的状态（包括可能已完成但状态未更新的）
    await checkAndUpdateStrategyStatuses();
    
    // 开始定期检查
    startStatusChecking();
});

// 页面卸载时停止检查
window.addEventListener('beforeunload', () => {
    stopStatusChecking();
});

