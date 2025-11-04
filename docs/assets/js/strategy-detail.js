// Strategy Detail Page
// Handles strategy configuration, asset evolution, and portfolio analysis

class StrategyDetail {
    constructor() {
        this.apiBase = 'http://localhost:8005';
        this.strategyId = this.getStrategyIdFromUrl();
        this.currentMode = 'backtest'; // backtest, simulate, or real
        this.currentConfigMode = 'backtest'; // Mode for config tab
        this.currentTab = 'config';
        this.assetChart = null;
        this.allocationChart = null;
    }

    // Get strategy ID from URL parameters
    getStrategyIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || null;
    }

    // Initialize the page
    async init() {
        if (!this.strategyId) {
            alert('策略ID未指定');
            window.location.href = 'strategies.html';
            return;
        }

        await this.loadStrategyInfo();
        this.setupTabNavigation();
        this.setupModeSelector();
        this.setupEventListeners();
        
        // Update date range visibility on initial load
        if (this.currentTab === 'config') {
            this.updateDateRangeVisibility();
        }
        
        // Update run buttons visibility for asset tab
        if (this.currentTab === 'asset') {
            this.updateAssetRunButtonsVisibility();
        }
        
        // Load initial data based on active tab
        this.loadTabContent(this.currentTab);
    }

    // Load strategy basic information
    async loadStrategyInfo() {
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}`);
            if (!response.ok) throw new Error('Failed to load strategy info');
            
            const strategy = await response.json();
            document.getElementById('strategyName').textContent = `策略: ${strategy.strategy_name || '未命名策略'}`;
        } catch (error) {
            console.error('Error loading strategy info:', error);
            document.getElementById('strategyName').textContent = '策略详情';
        }
    }

    // Setup tab navigation
    setupTabNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }

    // Switch between tabs
    switchTab(tabId) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
        
        this.currentTab = tabId;
        
        // Update run buttons visibility when switching to asset tab
        if (tabId === 'asset') {
            this.updateAssetRunButtonsVisibility();
        }
        
        this.loadTabContent(tabId);
    }

    // Load content for specific tab
    async loadTabContent(tabId) {
        switch (tabId) {
            case 'config':
                await this.loadConfigData();
                break;
            case 'asset':
                await this.loadAssetData();
                break;
            case 'portfolio':
                await this.loadPortfolioData();
                break;
        }
    }

    // Setup mode selector for asset and portfolio tabs
    setupModeSelector() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                const parentTab = btn.closest('.tab-content');
                
                // Update active button within the same tab
                parentTab.querySelectorAll('.mode-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode === mode);
                });
                
                // Handle mode switch based on which tab we're in
                if (parentTab.id === 'config-tab') {
                    this.currentConfigMode = mode;
                    this.updateDateRangeVisibility();
                    this.loadConfigData();
                } else if (parentTab.id === 'asset-tab') {
                    this.currentMode = mode;
                    this.updateAssetRunButtonsVisibility();
                    this.loadAssetData();
                    // Reload log dates when mode changes
                    this.loadAvailableLogDates();
                } else if (parentTab.id === 'portfolio-tab') {
                    this.currentMode = mode;
                    this.loadPortfolioData();
                }
            });
        });
    }

    // Switch between modes (backtest, simulate, real)
    switchMode(mode) {
        // This method is now handled by the setupModeSelector
        this.currentMode = mode;
        
        // Reload data for current tab with new mode
        if (this.currentTab === 'asset') {
            this.loadAssetData();
        } else if (this.currentTab === 'portfolio') {
            this.loadPortfolioData();
        }
    }

    // Update date range visibility based on config mode
    updateDateRangeVisibility() {
        const dateRangeSection = document.getElementById('dateRangeSection');
        if (!dateRangeSection) return;
        
        const hint = dateRangeSection.querySelector('.mode-hint');
        const inputs = dateRangeSection.querySelectorAll('input[type="date"]');
        
        if (this.currentConfigMode === 'backtest') {
            // Show date range inputs for backtest
            dateRangeSection.style.display = 'block';
            if (hint) hint.style.display = 'none';
            inputs.forEach(input => input.disabled = false);
        } else {
            // Hide date range inputs for simulate/real
            dateRangeSection.style.display = 'block'; // Keep section visible but show hint
            if (hint) hint.style.display = 'block';
            inputs.forEach(input => {
                input.disabled = true;
                input.value = ''; // Clear values
            });
        }
    }
    
    // Update run button visibility based on config mode (for config tab)
    updateRunButtonsVisibility() {
        // This is now unused, but kept for backward compatibility
        // Run buttons are now in asset tab
    }
    
    // Update run button visibility based on asset mode (for asset tab)
    updateAssetRunButtonsVisibility() {
        const runBacktestBtn = document.getElementById('runBacktestBtn');
        const runSimulateBtn = document.getElementById('runSimulateBtn');
        const runRealBtn = document.getElementById('runRealBtn');
        
        // Hide all buttons first
        if (runBacktestBtn) runBacktestBtn.style.display = 'none';
        if (runSimulateBtn) runSimulateBtn.style.display = 'none';
        if (runRealBtn) runRealBtn.style.display = 'none';
        
        // Show button for current asset mode (only in asset tab)
        if (this.currentTab === 'asset') {
            if (this.currentMode === 'backtest' && runBacktestBtn) {
                runBacktestBtn.style.display = 'inline-block';
            } else if (this.currentMode === 'simulate' && runSimulateBtn) {
                runSimulateBtn.style.display = 'inline-block';
            } else if (this.currentMode === 'real' && runRealBtn) {
                runRealBtn.style.display = 'inline-block';
            }
        }
    }

    // Load configuration data
    async loadConfigData() {
        try {
            // Update date range visibility first
            this.updateDateRangeVisibility();
            
            // Load config from API for the current config mode
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/config/${this.currentConfigMode}`);
            
            let config = null;
            if (response.ok) {
                const data = await response.json();
                config = data.config || data; // Handle both formats
            } else {
                console.warn('No config found, using defaults');
            }
            
            // Populate form fields (use defaults if config is null)
            if (config && config.agent_config) {
                document.getElementById('maxSteps').value = config.agent_config.max_steps || 30;
                document.getElementById('maxRetries').value = config.agent_config.max_retries || 3;
                document.getElementById('baseDelay').value = config.agent_config.base_delay || 1.0;
                document.getElementById('initialCash').value = config.agent_config.initial_cash || 10000;
            } else {
                // Use defaults
                document.getElementById('maxSteps').value = 30;
                document.getElementById('maxRetries').value = 3;
                document.getElementById('baseDelay').value = 1.0;
                document.getElementById('initialCash').value = 10000;
            }
            
            // Only load date range for backtest mode
            if (this.currentConfigMode === 'backtest') {
                if (config && config.date_range) {
                    document.getElementById('startDate').value = config.date_range.init_date || '';
                    document.getElementById('endDate').value = config.date_range.end_date || '';
                } else {
                    document.getElementById('startDate').value = '';
                    document.getElementById('endDate').value = '';
                }
            }
            
            // Load prompt
            const promptResponse = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/prompt/${this.currentConfigMode}`);
            if (promptResponse.ok) {
                const promptData = await promptResponse.json();
                document.getElementById('systemPrompt').value = promptData.prompt || '';
            } else {
                document.getElementById('systemPrompt').value = '';
            }
        } catch (error) {
            console.error('Error loading config:', error);
            // Set defaults on error
            document.getElementById('maxSteps').value = 30;
            document.getElementById('maxRetries').value = 3;
            document.getElementById('baseDelay').value = 1.0;
            document.getElementById('initialCash').value = 10000;
        }
    }

    // Load asset evolution data
    async loadAssetData() {
        const assetTab = document.getElementById('asset-tab');
        
        // Show loading state
        const metricsGrid = assetTab.querySelector('.metrics-grid');
        
        if (metricsGrid) {
            metricsGrid.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">加载中...</div>';
        }
        
        try {
            // Load from real API
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/results/${this.currentMode}`);
            if (!response.ok) throw new Error('Failed to load asset data');
            
            const data = await response.json();
            
            if (!data.has_data || !data.results) {
                // Show empty state
                this.showEmptyAssetState();
                return;
            }
            
            const results = data.results;
            
            // Use metrics from API or calculate from asset evolution
            if (results.metrics) {
                this.updateAssetMetrics(results.metrics);
            } else if (results.asset_evolution && results.asset_evolution.length > 0) {
                // Calculate metrics from asset evolution data
                const evolution = results.asset_evolution;
                const initialValue = evolution[0].total_value || 10000;
                const currentValue = evolution[evolution.length - 1].total_value || initialValue;
                const totalReturn = ((currentValue - initialValue) / initialValue) * 100;
                
                // Calculate max drawdown
                let maxDrawdown = 0;
                let peak = evolution[0].total_value;
                for (const point of evolution) {
                    if (point.total_value > peak) {
                        peak = point.total_value;
                    }
                    const drawdown = ((point.total_value - peak) / peak) * 100;
                    if (drawdown < maxDrawdown) {
                        maxDrawdown = drawdown;
                    }
                }
                
                this.updateAssetMetrics({
                    initialValue: initialValue,
                    currentValue: currentValue,
                    totalReturn: totalReturn,
                    maxDrawdown: maxDrawdown,
                    sharpeRatio: 0, // TODO: Calculate Sharpe ratio
                    tradingDays: evolution.length
                });
            } else {
                // Use placeholder data if no real data
                this.showEmptyAssetState();
                return;
            }
            
            // Render chart with real data
            if (results.asset_evolution) {
                this.renderAssetChart(results.asset_evolution);
            }
        } catch (error) {
            console.error('Error loading asset data:', error);
            this.showAssetError(error.message);
        } finally {
            // Always try to load log dates, even if asset data failed
            await this.loadAvailableLogDates();
        }
    }
    
    // Load available log dates
    async loadAvailableLogDates() {
        const selector = document.getElementById('logDateSelector');
        if (!selector) return;
        
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/logs/dates/${this.currentMode}`);
            if (!response.ok) {
                console.warn('No log dates available:', response.status, response.statusText);
                selector.innerHTML = '<option value="">暂无日志日期</option>';
                return;
            }
            
            const data = await response.json();
            
            if (!data.success) {
                console.error('API returned error:', data.error);
                selector.innerHTML = '<option value="">加载失败</option>';
                return;
            }
            
            const dates = data.dates || [];
            
            if (dates.length === 0) {
                selector.innerHTML = '<option value="">暂无日志</option>';
                return;
            }
            
            // Populate date selector (most recent first)
            selector.innerHTML = '<option value="">请选择日期</option>' + 
                dates.slice().reverse().map(date => 
                    `<option value="${date}">${date}</option>`
                ).join('');
            
            // Add event listener for date selection
            selector.onchange = () => {
                const selectedDate = selector.value;
                if (selectedDate) {
                    this.loadThinkingLogs(selectedDate);
                } else {
                    this.clearThinkingLogs();
                }
            };
        } catch (error) {
            console.error('Error loading log dates:', error);
            selector.innerHTML = '<option value="">加载失败，请刷新页面重试</option>';
        }
    }
    
    // Load thinking logs for a specific date
    async loadThinkingLogs(date) {
        const container = document.getElementById('thinkingLogsContainer');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">加载中...</div>';
        
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/logs/${this.currentMode}/${date}`);
            if (!response.ok) throw new Error('Failed to load logs');
            
            const data = await response.json();
            const logs = data.logs || [];
            
            if (logs.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">该日期暂无日志记录</p>';
                return;
            }
            
            // Render logs
            container.innerHTML = logs.map((log, index) => {
                const timestamp = log.timestamp || '';
                const messages = log.new_messages || [];
                const signature = log.signature || '';
                
                return `
                    <div class="log-entry" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--card-bg); border-radius: 8px; border-left: 3px solid var(--accent-blue);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">
                                ${timestamp ? new Date(timestamp).toLocaleString('zh-CN') : '未知时间'}
                            </span>
                            <span style="color: var(--accent-blue); font-size: 0.75rem; background: var(--secondary-bg); padding: 0.25rem 0.5rem; border-radius: 4px;">
                                ${signature}
                            </span>
                        </div>
                        ${messages.map(msg => {
                            const role = msg.role || 'unknown';
                            const content = msg.content || '';
                            const roleColor = role === 'user' ? 'var(--accent-blue)' : 
                                           role === 'assistant' ? 'var(--accent-green)' : 
                                           'var(--text-secondary)';
                            const roleText = role === 'user' ? '用户' : 
                                          role === 'assistant' ? 'AI' : 
                                          role;
                            
                            return `
                                <div style="margin-bottom: 0.5rem; padding: 0.75rem; background: var(--secondary-bg); border-radius: 6px;">
                                    <div style="color: ${roleColor}; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem;">
                                        ${roleText}
                                    </div>
                                    <div style="color: var(--text-primary); white-space: pre-wrap; font-size: 0.875rem; line-height: 1.6;">
                                        ${this.formatLogContent(content)}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading thinking logs:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger);">
                    <p>❌ 加载日志失败</p>
                    <p style="font-size: 0.875rem; margin-top: 0.5rem;">${error.message}</p>
                </div>
            `;
        }
    }
    
    // Format log content (handle markdown, code blocks, etc.)
    formatLogContent(content) {
        if (!content) return '';
        
        // Escape HTML
        let formatted = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Highlight code blocks (basic)
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre style="background: var(--secondary-bg); padding: 0.5rem; border-radius: 4px; overflow-x: auto; margin: 0.5rem 0;"><code>$1</code></pre>');
        
        // Highlight inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: var(--secondary-bg); padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.85em;">$1</code>');
        
        // Convert line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }
    
    // Clear thinking logs display
    clearThinkingLogs() {
        const container = document.getElementById('thinkingLogsContainer');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">请选择日期查看 AI 思考日志</p>';
        }
    }
    
    // Show empty state for asset data
    showEmptyAssetState() {
        const metricsGrid = document.querySelector('#asset-tab .metrics-grid');
        if (metricsGrid) {
            metricsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <p style="font-size: 1.2rem; margin-bottom: 1rem;">📊 暂无数据</p>
                    <p>该模式尚未运行或还没有生成结果</p>
                    <p style="margin-top: 1rem;">请先运行策略以生成数据</p>
                </div>
            `;
        }
        
        // Clear chart
        if (this.assetChart) {
            this.assetChart.destroy();
            this.assetChart = null;
        }
    }
    
    // Show error state for asset data
    showAssetError(message) {
        const metricsGrid = document.querySelector('#asset-tab .metrics-grid');
        if (metricsGrid) {
            metricsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--danger);">
                    <p style="font-size: 1.2rem; margin-bottom: 1rem;">❌ 加载失败</p>
                    <p>${message || '无法加载资产数据'}</p>
                    <button onclick="strategyDetail.loadAssetData()" class="btn-secondary" style="margin-top: 1rem;">重试</button>
                </div>
            `;
        }
    }

    // Update asset metrics display
    updateAssetMetrics(metrics) {
        const metricsGrid = document.querySelector('#asset-tab .metrics-grid');
        if (!metricsGrid) return;
        
        metricsGrid.innerHTML = `
            <div class="metric-card">
                <div class="metric-label">初始资金</div>
                <div class="metric-value">$${metrics.initialValue.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">当前资产</div>
                <div class="metric-value">$${metrics.currentValue.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">总收益率</div>
                <div class="metric-value ${metrics.totalReturn >= 0 ? 'positive' : 'negative'}">
                    ${metrics.totalReturn >= 0 ? '+' : ''}${metrics.totalReturn.toFixed(2)}%
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">最大回撤</div>
                <div class="metric-value negative">${metrics.maxDrawdown.toFixed(2)}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">夏普比率</div>
                <div class="metric-value">${metrics.sharpeRatio.toFixed(2)}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">交易天数</div>
                <div class="metric-value">${metrics.tradingDays}</div>
            </div>
        `;
    }

    // Render asset evolution chart
    renderAssetChart(assetData = null) {
        const ctx = document.getElementById('assetChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.assetChart) {
            this.assetChart.destroy();
        }
        
        let dates = [];
        let values = [];
        
        if (assetData && assetData.length > 0) {
            // Use real data
            dates = assetData.map(point => point.date || point.timestamp || '');
            values = assetData.map(point => point.total_value || point.value || 0);
        } else {
            // Generate sample data as fallback
            const baseValue = 10000;
            let currentValue = baseValue;
            
            for (let i = 0; i < 60; i++) {
                const date = new Date();
                date.setDate(date.getDate() - (60 - i));
                dates.push(date.toISOString().split('T')[0]);
                
                // Simulate random walk with upward bias
                const change = (Math.random() - 0.45) * 0.02; // Slight upward bias
                currentValue = currentValue * (1 + change);
                values.push(currentValue);
            }
        }
        
        this.assetChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: '资产价值',
                    data: values,
                    borderColor: 'rgb(0, 212, 255)',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `资产价值: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#a0aec0',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#a0aec0',
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Load portfolio data
    async loadPortfolioData() {
        const tbody = document.getElementById('holdingsTableBody');
        
        // Show loading state
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">加载中...</td></tr>';
        }
        
        try {
            // Load from real API
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/results/${this.currentMode}`);
            if (!response.ok) throw new Error('Failed to load portfolio data');
            
            const data = await response.json();
            
            if (!data.has_data || !data.results || !data.results.portfolio) {
                // Show empty state
                this.showEmptyPortfolioState();
                return;
            }
            
            const portfolio = data.results.portfolio;
            
            // Render holdings table with real data
            if (portfolio.holdings) {
                this.renderHoldingsTable(portfolio.holdings);
            } else if (portfolio.positions) {
                this.renderHoldingsTable(portfolio.positions);
            } else {
                this.showEmptyPortfolioState();
            }
            
            // Render allocation chart
            if (portfolio.allocations || portfolio.holdings) {
                this.renderAllocationChart(portfolio.allocations || portfolio.holdings);
            }
        } catch (error) {
            console.error('Error loading portfolio data:', error);
            this.showPortfolioError(error.message);
        }
    }
    
    // Show empty state for portfolio
    showEmptyPortfolioState() {
        const tbody = document.getElementById('holdingsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        <p style="font-size: 1.2rem; margin-bottom: 1rem;">💼 暂无持仓数据</p>
                        <p>该模式尚未运行或还没有持仓信息</p>
                    </td>
                </tr>
            `;
        }
        
        // Clear chart
        if (this.allocationChart) {
            this.allocationChart.destroy();
            this.allocationChart = null;
        }
    }
    
    // Show error state for portfolio
    showPortfolioError(message) {
        const tbody = document.getElementById('holdingsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem; color: var(--danger);">
                        <p style="font-size: 1.2rem; margin-bottom: 1rem;">❌ 加载失败</p>
                        <p>${message || '无法加载投资组合数据'}</p>
                        <button onclick="strategyDetail.loadPortfolioData()" class="btn-secondary" style="margin-top: 1rem;">重试</button>
                    </td>
                </tr>
            `;
        }
    }

    // Render holdings table
    renderHoldingsTable(holdings = null) {
        const tbody = document.getElementById('holdingsTableBody');
        if (!tbody) return;
        
        // Use real data or sample data
        if (!holdings || holdings.length === 0) {
            // Sample holdings data as fallback
            holdings = [
                { symbol: 'AAPL', shares: 50, cost: 150, current: 175, pnl: 1250, pnlPercent: 16.67 },
                { symbol: 'GOOGL', shares: 20, cost: 2800, current: 2950, pnl: 3000, pnlPercent: 5.36 },
                { symbol: 'MSFT', shares: 30, cost: 350, current: 380, pnl: 900, pnlPercent: 8.57 }
            ];
        }
        
        tbody.innerHTML = holdings.map(h => `
            <tr>
                <td style="color: var(--accent-blue); font-weight: 700;">${h.symbol}</td>
                <td>${h.shares}</td>
                <td>$${h.cost.toFixed(2)}</td>
                <td>$${h.current.toFixed(2)}</td>
                <td>$${(h.shares * h.current).toLocaleString()}</td>
                <td class="${h.pnl >= 0 ? 'positive' : 'negative'}">
                    ${h.pnl >= 0 ? '+' : ''}$${h.pnl.toLocaleString()}
                </td>
                <td class="${h.pnlPercent >= 0 ? 'positive' : 'negative'}">
                    ${h.pnlPercent >= 0 ? '+' : ''}${h.pnlPercent.toFixed(2)}%
                </td>
            </tr>
        `).join('');
    }

    // Render allocation chart
    renderAllocationChart() {
        const ctx = document.getElementById('allocationChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.allocationChart) {
            this.allocationChart.destroy();
        }
        
        this.allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['AAPL', 'GOOGL', 'MSFT', 'CASH'],
                datasets: [{
                    data: [8750, 5900, 11400, 2000],
                    backgroundColor: [
                        '#00d4ff',
                        '#00ffcc',
                        '#ff006e',
                        '#8338ec'
                    ],
                    borderWidth: 2,
                    borderColor: '#1a2238'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#a0aec0',
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: $${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Setup event listeners
    setupEventListeners() {
        // Save configuration button
        document.querySelector('.btn-save')?.addEventListener('click', async () => {
            await this.saveConfiguration();
        });
        
        // Reset configuration button
        document.querySelector('.btn-secondary')?.addEventListener('click', () => {
            if (confirm('确定要重置配置吗？')) {
                this.loadConfigData();
            }
        });
        
        // Restart service button
        document.getElementById('restartServiceBtn')?.addEventListener('click', () => {
            this.restartService();
        });
        
        // Run strategy buttons
        document.getElementById('runBacktestBtn')?.addEventListener('click', () => {
            this.runStrategy('backtest');
        });
        
        document.getElementById('runSimulateBtn')?.addEventListener('click', () => {
            this.runStrategy('simulate');
        });
        
        document.getElementById('runRealBtn')?.addEventListener('click', () => {
            this.runStrategy('real');
        });
    }

    // Save configuration
    async saveConfiguration() {
        try {
            const config = {
                agent_config: {
                    max_steps: parseInt(document.getElementById('maxSteps').value),
                    max_retries: parseInt(document.getElementById('maxRetries').value),
                    base_delay: parseFloat(document.getElementById('baseDelay').value),
                    initial_cash: parseFloat(document.getElementById('initialCash').value)
                }
            };
            
            // Only include date_range for backtest mode
            if (this.currentConfigMode === 'backtest') {
                config.date_range = {
                    init_date: document.getElementById('startDate').value,
                    end_date: document.getElementById('endDate').value
                };
            }
            
            // Save config to the correct mode
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/config/${this.currentConfigMode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });
            
            if (!response.ok) throw new Error('Failed to save configuration');
            
            // Save prompt
            const promptText = document.getElementById('systemPrompt').value;
            await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/prompt/${this.currentConfigMode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptText })
            });
            
            // Reload config to show saved values
            await this.loadConfigData();
            
            // Show success message and restart button
            document.getElementById('config-message').style.display = 'block';
            document.getElementById('restartServiceBtn').style.display = 'inline-block';
            
            alert('✅ 配置已保存，需要重启服务才能生效');
        } catch (error) {
            console.error('Error saving configuration:', error);
            alert('保存失败: ' + error.message);
        }
    }
    
    // Run strategy in specific mode
    async runStrategy(mode) {
        // Special confirmation for real trading
        if (mode === 'real') {
            const confirmed = confirm(
                '⚠️ 确定要启动实盘交易吗？\n\n' +
                '这将使用真实资金并执行真实交易。\n\n' +
                '请确保：\n' +
                '1. 已充分测试策略\n' +
                '2. 已配置风险控制参数\n' +
                '3. 已准备好承担交易风险\n\n' +
                '是否继续？'
            );
            if (!confirmed) {
                return;
            }
        } else if (mode === 'simulate') {
            const confirmed = confirm(
                '确定要启动模拟盘交易吗？\n\n' +
                '这将使用实时市场数据进行模拟交易。'
            );
            if (!confirmed) {
                return;
            }
        } else {
            const confirmed = confirm(
                '确定要启动回测吗？\n\n' +
                '这将使用历史数据运行策略回测。'
            );
            if (!confirmed) {
                return;
            }
        }
        
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/run/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: mode === 'real' })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to run ${mode}`);
            }
            
            const result = await response.json();
            const modeText = mode === 'backtest' ? '回测' : mode === 'simulate' ? '模拟盘' : '实盘';
            
            alert(`✅ ${modeText}已启动！\n\n请稍后查看结果。`);
            
            // Switch to asset tab to see results
            setTimeout(() => {
                this.switchTab('asset');
                this.currentMode = mode;
                // Update mode selector active state
                document.querySelectorAll('#asset-tab .mode-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === mode);
                });
                // Update run buttons visibility
                this.updateAssetRunButtonsVisibility();
                // Reload asset data
                this.loadAssetData();
            }, 1000);
        } catch (error) {
            console.error(`Error running ${mode}:`, error);
            alert(`❌ 启动${mode === 'backtest' ? '回测' : mode === 'simulate' ? '模拟盘' : '实盘'}失败：${error.message}`);
        }
    }
    
    // Restart service
    async restartService() {
        if (!confirm('确定要重启服务吗？这将停止当前运行的策略。')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/api/restart-service`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy_id: this.strategyId })
            });
            
            if (!response.ok) throw new Error('Failed to restart service');
            
            const result = await response.json();
            
            // Hide restart button and message
            document.getElementById('config-message').style.display = 'none';
            document.getElementById('restartServiceBtn').style.display = 'none';
            
            alert('✅ ' + result.message);
        } catch (error) {
            console.error('Error restarting service:', error);
            alert('❌ 重启服务失败：' + error.message);
        }
    }
}

// Initialize when page loads
const strategyDetail = new StrategyDetail();
document.addEventListener('DOMContentLoaded', () => {
    strategyDetail.init();
});