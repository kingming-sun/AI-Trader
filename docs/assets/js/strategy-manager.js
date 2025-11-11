// Strategy Management Frontend
// Handles strategy creation, management, and mode switching

class StrategyManager {
    constructor() {
        // Use API_CONFIG if available (from api-config.js), otherwise fallback to localhost
        this.apiBase = window.API_CONFIG?.strategyApi || 'http://localhost:8005';
    }

    async listStrategies() {
        try {
            console.log(`Fetching strategies from ${this.apiBase}/api/strategies`);
            const response = await fetch(`${this.apiBase}/api/strategies`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error (${response.status}):`, errorText);
                throw new Error(`API返回错误 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            console.log('API response:', data);
            
            if (!data.success) {
                console.error('API returned success=false:', data.error);
                throw new Error(data.error || '获取策略列表失败');
            }
            
            return data.strategies || [];
        } catch (error) {
            console.error('Error loading strategies:', error);
            throw error; // 重新抛出错误，让调用者处理
        }
    }

    async createStrategy(name, description) {
        try {
            console.log(`Creating strategy at ${this.apiBase}/api/strategies`);
            const response = await fetch(`${this.apiBase}/api/strategies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy_name: name, description })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error (${response.status}):`, errorText);
                throw new Error(`API返回错误 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Create strategy response:', data);
            
            if (!data.success) {
                throw new Error(data.error || '创建策略失败');
            }
            
            return data;
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000); // 减少到1秒超时
            
            const response = await fetch(`${this.apiBase}/api/strategies/${strategyId}/status/backtest`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return data.status;
        } catch (error) {
            // 静默处理超时和错误，不输出警告以减少控制台噪音
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

    async getStrategyResults(strategyId, mode = 'backtest') {
        /**获取策略结果数据*/
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 减少到2秒超时
            
            const response = await fetch(`${this.apiBase}/api/strategies/${strategyId}/results/${mode}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (data.success && data.has_data) {
                return data.results;
            }
            return null;
        } catch (error) {
            // 静默处理超时和错误，不输出警告以减少控制台噪音
            return null;
        }
    }

    formatCurrency(value) {
        if (value === null || value === undefined) return 'N/A';
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    formatPercent(value) {
        if (value === null || value === undefined) return 'N/A';
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    }

    drawMiniChart(canvasId, data, color) {
        /**绘制小型填充区域图（area chart）*/
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element not found: ${canvasId}`);
            return;
        }
        
        if (!data || data.length === 0) {
            console.warn(`No data for chart: ${canvasId}`);
            return;
        }
        
        if (data.length < 2) {
            console.warn(`Not enough data points for chart: ${canvasId}, length: ${data.length}`);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn(`Could not get 2d context for canvas: ${canvasId}`);
            return;
        }
        
        // 获取容器的实际显示尺寸
        const container = canvas.parentElement;
        if (!container) {
            console.warn(`Container not found for canvas: ${canvasId}`);
            return;
        }
        
        // 等待容器尺寸稳定
        const displayWidth = container.clientWidth || 320;
        const displayHeight = 80;
        
        if (displayWidth <= 0) {
            console.warn(`Invalid container width for canvas: ${canvasId}, width: ${displayWidth}`);
            // 使用默认宽度
            const defaultWidth = 320;
            canvas.width = defaultWidth;
            canvas.height = displayHeight;
            canvas.style.width = `${defaultWidth}px`;
            canvas.style.height = `${displayHeight}px`;
        } else {
            // 设置canvas的实际像素尺寸（使用设备像素比以获得清晰显示）
            const dpr = window.devicePixelRatio || 1;
            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            
            // 缩放上下文以匹配设备像素比
            ctx.scale(dpr, dpr);
        }
        
        const width = displayWidth > 0 ? displayWidth : 320;
        const height = displayHeight;
        
        ctx.clearRect(0, 0, width, height);
        
        // 找到最大值和最小值
        const values = data.map(d => {
            const val = d.total_value || d.value || 0;
            return typeof val === 'number' ? val : parseFloat(val) || 0;
        }).filter(v => !isNaN(v) && isFinite(v));
        
        if (values.length < 2) {
            console.warn(`Not enough valid values for chart: ${canvasId}`);
            return;
        }
        
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const range = maxValue - minValue || 1;
        
        // 计算点的位置（留出一些边距）
        const padding = 2;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        const stepX = chartWidth / (values.length - 1);
        const points = values.map((value, index) => {
            const x = padding + index * stepX;
            const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
            return { x, y };
        });
        
        // 绘制填充区域
        ctx.beginPath();
        ctx.moveTo(points[0].x, padding + chartHeight); // 从底部开始
        points.forEach(point => {
            ctx.lineTo(point.x, point.y);
        });
        ctx.lineTo(points[points.length - 1].x, padding + chartHeight); // 回到底部
        ctx.closePath();
        
        // 创建渐变填充
        const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
        const baseColor = color === '#48bb78' ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)';
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // 绘制折线
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();
        
        console.log(`Chart drawn successfully for ${canvasId}`, {
            width,
            height,
            pointsCount: points.length,
            minValue,
            maxValue
        });
    }

}

const strategyManager = new StrategyManager();

async function loadStrategies() {
    console.log('🔄 开始加载策略列表...');
    const container = document.getElementById('strategyList');
    
    if (!container) {
        console.error('❌ Strategy list container not found');
        return;
    }
    
    // 显示加载状态
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">加载中...</p>';
    console.log('📋 显示加载中状态...');
    
    try {
        const strategies = await strategyManager.listStrategies();
        console.log('Loaded strategies:', strategies);
        
        if (!strategies || strategies.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">还没有策略，创建您的第一个策略开始！</p>';
            return;
        }
        
        console.log('开始处理策略数据...');
        
        // 检查每个策略的回测状态，动态确定显示状态，并获取结果数据
        // 使用 Promise.allSettled 确保即使某些请求失败，也能继续处理
        // 优化：并行处理，减少超时时间，只检查需要检查的策略
        const strategiesWithDataPromises = strategies.map(async (strategy) => {
        let displayStatus = strategy.status;
        let results = null;
        
        // 只检查状态为"backtest"的策略的回测状态（减少不必要的请求）
        // 使用更短的超时时间（1秒）以加快加载速度
        if (strategy.status === 'backtest') {
            try {
                const statusPromise = strategyManager.checkBacktestStatus(strategy.strategy_id);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 1000) // 减少到1秒
                );
                
                const runStatus = await Promise.race([statusPromise, timeoutPromise]);
                if (runStatus) {
                    // 使用与策略详情页面完全相同的判断逻辑
                    if (runStatus.status === 'completed') {
                        displayStatus = 'backtest_completed';
                    } else if (runStatus.status === 'failed') {
                        displayStatus = 'backtest_completed';
                    } else if (runStatus.is_running) {
                        displayStatus = 'backtest';
                    } else if (runStatus.status === 'stopped' && runStatus.progress > 0) {
                        displayStatus = 'backtest';
                    }
                }
            } catch (error) {
                // 静默处理错误，使用原始状态
                // 不输出警告，避免控制台噪音
            }
        }
        
        // 获取策略结果数据（只获取第一个可能的模式，避免多次尝试）
        // 根据策略状态只尝试最相关的一个模式
        const mode = strategy.status === 'backtest' || strategy.status === 'backtest_completed' ? 'backtest' :
                     strategy.status === 'simulate' ? 'simulate' :
                     strategy.status === 'real' ? 'real' : 'backtest';
        
        try {
            const resultsPromise = strategyManager.getStrategyResults(strategy.strategy_id, mode);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 1500) // 1.5秒超时
            );
            
            results = await Promise.race([resultsPromise, timeoutPromise]);
        } catch (error) {
            // 静默处理错误，不输出警告
        }
        
        return { ...strategy, displayStatus, results };
    });
    
        // 使用 allSettled 确保所有策略都能处理，即使某些失败
        console.log('等待策略数据处理完成...');
        const strategiesWithDataResults = await Promise.allSettled(strategiesWithDataPromises);
        console.log('策略数据处理完成:', strategiesWithDataResults.length);
        
        const strategiesWithData = strategiesWithDataResults.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            // 如果处理失败，至少返回基本策略信息
            console.error(`Failed to process strategy ${strategies[index].strategy_id}:`, result.reason);
            return { ...strategies[index], displayStatus: strategies[index].status, results: null };
        }
        });
        
        console.log('准备渲染策略列表，策略数量:', strategiesWithData.length);
        
        container.innerHTML = strategiesWithData.map((strategy, index) => {
            const results = strategy.results;
            const metrics = results?.metrics || {};
            const portfolio = results?.portfolio || {};
            const assetEvolution = results?.asset_evolution || [];
            
            // 计算当前资产
            const currentAsset = metrics.current_value || portfolio.total_value || 0;
            const initialAsset = metrics.initial_value || (portfolio.total_value ? portfolio.total_value : 10000);
            
            // 总收益率
            const totalReturn = metrics.total_return !== undefined 
                ? metrics.total_return 
                : (initialAsset > 0 ? ((currentAsset - initialAsset) / initialAsset * 100) : 0);
            
            // 最大回撤
            const maxDrawdown = metrics.max_drawdown || 0;
            
            // 计算总盈亏（PNL）
            const totalPnl = currentAsset - initialAsset;
            
            // 持仓信息
            const holdings = portfolio.holdings || [];
            const holdingsList = holdings.slice(0, 3).map(h => h.symbol).join(', ');
            const holdingsCount = holdings.length;
            
            // 资产分布
            const cash = portfolio.cash || 0;
            const stockValue = currentAsset - cash;
            const stockRatio = currentAsset > 0 ? (portfolio.stock_ratio || (stockValue / currentAsset * 100)) : 0;
            const cashRatio = currentAsset > 0 ? (portfolio.cash_ratio || (cash / currentAsset * 100)) : 100;
            
            // 资产变化数据（用于折线图）
            const chartData = assetEvolution.length > 0 ? assetEvolution : [];
            const chartColor = totalReturn >= 0 ? '#48bb78' : '#f56565';
            
            // 计算24小时变化（如果有最近的数据）
            let change24h = 0;
            if (assetEvolution.length >= 2) {
                const recent = assetEvolution.slice(-24); // 取最近24个数据点
                if (recent.length >= 2) {
                    const oldValue = recent[0].total_value || 0;
                    const newValue = recent[recent.length - 1].total_value || 0;
                    change24h = newValue - oldValue;
                }
            }
            
            // 生成唯一的canvas ID
            const canvasId = `chart-${strategy.strategy_id}-${index}`;
            
            // 获取持仓股票符号列表（用于显示）
            const assetSymbols = holdings.length > 0 
                ? holdings.map(h => h.symbol).join(' • ')
                : (strategy.description || '').match(/[A-Z]{1,5}/g)?.join(' • ') || '';
            
            // 调试信息
            console.log(`Strategy ${strategy.strategy_name}:`, {
                hasResults: !!results,
                hasEvolution: !!assetEvolution,
                evolutionLength: assetEvolution.length,
                chartDataLength: chartData.length,
                hasMetrics: !!metrics,
                currentAsset,
                totalReturn
            });
            
            return `
            <div class="strategy-card">
                <div class="strategy-card-header">
                    <div class="strategy-title-section">
                        <span class="paw-label">PAW SYSTEM</span>
                        <h4 class="strategy-name">${strategy.strategy_name}</h4>
                        ${assetSymbols ? `<p class="strategy-assets">${assetSymbols}</p>` : ''}
                    </div>
                    <span class="strategy-status ${strategyManager.getStatusClass(strategy.displayStatus)}">
                        ${strategyManager.getStatusText(strategy.displayStatus)}
                    </span>
                </div>
                
                ${results ? `
                <div class="strategy-metrics">
                    ${chartData.length > 0 ? `
                    <div class="chart-container">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                    ` : ''}
                    
                    <div class="metric-row" style="grid-template-columns: 1fr 1fr 1fr;">
                        <div class="metric-item">
                            <div class="metric-label">初始资金</div>
                            <div class="metric-value">${strategyManager.formatCurrency(initialAsset)}</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">当前资产</div>
                            <div class="metric-value">${strategyManager.formatCurrency(currentAsset)}</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">总收益率</div>
                            <div class="metric-value ${totalReturn >= 0 ? 'positive' : 'negative'}">${strategyManager.formatPercent(totalReturn)}</div>
                        </div>
                    </div>
                </div>
                ` : `
                <div class="strategy-no-data">
                    <p style="color: var(--text-muted); font-size: 0.875rem; margin: 0.5rem 0;">暂无运行数据</p>
                </div>
                `}
                
                <div class="strategy-actions">
                    <button class="btn-small btn-edit" onclick="editStrategy('${strategy.strategy_id}')">查看详情</button>
                    <button class="btn-small btn-delete" style="background: var(--danger); margin-left: auto;" onclick="deleteStrategy('${strategy.strategy_id}', '${strategy.strategy_name}')">删除</button>
                </div>
            </div>
            `;
        }).join('');
        
        console.log('策略列表HTML已生成');
        
        // 绘制所有图表（使用requestAnimationFrame和setTimeout确保DOM已更新）
        requestAnimationFrame(() => {
            setTimeout(() => {
                strategiesWithData.forEach((strategy, index) => {
                    const canvasId = `chart-${strategy.strategy_id}-${index}`;
                    const canvas = document.getElementById(canvasId);
                    
                    if (canvas && strategy.results && strategy.results.asset_evolution && strategy.results.asset_evolution.length > 0) {
                        const chartData = strategy.results.asset_evolution;
                        const metrics = strategy.results.metrics || {};
                        const totalReturn = metrics.total_return || 0;
                        const chartColor = totalReturn >= 0 ? '#48bb78' : '#f56565';
                        
                        console.log(`Drawing chart for ${strategy.strategy_name}:`, {
                            canvasId,
                            dataLength: chartData.length,
                            firstValue: chartData[0]?.total_value,
                            lastValue: chartData[chartData.length - 1]?.total_value,
                            color: chartColor,
                            canvasFound: !!canvas
                        });
                        
                        strategyManager.drawMiniChart(canvasId, chartData, chartColor);
                    } else {
                        console.log(`No chart for ${strategy.strategy_name}:`, {
                            canvasId,
                            canvasFound: !!canvas,
                            hasResults: !!strategy.results,
                            hasEvolution: !!(strategy.results && strategy.results.asset_evolution),
                            evolutionLength: strategy.results?.asset_evolution?.length || 0
                        });
                    }
                });
            }, 300);
        });
    } catch (error) {
        console.error('Error loading strategies:', error);
        container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 2rem;">加载策略失败：${error.message}<br/>请检查API服务是否正常运行</p>`;
    }
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
        console.log('Creating strategy:', { name, description });
        const result = await strategyManager.createStrategy(name, description);
        console.log('Strategy created:', result);
        
        if (result && result.strategy_id) {
            alert(`✅ 策略创建成功：${result.strategy_id}`);
            // 等待一小段时间确保后端已保存，然后刷新列表
            setTimeout(() => {
                loadStrategies();
            }, 500);
        } else {
            alert('⚠️ 策略创建可能失败，请刷新页面查看');
            loadStrategies();
        }
    } catch (error) {
        console.error('Error creating strategy:', error);
        alert(`❌ 创建策略失败：${error.message}\n\n请检查：\n1. API服务是否正常运行（端口8005）\n2. 控制台是否有更多错误信息`);
    }
});

// 状态检查相关变量
let statusCheckInterval = null;
let strategiesToCheck = new Set(); // 需要检查回测状态的策略ID集合
let lastStatusMap = new Map(); // 记录上次检查的状态，避免重复加载
let isReloading = false; // 防止重复加载的标志
let lastReloadTime = 0; // 上次重新加载的时间戳
const RELOAD_COOLDOWN = 10000; // 重新加载的冷却时间（增加到10秒）
const STATUS_CHECK_INTERVAL = 30000; // 状态检查间隔（增加到30秒）

// 检查并更新策略状态
async function checkAndUpdateStrategyStatuses() {
    // 如果正在加载中，跳过本次检查
    if (isReloading) {
        console.log('⏸️ 正在加载中，跳过状态检查');
        return;
    }
    
    // 检查冷却时间，避免频繁重新加载
    const now = Date.now();
    if (now - lastReloadTime < RELOAD_COOLDOWN) {
        console.log(`⏸️ 冷却时间未到（还需等待 ${Math.ceil((RELOAD_COOLDOWN - (now - lastReloadTime)) / 1000)}秒），跳过检查`);
        return;
    }
    
    // 如果没有需要检查的策略，停止检查并返回
    if (strategiesToCheck.size === 0) {
        console.log('✅ 无需检查的策略，停止状态监控');
        stopStatusChecking();
        return;
    }
    
    try {
        console.log(`🔍 检查 ${strategiesToCheck.size} 个策略的状态...`);
        
        let needsReload = false;
        const strategiesToRemove = [];
        
        // 检查每个需要检查的策略
        for (const strategyId of strategiesToCheck) {
            const runStatus = await strategyManager.checkBacktestStatus(strategyId);
            
            // 获取上次的状态
            const lastStatus = lastStatusMap.get(strategyId);
            const currentStatusKey = runStatus ? `${runStatus.status}_${runStatus.is_running}_${runStatus.progress || 0}` : 'unknown';
            
            // 只在状态真正变化时才标记需要重新加载
            if (lastStatus !== currentStatusKey) {
                console.log(`📊 策略 ${strategyId} 状态变化: ${lastStatus} -> ${currentStatusKey}`);
                lastStatusMap.set(strategyId, currentStatusKey);
                
                if (runStatus) {
                    // 如果回测已完成或失败，从检查列表中移除
                    if (runStatus.status === 'completed' || runStatus.status === 'failed') {
                        console.log(`✅ 策略 ${strategyId} 已完成 (${runStatus.status})，移出监控列表`);
                        strategiesToRemove.push(strategyId);
                        needsReload = true;
                    } else if (!runStatus.is_running && runStatus.status !== 'stopped' && runStatus.status !== 'not_started') {
                        // 如果回测已停止且不是暂停状态，从检查列表中移除
                        console.log(`⏹️ 策略 ${strategyId} 已停止，移出监控列表`);
                        strategiesToRemove.push(strategyId);
                        needsReload = true;
                    }
                }
            }
        }
        
        // 移除已完成的策略
        strategiesToRemove.forEach(id => {
            strategiesToCheck.delete(id);
            lastStatusMap.delete(id);
        });
        
        // 如果所有策略都已完成，停止监控
        if (strategiesToCheck.size === 0) {
            console.log('✅ 所有策略已完成，停止状态监控');
            stopStatusChecking();
        }
        
        // 只有在状态真正变化时才重新加载策略列表
        if (needsReload && !isReloading) {
            console.log('🔄 状态已变化，重新加载策略列表...');
            isReloading = true;
            lastReloadTime = Date.now();
            try {
                await loadStrategies();
            } finally {
                isReloading = false;
            }
        } else {
            console.log('✅ 状态无变化，无需重新加载');
        }
    } catch (error) {
        console.warn('⚠️ 检查策略状态时出错:', error.message);
        isReloading = false;
    }
}

// 启动状态检查
function startStatusChecking() {
    // 使用STATUS_CHECK_INTERVAL检查一次回测状态
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    // 只有在有需要检查的策略时才启动定时器
    if (strategiesToCheck.size > 0) {
        statusCheckInterval = setInterval(checkAndUpdateStrategyStatuses, STATUS_CHECK_INTERVAL);
        console.log(`✅ 状态检查已启动，每${STATUS_CHECK_INTERVAL/1000}秒监控 ${strategiesToCheck.size} 个策略`);
    } else {
        console.log('ℹ️ 无需监控的策略，跳过状态检查');
    }
}

// 停止状态检查
function stopStatusChecking() {
    if (statusCheckInterval) {
        console.log('⏹️ 停止状态检查定时器');
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📋 策略管理器初始化中...');
    
    try {
        await loadStrategies();
        
        // 加载策略后，识别正在回测的策略并初始化状态记录
        try {
            const strategies = await strategyManager.listStrategies();
            const backtestStrategies = strategies.filter(s => s.status === 'backtest');
            
            if (backtestStrategies.length > 0) {
                console.log(`📊 发现 ${backtestStrategies.length} 个正在回测的策略`);
                
                // 初始化状态记录，并检查每个策略的当前状态
                for (const strategy of backtestStrategies) {
                    try {
                        const runStatus = await strategyManager.checkBacktestStatus(strategy.strategy_id);
                        if (runStatus && runStatus.is_running) {
                            // 只监控真正在运行的策略
                            strategiesToCheck.add(strategy.strategy_id);
                            const statusKey = `${runStatus.status}_${runStatus.is_running}_${runStatus.progress || 0}`;
                            lastStatusMap.set(strategy.strategy_id, statusKey);
                            console.log(`✅ 添加策略 ${strategy.strategy_id} 到监控列表，当前状态: ${statusKey}`);
                        } else {
                            console.log(`ℹ️ 策略 ${strategy.strategy_id} 未在运行，跳过监控`);
                        }
                    } catch (error) {
                        console.warn(`⚠️ 检查策略 ${strategy.strategy_id} 状态失败:`, error.message);
                    }
                }
                
                // 如果有需要监控的策略，启动定时器
                if (strategiesToCheck.size > 0) {
                    console.log(`🚀 启动状态监控，监控 ${strategiesToCheck.size} 个策略`);
                    startStatusChecking();
                } else {
                    console.log('✅ 没有需要监控的运行中策略');
                }
            } else {
                console.log('✅ 没有回测中的策略，无需状态监控');
            }
        } catch (error) {
            console.warn('⚠️ 检查策略状态失败:', error.message);
        }
    } catch (error) {
        console.error('❌ 初始化策略管理器失败:', error);
        const container = document.getElementById('strategyList');
        if (container) {
            container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 2rem;">初始化失败：${error.message}<br/>请检查API服务是否正常运行（端口8005）</p>`;
        }
    }
});

// 页面卸载时停止检查
window.addEventListener('beforeunload', () => {
    stopStatusChecking();
});


