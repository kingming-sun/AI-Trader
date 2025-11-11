// Strategy Detail Page
// Handles strategy configuration, asset evolution, and portfolio analysis

class StrategyDetail {
    constructor() {
        // Use API_CONFIG if available (from api-config.js), otherwise fallback to localhost
        this.apiBase = window.API_CONFIG?.strategyApi || 'http://localhost:8005';
        this.strategyId = this.getStrategyIdFromUrl();
        
        // Initialize with defaults, will parse URL in init()
        this.currentTab = 'asset';
        this.currentMode = 'backtest';
        this.currentConfigMode = 'backtest';
        
        this.assetChart = null;
        this.allocationChart = null;
        this.statusCheckInterval = null; // 状态检查定时器
        this.isRunning = false; // 是否正在运行
        this.lastAssetUpdate = 0; // 上次资产数据更新时间
        this.statusCheckRetries = 0; // 状态检查重试计数
        this.statusCheckStartTime = 0; // 状态检查开始时间
        this.maxMonitoringTime = 3600000; // 最大监控时间（1小时）
        this.statusStuckCount = 0; // 状态卡住计数
        this.lastStatusLog = null; // 上次状态日志
        this.progressStuckCount = 0; // 进度卡住计数
        this.lastProgress = null; // 上次进度值
    }
    
    // Parse URL hash to get tab and mode state
    parseUrlState() {
        const hash = window.location.hash.slice(1); // Remove '#'
        const [tab, mode] = hash.split('/');
        
        console.log(`🌐 Parsing URL state - Hash: ${hash}, Tab: ${tab}, Mode: ${mode}`);
        
        // Simple validation for tabs without DOM dependency
        const validTabs = ['config', 'asset', 'portfolio'];
        
        // Set current tab
        if (tab && validTabs.includes(tab)) {
            this.currentTab = tab;
        } else {
            this.currentTab = 'asset'; // Default to asset tab
        }
        
        // Set current mode for each tab type
        if (mode && ['backtest', 'simulate', 'real'].includes(mode)) {
            // Mode from URL takes priority
            this.currentMode = mode;
            this.currentConfigMode = mode;
            console.log(`📊 Loaded mode from URL: ${mode}`);
            // Save to localStorage for persistence
            localStorage.setItem(`strategy_${this.strategyId}_mode`, mode);
        } else {
            // Load saved mode from localStorage if available
            const savedMode = localStorage.getItem(`strategy_${this.strategyId}_mode`);
            if (savedMode && ['backtest', 'simulate', 'real'].includes(savedMode)) {
                this.currentMode = savedMode;
                this.currentConfigMode = savedMode;
                console.log(`💾 Loaded mode from localStorage: ${savedMode}`);
            } else {
                this.currentMode = 'backtest'; // Default mode
                this.currentConfigMode = 'backtest';
                console.log(`📌 Using default mode: backtest`);
                // Save default to localStorage
                localStorage.setItem(`strategy_${this.strategyId}_mode`, 'backtest');
            }
        }
        
        // Update URL with complete state (only if not already correct)
        const expectedHash = `${this.currentTab}/${this.currentMode}`;
        if (window.location.hash.slice(1) !== expectedHash) {
            window.location.hash = expectedHash;
            console.log(`🔄 Updated URL hash to: ${expectedHash}`);
        }
        
        console.log(`✅ Final state - Tab: ${this.currentTab}, Mode: ${this.currentMode}, ConfigMode: ${this.currentConfigMode}`);
    }
    
    // Update URL hash with current tab and mode
    updateUrlState() {
        const mode = this.currentTab === 'config' ? this.currentConfigMode : this.currentMode;
        const newHash = `${this.currentTab}/${mode}`;
        if (window.location.hash.slice(1) !== newHash) {
            window.location.hash = newHash;
            console.log(`🌐 URL state updated to: ${newHash}`);
        }
    }
    
    // Update mode buttons to reflect current state
    updateModeButtons() {
        console.log(`🔄 updateModeButtons - currentMode: ${this.currentMode}, currentConfigMode: ${this.currentConfigMode}`);
        
        // Update mode buttons in all tabs
        document.querySelectorAll('#config-tab .mode-btn').forEach(btn => {
            const isActive = btn.dataset.mode === this.currentConfigMode;
            btn.classList.toggle('active', isActive);
            if (isActive) console.log(`✅ Config tab: ${btn.dataset.mode} is active`);
        });
        document.querySelectorAll('#asset-tab .mode-btn').forEach(btn => {
            const isActive = btn.dataset.mode === this.currentMode;
            btn.classList.toggle('active', isActive);
            if (isActive) console.log(`✅ Asset tab: ${btn.dataset.mode} is active`);
        });
        document.querySelectorAll('#portfolio-tab .mode-btn').forEach(btn => {
            const isActive = btn.dataset.mode === this.currentMode;
            btn.classList.toggle('active', isActive);
            if (isActive) console.log(`✅ Portfolio tab: ${btn.dataset.mode} is active`);
        });
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

        // Parse URL state now that DOM is ready
        this.parseUrlState();
        
        // Update active tab visually based on currentTab from parseUrlState
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === this.currentTab);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${this.currentTab}-tab`);
        });
        
        // Update active mode buttons based on saved state
        this.updateModeButtons();

        await this.loadStrategyInfo();
        this.setupTabNavigation();
        this.setupModeSelector();
        this.setupEventListeners();
        
        // Update date range visibility on initial load
        if (this.currentTab === 'config') {
            this.updateDateRangeVisibility();
        }
        
        // Update run buttons visibility for asset tab - this will also show date config for backtest mode
        if (this.currentTab === 'asset') {
            // Force update the mode buttons first to ensure correct state
            this.updateModeButtons();
            // Then update visibility
            this.updateAssetRunButtonsVisibility();
        }
        
        // Load initial data based on active tab
        this.loadTabContent(this.currentTab);
        
        // Check if there's a running strategy when loading asset tab
        if (this.currentTab === 'asset') {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                this.checkRunStatusOnLoad();
            }, 500);
        }
    }
    
    // Check run status on page load
    async checkRunStatusOnLoad() {
        try {
            console.log(`🔍 Checking run status on load for ${this.currentMode}...`);
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/status/${this.currentMode}`);
            if (response.ok) {
                const data = await response.json();
                console.log('📊 Run status response:', data);
                if (data.success && data.status) {
                    const status = data.status;
                    
                    // Update backtest buttons visibility based on status
                    if (this.currentMode === 'backtest' && this.currentTab === 'asset') {
                        this.updateBacktestButtonsByStatus(status);
                    }
                    
                    if (status.is_running) {
                        console.log('✅ Strategy is running, starting status monitoring...');
                        this.showRunStatus(this.currentMode);
                        this.startStatusMonitoring(this.currentMode);
                        // Update display immediately
                        this.updateRunStatusDisplay(status, this.currentMode);
                    } else {
                        console.log(`ℹ️  Strategy is not running (status: ${status.status})`);
                        // Show status container even if not running (to display progress bar persistently)
                        const container = document.getElementById('runStatusContainer');
                        if (container && (status.progress !== undefined || status.status === 'completed' || status.status === 'stopped')) {
                            container.style.display = 'block';
                        }
                        // Still update display to show the current state
                        this.updateRunStatusDisplay(status, this.currentMode);
                    }
                } else {
                    console.warn('⚠️  Status check response format unexpected:', data);
                }
            } else {
                console.error('❌ Status check failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Error checking run status on load:', error);
        }
    }

    // Load strategy basic information
    async loadStrategyInfo() {
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}`);
            if (!response.ok) throw new Error('Failed to load strategy info');
            
            const data = await response.json();
            // API returns {success: true, config: {...}} or {config: {...}}
            const config = data.config || data;
            const strategyName = config.strategy_name || '未命名策略';
            document.getElementById('strategyName').textContent = `策略: ${strategyName}`;
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
        
        // Update URL to preserve state
        this.updateUrlState();
        
        // Update run buttons visibility when switching to asset tab
        if (tabId === 'asset') {
            this.updateAssetRunButtonsVisibility();
        }
        
        this.loadTabContent(tabId);
    }

    // Load content for specific tab
    async loadTabContent(tabId) {
        console.log(`📂 Loading tab content for: ${tabId}`);
        switch (tabId) {
            case 'config':
                // Small delay to ensure DOM is ready
                await new Promise(resolve => setTimeout(resolve, 100));
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
                
                // Save mode to localStorage
                localStorage.setItem(`strategy_${this.strategyId}_mode`, mode);
                
                // Update URL to preserve mode state
                this.updateUrlState();
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

    // Update date range visibility based on config mode (removed - now handled in asset page)
    updateDateRangeVisibility() {
        // This function is kept for compatibility but no longer does anything
        // Date configuration has been moved to the asset page
    }
    
    // Load available data range from server
    async loadAvailableDataRange() {
        try {
            const response = await fetch(`${this.apiBase}/api/data/available-range`);
            if (!response.ok) return;
            
            const data = await response.json();
            const rangeText = document.getElementById('availableRangeText');
            
            if (rangeText) {
                if (data.available) {
                    rangeText.innerHTML = `
                        <div><strong>本地数据范围：</strong></div>
                        <div style="padding-left: 1rem;">
                            <div>开始: ${data.start_date}</div>
                            <div>结束: ${data.end_date}</div>
                        </div>
                        <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--accent-cyan);">
                            ✨ 可以选择超出此范围的日期，缺失数据将自动从 API 获取
                        </div>
                    `;
                    
                    // 不再设置 min/max 限制，允许选择超出本地范围的日期
                    const startInput = document.getElementById('startDate');
                    const endInput = document.getElementById('endDate');
                    
                    if (startInput && endInput) {
                        // 移除日期限制，允许选择任意日期
                        startInput.removeAttribute('min');
                        startInput.removeAttribute('max');
                        endInput.removeAttribute('min');
                        endInput.removeAttribute('max');
                    }
                } else {
                    rangeText.innerHTML = `
                        <div style="color: var(--warning);">⚠️ 本地没有缓存数据</div>
                        <div style="margin-top: 0.5rem; font-size: 0.9rem;">将完全依赖 API 获取数据（可能较慢）</div>
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading available data range:', error);
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
        const stopBacktestBtn = document.getElementById('stopBacktestBtn');
        const resumeBacktestBtn = document.getElementById('resumeBacktestBtn');
        const runSimulateBtn = document.getElementById('runSimulateBtn');
        const runRealBtn = document.getElementById('runRealBtn');
        const buttonHint = document.getElementById('buttonHint');
        const modeDescText = document.getElementById('modeDescText');
        const assetModeDescText = document.getElementById('assetModeDescText');
        const backtestDateConfig = document.getElementById('backtestDateConfig');
        const realtimeConfig = document.getElementById('realtimeConfig');
        const realtimeConfigDesc = document.getElementById('realtimeConfigDesc');
        
        console.log(`🎯 updateAssetRunButtonsVisibility called - Current mode: ${this.currentMode}, Current tab: ${this.currentTab}`);
        console.log(`📍 DOM elements found:`, {
            backtestDateConfig: !!backtestDateConfig,
            realtimeConfig: !!realtimeConfig,
            runBacktestBtn: !!runBacktestBtn,
            stopBacktestBtn: !!stopBacktestBtn,
            resumeBacktestBtn: !!resumeBacktestBtn,
            runSimulateBtn: !!runSimulateBtn,
            runRealBtn: !!runRealBtn
        });
        
        // Hide all buttons first
        if (runBacktestBtn) runBacktestBtn.style.display = 'none';
        if (stopBacktestBtn) stopBacktestBtn.style.display = 'none';
        if (resumeBacktestBtn) resumeBacktestBtn.style.display = 'none';
        if (runSimulateBtn) runSimulateBtn.style.display = 'none';
        if (runRealBtn) runRealBtn.style.display = 'none';
        
        // Update mode descriptions and show button for current mode
        if (this.currentTab === 'asset') {
            let modeDesc = '';
            let btnHint = '';
            
            console.log(`🔍 updateAssetRunButtonsVisibility - Processing mode: ${this.currentMode}`);
            
            if (this.currentMode === 'backtest') {
                // Show backtest button and date config
                if (runBacktestBtn) {
                    runBacktestBtn.style.display = 'inline-block';
                    console.log('✅ Showing backtest button');
                }
                if (backtestDateConfig) {
                    backtestDateConfig.style.display = 'block';
                    console.log('✅ Showing backtest date config');
                } else {
                    console.error('❌ backtestDateConfig element not found!');
                }
                if (realtimeConfig) {
                    realtimeConfig.style.display = 'none';
                    console.log('✅ Hiding realtime config');
                }
                
                modeDesc = '<strong>回测模式：</strong>使用历史数据验证策略，需设置日期范围';
                btnHint = '提示：将处理配置的日期范围内的所有交易日';
                
                if (modeDescText) {
                    modeDescText.innerHTML = `
                        <div>📊 <strong>回测模式</strong></div>
                        <div style="margin-top: 0.5rem;">✅ 使用历史数据 (merged.jsonl)</div>
                        <div>✅ 设置日期范围进行测试</div>
                        <div>✅ 处理完所有日期后自动结束</div>
                        <div>✅ 无资金风险</div>
                    `;
                }
                
                // Load available data range for backtest
                this.loadAvailableDataRangeForAsset();
                
                // Load saved backtest dates
                this.loadBacktestDatesForAsset();
                
            } else if (this.currentMode === 'simulate') {
                // Show simulate button and realtime config
                if (runSimulateBtn) {
                    runSimulateBtn.style.display = 'inline-block';
                    console.log('✅ Showing simulate button');
                }
                if (backtestDateConfig) {
                    backtestDateConfig.style.display = 'none';
                    console.log('✅ Hiding backtest date config');
                }
                if (realtimeConfig) {
                    realtimeConfig.style.display = 'block';
                    console.log('✅ Showing realtime config');
                }
                
                modeDesc = '<strong>模拟盘模式：</strong>从当前时间开始，使用实时数据进行模拟交易';
                btnHint = '提示：从当前时间开始，使用实时数据进行模拟交易';
                
                if (modeDescText) {
                    modeDescText.innerHTML = `
                        <div>🎯 <strong>模拟盘模式</strong></div>
                        <div style="margin-top: 0.5rem;">✅ 使用 Alpha Vantage API 获取市场数据</div>
                        <div>✅ 从当前时间开始交易</div>
                        <div>✅ 持续运行直到手动停止</div>
                        <div>✅ 模拟账户，无真实资金</div>
                    `;
                }
                
                if (realtimeConfigDesc) {
                    const today = new Date().toISOString().split('T')[0];
                    realtimeConfigDesc.innerHTML = `
                        <div>📅 开始日期: <strong>${today}</strong> (今天)</div>
                        <div style="margin-top: 0.5rem;">🔄 持续运行，无结束日期</div>
                        <div style="margin-top: 0.5rem; color: var(--accent-cyan);">ℹ️ 系统将使用 Alpha Vantage API 获取市场数据</div>
                    `;
                }
                
            } else if (this.currentMode === 'real') {
                // Show real button and realtime config
                if (runRealBtn) runRealBtn.style.display = 'inline-block';
                if (backtestDateConfig) backtestDateConfig.style.display = 'none';
                if (realtimeConfig) realtimeConfig.style.display = 'block';
                
                modeDesc = '<strong>实盘模式：</strong>从当前时间开始，使用真实资金进行交易';
                btnHint = '⚠️ 警告：将从当前时间开始使用真实资金交易';
                
                if (modeDescText) {
                    modeDescText.innerHTML = `
                        <div>⚡ <strong>实盘模式</strong></div>
                        <div style="margin-top: 0.5rem; color: var(--warning);">⚠️ 使用真实资金交易</div>
                        <div>📊 使用 Alpha Vantage API 获取市场数据</div>
                        <div>⏰ 从当前时间开始交易</div>
                        <div>🔄 持续运行直到手动停止</div>
                        <div style="color: var(--danger);">❗ 请确保已充分测试策略</div>
                    `;
                }
                
                if (realtimeConfigDesc) {
                    const today = new Date().toISOString().split('T')[0];
                    realtimeConfigDesc.innerHTML = `
                        <div>📅 开始日期: <strong>${today}</strong> (今天)</div>
                        <div style="margin-top: 0.5rem;">🔄 持续运行，无结束日期</div>
                        <div style="margin-top: 0.5rem; color: var(--warning);">⚠️ 将使用真实账户进行交易，请谨慎操作</div>
                        <div style="margin-top: 0.5rem; color: var(--danger);">❗ 确保已设置风险控制参数</div>
                    `;
                }
            }
            
            // Update asset mode description (if exists)
            if (assetModeDescText) {
                assetModeDescText.innerHTML = modeDesc;
            }
            
            // Update button hint
            if (buttonHint) {
                buttonHint.textContent = btnHint;
            }
        }
    }

    // Load configuration data
    async loadConfigData() {
        console.log(`⚙️ Loading config data for mode: ${this.currentConfigMode}, strategy: ${this.strategyId}`);
        try {
            // Ensure DOM is ready
            const systemPromptElement = document.getElementById('systemPrompt');
            if (!systemPromptElement) {
                console.warn('⚠️ systemPrompt element not found, waiting for DOM...');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Check if config was saved and show restart button if needed
            this.checkAndShowRestartButton();
            
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
            const maxStepsEl = document.getElementById('maxSteps');
            const maxRetriesEl = document.getElementById('maxRetries');
            const baseDelayEl = document.getElementById('baseDelay');
            const initialCashEl = document.getElementById('initialCash');
            
            if (config && config.agent_config) {
                if (maxStepsEl) maxStepsEl.value = config.agent_config.max_steps || 30;
                if (maxRetriesEl) maxRetriesEl.value = config.agent_config.max_retries || 3;
                if (baseDelayEl) baseDelayEl.value = config.agent_config.base_delay || 1.0;
                if (initialCashEl) initialCashEl.value = config.agent_config.initial_cash || 10000;
            } else {
                // Use defaults
                if (maxStepsEl) maxStepsEl.value = 30;
                if (maxRetriesEl) maxRetriesEl.value = 3;
                if (baseDelayEl) baseDelayEl.value = 1.0;
                if (initialCashEl) initialCashEl.value = 10000;
            }
            
            // Note: Date range is handled in asset tab, not config tab
            // The date range inputs (assetStartDate, assetEndDate) are in the asset-tab
            // So we don't need to set them here in config tab
            
            // Load prompt
            try {
                // Ensure DOM element exists before loading
                let systemPromptElement = document.getElementById('systemPrompt');
                if (!systemPromptElement) {
                    console.warn('⚠️ systemPrompt element not found, waiting for DOM...');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    systemPromptElement = document.getElementById('systemPrompt');
                    if (!systemPromptElement) {
                        console.error('❌ systemPrompt element still not found after waiting');
                        return;
                    }
                }
                
                const promptUrl = `${this.apiBase}/api/strategies/${this.strategyId}/prompt/${this.currentConfigMode}`;
                console.log(`📝 Loading prompt from: ${promptUrl}`);
                console.log(`📝 Current config mode: ${this.currentConfigMode}`);
                
                const promptResponse = await fetch(promptUrl);
                if (promptResponse.ok) {
                    const promptData = await promptResponse.json();
                    console.log('📝 Prompt API response:', promptData);
                    
                    // API returns {success: true, prompt: "..."} or {prompt: "..."}
                    const prompt = promptData.prompt || (typeof promptData === 'string' ? promptData : '');
                    console.log(`📝 Extracted prompt length: ${prompt ? prompt.length : 0}`);
                    console.log(`📝 Prompt preview (first 100 chars): ${prompt ? prompt.substring(0, 100) : 'empty'}`);
                    
                    if (systemPromptElement) {
                        systemPromptElement.value = prompt || '';
                        console.log('✅ Prompt loaded and set to textarea');
                        console.log(`📝 Textarea value length: ${systemPromptElement.value.length}`);
                    } else {
                        console.error('❌ systemPrompt element not found after fetch');
                    }
                } else {
                    const errorText = await promptResponse.text().catch(() => '');
                    console.warn('❌ Failed to load prompt:', promptResponse.status, promptResponse.statusText, errorText);
                    if (systemPromptElement) {
                        systemPromptElement.value = '';
                    }
                }
            } catch (promptError) {
                console.error('❌ Error loading prompt:', promptError);
                console.error('❌ Error stack:', promptError.stack);
                const systemPromptElement = document.getElementById('systemPrompt');
                if (systemPromptElement) {
                    systemPromptElement.value = '';
                }
            }
        } catch (error) {
            console.error('Error loading config:', error);
            // Set defaults on error (only if elements exist)
            const maxStepsEl = document.getElementById('maxSteps');
            const maxRetriesEl = document.getElementById('maxRetries');
            const baseDelayEl = document.getElementById('baseDelay');
            const initialCashEl = document.getElementById('initialCash');
            
            if (maxStepsEl) maxStepsEl.value = 30;
            if (maxRetriesEl) maxRetriesEl.value = 3;
            if (baseDelayEl) baseDelayEl.value = 1.0;
            if (initialCashEl) initialCashEl.value = 10000;
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
                // Check if there's an error message
                if (data.error) {
                    this.showErrorState(data.error);
                } else {
                    // Show empty state
                    this.showEmptyAssetState();
                }
                return;
            }
            
            const results = data.results;
            
            // Use metrics from API or calculate from asset evolution
            if (results.metrics) {
                // Convert snake_case to camelCase for consistency
                const metrics = {
                    initialValue: results.metrics.initial_value || 10000,
                    currentValue: results.metrics.current_value || results.metrics.initial_value || 10000,
                    totalReturn: results.metrics.total_return || 0,
                    maxDrawdown: results.metrics.max_drawdown || 0,
                    sharpeRatio: results.metrics.sharpe_ratio || 0,
                    tradingDays: results.metrics.trading_days || results.metrics.num_trades || 1
                };
                this.updateAssetMetrics(metrics);
            } else if (results.asset_evolution && results.asset_evolution.length > 0) {
                // Calculate metrics from asset evolution data
                const evolution = results.asset_evolution;
                const initialValue = evolution[0].total_value || 10000;
                const currentValue = evolution[evolution.length - 1].total_value || initialValue;
                const totalReturn = ((currentValue - initialValue) / initialValue) * 100;
                
                // Calculate max drawdown (corrected logic)
                let maxDrawdown = 0;
                let peak = evolution[0].total_value;
                for (const point of evolution) {
                    const value = point.total_value || peak;
                    if (value > peak) {
                        peak = value;
                    }
                    // Drawdown is positive when value is below peak
                    const drawdown = ((peak - value) / peak) * 100;
                    if (drawdown > maxDrawdown) {
                        maxDrawdown = drawdown;
                    }
                }
                
                // Count unique trading days
                const uniqueDates = new Set(evolution.map(point => point.date).filter(date => date));
                const tradingDays = uniqueDates.size || evolution.length || 1;
                
                this.updateAssetMetrics({
                    initialValue: initialValue || 10000,
                    currentValue: currentValue || initialValue || 10000,
                    totalReturn: totalReturn || 0,
                    maxDrawdown: maxDrawdown || 0,
                    sharpeRatio: 0, // TODO: Calculate Sharpe ratio
                    tradingDays: tradingDays
                });
            } else {
                // Use placeholder data if no real data
                this.showEmptyAssetState();
                return;
            }
            
            // Render chart with real data (filtered by date range for backtest mode)
            if (results.asset_evolution) {
                let filteredData = results.asset_evolution;
                
                // For backtest mode, filter by configured date range
                if (this.currentMode === 'backtest') {
                    try {
                        const configResponse = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/config/backtest`);
                        if (configResponse.ok) {
                            const configData = await configResponse.json();
                            const config = configData.config || configData;
                            
                            if (config && config.date_range && config.date_range.init_date && config.date_range.end_date) {
                                const startDate = config.date_range.init_date;
                                const endDate = config.date_range.end_date;
                                
                                // Filter data within date range (strict filtering)
                                filteredData = results.asset_evolution.filter(point => {
                                    const pointDate = point.date || point.timestamp || '';
                                    // Only include dates strictly within the backtest range
                                    return pointDate >= startDate && pointDate <= endDate;
                                });
                                
                                // If no data in range, show warning
                                if (filteredData.length === 0 && results.asset_evolution.length > 0) {
                                    console.warn(`⚠️  No asset data found in backtest date range (${startDate} to ${endDate})`);
                                    console.warn(`   Available data dates: ${results.asset_evolution.map(p => p.date || p.timestamp).join(', ')}`);
                                } else {
                                    console.log(`📅 Filtered asset data: ${results.asset_evolution.length} -> ${filteredData.length} (range: ${startDate} to ${endDate})`);
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to load backtest config for filtering:', error);
                        // Continue with unfiltered data
                    }
                }
                
                // Only render if we have data
                if (filteredData && filteredData.length > 0) {
                    this.renderAssetChart(filteredData);
                } else {
                    console.warn('No asset data to render');
                    // Show empty state or placeholder
                }
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
                // Handle both array and object formats for backward compatibility
                let messages = log.new_messages || [];
                if (!Array.isArray(messages)) {
                    // If it's an object, convert to array
                    messages = [messages];
                }
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
    
    showErrorState(errorMessage) {
        const metricsGrid = document.querySelector('#asset-tab .metrics-grid');
        if (metricsGrid) {
            metricsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--error-color, #ff6b6b);">
                    <p style="font-size: 1.2rem; margin-bottom: 1rem;">❌ 回测失败</p>
                    <p style="margin-bottom: 0.5rem;">错误信息：</p>
                    <p style="font-family: monospace; background: var(--bg-secondary, #2a2a2a); padding: 1rem; border-radius: 4px; word-break: break-all;">${errorMessage || '未知错误'}</p>
                    <p style="margin-top: 1rem; color: var(--text-muted);">请检查日志文件或重新运行回测</p>
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
        
        // Ensure all values are defined with defaults
        const safeMetrics = {
            initialValue: metrics.initialValue || 10000,
            currentValue: metrics.currentValue || metrics.initialValue || 10000,
            totalReturn: metrics.totalReturn || 0,
            maxDrawdown: metrics.maxDrawdown || 0,
            sharpeRatio: metrics.sharpeRatio || 0,
            tradingDays: metrics.tradingDays || 1
        };
        
        metricsGrid.innerHTML = `
            <div class="metric-card">
                <div class="metric-label">初始资金</div>
                <div class="metric-value">$${safeMetrics.initialValue.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">当前资产</div>
                <div class="metric-value">$${safeMetrics.currentValue.toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">总收益率</div>
                <div class="metric-value ${safeMetrics.totalReturn >= 0 ? 'positive' : 'negative'}">
                    ${safeMetrics.totalReturn >= 0 ? '+' : ''}${safeMetrics.totalReturn.toFixed(2)}%
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">最大回撤</div>
                <div class="metric-value negative">${safeMetrics.maxDrawdown.toFixed(2)}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">夏普比率</div>
                <div class="metric-value">${safeMetrics.sharpeRatio.toFixed(2)}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">交易天数</div>
                <div class="metric-value">${safeMetrics.tradingDays}</div>
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
        let sortedData = null;
        
        if (assetData && assetData.length > 0) {
            // Sort data by datetime or date to ensure correct chronological order
            sortedData = [...assetData].sort((a, b) => {
                // Prefer datetime if available, otherwise use date
                const dateA = a.datetime || a.date || a.timestamp || '';
                const dateB = b.datetime || b.date || b.timestamp || '';
                return dateA.localeCompare(dateB);
            });
            
            // Use datetime if available, otherwise fallback to date
            dates = sortedData.map(point => {
                if (point.datetime) {
                    // Format datetime for display: "YYYY-MM-DD HH:MM"
                    const dt = point.datetime;
                    // If it's already in format "YYYY-MM-DD HH:MM:SS", format it
                    if (dt.includes(' ')) {
                        const [datePart, timePart] = dt.split(' ');
                        const [hour, minute] = timePart.split(':');
                        return `${datePart} ${hour}:${minute}`;
                    }
                    return dt;
                }
                return point.date || point.timestamp || '';
            });
            values = sortedData.map(point => point.total_value || point.value || 0);
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
                            title: function(context) {
                                // Show full datetime in tooltip title
                                const index = context[0].dataIndex;
                                if (sortedData && sortedData.length > index) {
                                    const point = sortedData[index];
                                    if (point.datetime) {
                                        return point.datetime;
                                    }
                                }
                                return context[0].label;
                            },
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
                // Convert backend format to frontend format
                // Filter out holdings with 0 shares and sort by market value (descending)
                const convertedHoldings = portfolio.holdings
                    .filter(h => h.shares && h.shares > 0) // Only show holdings with shares > 0
                    .map(h => ({
                        symbol: h.symbol,
                        shares: h.shares || 0,
                        cost: h.avg_cost || h.cost || 0,
                        current: h.current_price || h.current || 0,
                        pnl: h.profit_loss || h.pnl || 0,
                        pnlPercent: h.profit_loss_rate || h.pnlPercent || 0,
                        marketValue: h.market_value || (h.shares * (h.current_price || h.current || 0))
                    }))
                    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0)); // Sort by market value descending
                
                console.log(`📊 Portfolio holdings: ${convertedHoldings.length} stocks`, convertedHoldings);
                this.renderHoldingsTable(convertedHoldings);
            } else if (portfolio.positions) {
                // Convert positions format if needed
                const convertedHoldings = portfolio.positions.map(h => ({
                    symbol: h.symbol,
                    shares: h.shares || 0,
                    cost: h.avg_cost || h.cost || 0,
                    current: h.current_price || h.current || 0,
                    pnl: h.profit_loss || h.pnl || 0,
                    pnlPercent: h.profit_loss_rate || h.pnlPercent || 0
                }));
                this.renderHoldingsTable(convertedHoldings);
            } else {
                this.showEmptyPortfolioState();
            }
            
            // Render allocation chart
            if (portfolio.allocations || portfolio.holdings) {
                this.renderAllocationChart(portfolio.allocations || portfolio.holdings, portfolio.cash);
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
        
        tbody.innerHTML = holdings.map(h => {
            // Ensure all values are numbers and handle undefined/null
            const symbol = h.symbol || '';
            const shares = Number(h.shares) || 0;
            const cost = Number(h.cost) || 0;
            const current = Number(h.current) || 0;
            const marketValue = shares * current;
            const pnl = Number(h.pnl) || 0;
            const pnlPercent = Number(h.pnlPercent) || 0;
            
            return `
            <tr>
                <td style="color: var(--accent-blue); font-weight: 700;">${symbol}</td>
                <td>${shares}</td>
                <td>$${cost.toFixed(2)}</td>
                <td>$${current.toFixed(2)}</td>
                <td>$${marketValue.toLocaleString()}</td>
                <td class="${pnl >= 0 ? 'positive' : 'negative'}">
                    ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}
                </td>
                <td class="${pnlPercent >= 0 ? 'positive' : 'negative'}">
                    ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%
                </td>
            </tr>
        `;
        }).join('');
    }

    // Render allocation chart
    renderAllocationChart(holdings = null, cash = 0) {
        const ctx = document.getElementById('allocationChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.allocationChart) {
            this.allocationChart.destroy();
        }
        
        // Use real data or sample data
        let labels = [];
        let data = [];
        let colors = [];
        
        if (holdings && Array.isArray(holdings) && holdings.length > 0) {
            // Use real data from portfolio
            holdings.forEach((h, index) => {
                if (h.symbol && (h.market_value || (h.shares && h.current_price))) {
                    labels.push(h.symbol);
                    const marketValue = h.market_value || (h.shares * (h.current_price || h.current || 0));
                    data.push(marketValue);
                    // Generate colors dynamically
                    const hue = (index * 137.508) % 360; // Golden angle for color distribution
                    colors.push(`hsl(${hue}, 70%, 60%)`);
                }
            });
            
            // Add cash if available
            if (cash && cash > 0) {
                labels.push('CASH');
                data.push(cash);
                colors.push('#8338ec');
            }
        } else {
            // Fallback to sample data
            labels = ['AAPL', 'GOOGL', 'MSFT', 'CASH'];
            data = [8750, 5900, 11400, 2000];
            colors = ['#00d4ff', '#00ffcc', '#ff006e', '#8338ec'];
        }
        
        this.allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
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
        
        // Stop and resume backtest buttons (in asset tab)
        document.getElementById('stopBacktestBtn')?.addEventListener('click', () => {
            this.stopRun();
        });
        
        document.getElementById('resumeBacktestBtn')?.addEventListener('click', () => {
            this.resumeRun();
        });
        
        // Resume run button (in status container)
        document.getElementById('resumeRunBtn')?.addEventListener('click', () => {
            this.resumeRun();
        });
        
        // Save backtest dates button (use event delegation on document)
        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('#saveBacktestDatesBtn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('💾 Save backtest dates button clicked');
                await this.saveBacktestDatesFromInputs();
            }
        });
    }

    // Save configuration
    async saveConfiguration() {
        try {
            // Helper function to safely get element value
            const getValue = (id, defaultValue = '') => {
                const element = document.getElementById(id);
                if (!element) {
                    console.warn(`Element with id "${id}" not found`);
                    return defaultValue;
                }
                return element.value || defaultValue;
            };

            const config = {
                agent_config: {
                    max_steps: parseInt(getValue('maxSteps', '30')),
                    max_retries: parseInt(getValue('maxRetries', '3')),
                    base_delay: parseFloat(getValue('baseDelay', '1.0')),
                    initial_cash: parseFloat(getValue('initialCash', '10000'))
                }
            };
            
            // Only include date_range for backtest mode
            if (this.currentConfigMode === 'backtest') {
                const startDate = getValue('startDate');
                const endDate = getValue('endDate');
                if (startDate && endDate) {
                    config.date_range = {
                        init_date: startDate,
                        end_date: endDate
                    };
                }
            }
            
            // Save config to the correct mode
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/config/${this.currentConfigMode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });
            
            if (!response.ok) throw new Error('Failed to save configuration');
            
            // Save prompt
            const promptText = getValue('systemPrompt', '');
            if (promptText) {
                await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/prompt/${this.currentConfigMode}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptText })
                });
            }
            
            // Reload config to show saved values
            await this.loadConfigData();
            
            // Save flag to localStorage to persist across page refreshes
            const configSavedKey = `config_saved_${this.strategyId}_${this.currentConfigMode}`;
            localStorage.setItem(configSavedKey, 'true');
            
            // Show success message and restart button
            const configMessage = document.getElementById('config-message');
            const restartBtn = document.getElementById('restartServiceBtn');
            if (configMessage) configMessage.style.display = 'block';
            if (restartBtn) restartBtn.style.display = 'inline-block';
            
            alert('✅ 配置已保存，需要重启服务才能生效');
        } catch (error) {
            console.error('Error saving configuration:', error);
            alert('保存失败: ' + error.message);
        }
    }
    
    // Run strategy in specific mode
    async runStrategy(mode) {
        // Get current date for simulate/real modes
        const today = new Date().toISOString().split('T')[0];
        
        // Special confirmation for each mode
        if (mode === 'real') {
            const confirmed = confirm(
                '⚠️ 确定要启动实盘交易吗？\n\n' +
                '重要信息：\n' +
                '• 将使用真实资金执行交易\n' +
                `• 从当前时间开始交易（${today}）\n` +
                '• 持续运行直到手动停止\n' +
                '• 使用 Alpha Vantage API 获取市场数据\n\n' +
                '请确保：\n' +
                '1. 已充分测试策略（回测 + 模拟盘）\n' +
                '2. 已配置风险控制参数\n' +
                '3. 已准备好承担交易风险\n\n' +
                '是否继续？'
            );
            if (!confirmed) {
                return;
            }
        } else if (mode === 'simulate') {
            const confirmed = confirm(
                '🎯 确定要启动模拟盘交易吗？\n\n' +
                '运行说明：\n' +
                `• 从当前时间开始交易（${today}）\n` +
                '• 使用 Moomoo 实时市场数据\n' +
                '• 模拟账户交易，无真实资金\n' +
                '• 持续运行直到手动停止\n\n' +
                '是否继续？'
            );
            if (!confirmed) {
                return;
            }
        } else {
            // Get date range from asset page for backtest
            const startDate = document.getElementById('assetStartDate')?.value || '未设置';
            const endDate = document.getElementById('assetEndDate')?.value || '未设置';
            
            // Validate dates are set
            if (startDate === '未设置' || endDate === '未设置' || !startDate || !endDate) {
                alert('❌ 请先设置回测日期范围');
                document.getElementById('assetStartDate')?.focus();
                return;
            }
            
            const confirmed = confirm(
                '📊 确定要启动回测吗？\n\n' +
                '回测设置：\n' +
                `• 日期范围：${startDate} 至 ${endDate}\n` +
                '• 优先使用本地数据 (merged.jsonl)\n' +
                '• 缺失数据将自动从 API 获取\n' +
                '• 处理完所有交易日后自动结束\n' +
                '• 无资金风险\n\n' +
                '是否继续？'
            );
            if (!confirmed) {
                return;
            }
            
            // Save the dates to config before running
            await this.saveBacktestDates(startDate, endDate);
        }
        
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/run/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: mode === 'real' })
            });
            
            if (!response.ok) {
                const error = await response.json();
                // Check if it's a data validation error
                if (error.validation) {
                    let message = error.error || `Failed to run ${mode}`;
                    if (error.validation.suggested_range) {
                        message += `\n\n建议使用日期范围：\n${error.validation.suggested_range.start} 到 ${error.validation.suggested_range.end}`;
                    }
                    if (error.validation.available_range) {
                        message += `\n\n本地数据范围：\n${error.validation.available_range.start} 到 ${error.validation.available_range.end}`;
                    }
                    throw new Error(message);
                }
                throw new Error(error.error || `Failed to run ${mode}`);
            }
            
            const result = await response.json();
            const modeText = mode === 'backtest' ? '回测' : mode === 'simulate' ? '模拟盘' : '实盘';
            
            // Switch to asset tab to see results and status
            this.switchTab('asset');
            this.currentMode = mode;
            // Update mode selector active state
            document.querySelectorAll('#asset-tab .mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
            // Update run buttons visibility
            this.updateAssetRunButtonsVisibility();
            
            // Show status container and start monitoring
            this.showRunStatus(mode);
            this.startStatusMonitoring(mode);
            
            // Update backtest buttons if in backtest mode
            if (mode === 'backtest') {
                // Wait a moment for status to update, then check and update buttons
                setTimeout(async () => {
                    const statusResponse = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/status/${mode}`);
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        if (statusData.success && statusData.status) {
                            this.updateBacktestButtonsByStatus(statusData.status);
                        }
                    }
                }, 1000);
            }
        } catch (error) {
            console.error(`Error running ${mode}:`, error);
            alert(`❌ 启动${mode === 'backtest' ? '回测' : mode === 'simulate' ? '模拟盘' : '实盘'}失败：${error.message}`);
        }
    }
    
    // Show run status container
    showRunStatus(mode) {
        const container = document.getElementById('runStatusContainer');
        if (!container) return;
        
        container.style.display = 'block';
        this.isRunning = true;
        
        const modeText = mode === 'backtest' ? '回测' : mode === 'simulate' ? '模拟盘' : '实盘';
        document.getElementById('runStatusText').textContent = `${modeText}运行中...`;
        document.getElementById('runStatusIcon').textContent = '⏳';
        document.getElementById('runStatusMessage').textContent = '正在启动策略...';
        
        // Hide resume button when running
        const resumeBtn = document.getElementById('resumeRunBtn');
        if (resumeBtn) {
            resumeBtn.style.display = 'none';
        }
        
        // Show progress bar animation
        const progressFill = document.getElementById('runProgressFill');
        if (progressFill) {
            progressFill.style.width = '30%';
            progressFill.style.animation = 'pulse 2s infinite';
        }
        
        // Clear log content
        const logContent = document.getElementById('runLogContent');
        if (logContent) {
            logContent.innerHTML = '<div style="color: var(--text-muted);">等待日志输出...</div>';
        }
        
        // Scroll to status container
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Start monitoring run status
    startStatusMonitoring(mode) {
        // Clear existing interval
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }
        
        // Reset monitoring state
        this.statusCheckStartTime = Date.now();
        this.statusCheckRetries = 0;
        this.maxMonitoringTime = 3600000; // 1 hour max monitoring time
        
        // Check status every 2 seconds
        this.statusCheckInterval = setInterval(async () => {
            await this.checkRunStatus(mode);
            
            // Safety timeout: stop monitoring after 1 hour
            if (Date.now() - this.statusCheckStartTime > this.maxMonitoringTime) {
                console.warn('⚠️  Status monitoring timeout (1 hour), stopping...');
                this.stopStatusMonitoring();
            }
        }, 2000);
        
        // Initial check
        this.checkRunStatus(mode);
    }
    
    // Stop status monitoring
    stopStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        this.isRunning = false;
    }
    
    // Check run status
    async checkRunStatus(mode) {
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/status/${mode}`);
            if (!response.ok) {
                throw new Error('Failed to check status');
            }
            
            const data = await response.json();
            if (!data.success) {
                return;
            }
            
            const status = data.status;
            this.updateRunStatusDisplay(status, mode);
            
            // Update backtest buttons visibility based on status
            if (mode === 'backtest' && this.currentTab === 'asset') {
                this.updateBacktestButtonsByStatus(status);
            }
            
            // If running, update asset data in real-time (every 5 status checks = ~10 seconds)
            if (status.is_running) {
                // Update asset chart periodically during backtest
                if (!this.lastAssetUpdate || Date.now() - this.lastAssetUpdate > 10000) {
                    this.lastAssetUpdate = Date.now();
                    this.loadAssetData();
                }
            }
            
            // If not running, stop monitoring
            if (!status.is_running) {
                if (status.status === 'completed') {
                    // Completed successfully, reload data
                    this.stopStatusMonitoring();
                    setTimeout(() => {
                        this.loadAssetData();
                        this.loadAvailableLogDates();
                    }, 1000);
                } else if (status.status === 'failed' || status.status === 'error' || status.status === 'stopped') {
                    // Failed, error, or stopped, stop monitoring immediately
                    this.stopStatusMonitoring();
                } else {
                    // Process ended but status is unclear, stop monitoring after a delay
                    // This handles cases where process crashed or was killed
                    this.statusCheckRetries++;
                    // If we've checked multiple times and still not running, stop
                    if (this.statusCheckRetries >= 3) {
                        console.warn('⚠️  Process stopped but status unclear, stopping monitoring after 3 checks');
                        this.stopStatusMonitoring();
                        this.statusCheckRetries = 0;
                    }
                }
            } else {
                // Reset retry counter when process is running
                this.statusCheckRetries = 0;
                
                // Check if process is stuck (same status for too long)
                if (status.latest_log && this.lastStatusLog === status.latest_log) {
                    this.statusStuckCount = (this.statusStuckCount || 0) + 1;
                    // If same log message for 30 checks (60 seconds), stop monitoring
                    if (this.statusStuckCount >= 30) {
                        console.warn(`⚠️  Process seems stuck (same log message for 60 seconds): ${status.latest_log}. Stopping monitoring.`);
                        this.stopStatusMonitoring();
                        // Show error message to user
                        this.updateRunStatusDisplay({
                            ...status,
                            is_running: false,
                            status: 'error',
                            message: `进程可能已卡住: ${status.latest_log}`
                        }, mode);
                    }
                } else {
                    this.statusStuckCount = 0;
                    this.lastStatusLog = status.latest_log;
                }
                
                // Also check if progress hasn't changed for too long (additional safety check)
                if (status.progress !== undefined && this.lastProgress === status.progress) {
                    this.progressStuckCount = (this.progressStuckCount || 0) + 1;
                    // If progress hasn't changed for 60 checks (2 minutes), stop monitoring
                    if (this.progressStuckCount >= 60) {
                        console.warn(`⚠️  Process progress hasn't changed for 2 minutes (${status.progress}%). Stopping monitoring.`);
                        this.stopStatusMonitoring();
                        this.updateRunStatusDisplay({
                            ...status,
                            is_running: false,
                            status: 'error',
                            message: `进程进度长时间未更新 (${status.progress}%)`
                        }, mode);
                    }
                } else {
                    this.progressStuckCount = 0;
                    this.lastProgress = status.progress;
                }
            }
            
        } catch (error) {
            console.error('Error checking run status:', error);
        }
    }
    
    // Update backtest buttons visibility based on status
    updateBacktestButtonsByStatus(status) {
        const runBacktestBtn = document.getElementById('runBacktestBtn');
        const stopBacktestBtn = document.getElementById('stopBacktestBtn');
        const resumeBacktestBtn = document.getElementById('resumeBacktestBtn');
        
        if (status.is_running) {
            // Running: show stop button, hide start and resume
            if (runBacktestBtn) runBacktestBtn.style.display = 'none';
            if (stopBacktestBtn) stopBacktestBtn.style.display = 'inline-block';
            if (resumeBacktestBtn) resumeBacktestBtn.style.display = 'none';
        } else if (status.status === 'stopped' && status.progress > 0) {
            // Stopped with progress: show resume button, hide start and stop
            if (runBacktestBtn) runBacktestBtn.style.display = 'none';
            if (stopBacktestBtn) stopBacktestBtn.style.display = 'none';
            if (resumeBacktestBtn) resumeBacktestBtn.style.display = 'inline-block';
        } else if (status.status === 'completed' || status.status === 'failed') {
            // Completed or failed: show start button, hide stop and resume
            if (runBacktestBtn) runBacktestBtn.style.display = 'inline-block';
            if (stopBacktestBtn) stopBacktestBtn.style.display = 'none';
            if (resumeBacktestBtn) resumeBacktestBtn.style.display = 'none';
        } else {
            // Not started: show start button, hide stop and resume
            if (runBacktestBtn) runBacktestBtn.style.display = 'inline-block';
            if (stopBacktestBtn) stopBacktestBtn.style.display = 'none';
            if (resumeBacktestBtn) resumeBacktestBtn.style.display = 'none';
        }
    }
    
    // Update run status display
    updateRunStatusDisplay(status, mode) {
        const statusIcon = document.getElementById('runStatusIcon');
        const statusText = document.getElementById('runStatusText');
        const statusMessage = document.getElementById('runStatusMessage');
        const progressFill = document.getElementById('runProgressFill');
        const logContent = document.getElementById('runLogContent');
        const container = document.getElementById('runStatusContainer');
        
        if (!statusIcon || !statusText || !statusMessage) return;
        
        // Always show container if there's progress information (persistent progress bar)
        if (container && (status.progress !== undefined || status.is_running || status.status === 'completed' || status.status === 'stopped')) {
            container.style.display = 'block';
        }
        
        const modeText = mode === 'backtest' ? '回测' : mode === 'simulate' ? '模拟盘' : '实盘';
        
        if (status.is_running) {
            // Running state
            statusIcon.textContent = '⏳';
            statusText.textContent = `${modeText}运行中...`;
            statusMessage.textContent = status.message || '策略正在运行中...';
            
            // Display actual progress if available
            if (progressFill) {
                const progress = status.progress || 0;
                progressFill.style.width = `${progress}%`;
                
                // Add animation only if progress is not complete
                if (progress < 100) {
                    progressFill.style.animation = 'pulse 2s infinite';
                } else {
                    progressFill.style.animation = 'none';
                }
                
                // Update progress text if element exists
                const progressText = container ? container.querySelector('.progress-text') : null;
                if (progressText) {
                    progressText.textContent = `${progress}%`;
                } else if (statusMessage) {
                    // Add progress info to message
                    let msg = status.message || '策略正在运行中...';
                    if (status.current_date) {
                        msg += ` 当前日期: ${status.current_date}`;
                    }
                    if (status.processed_dates && status.total_dates) {
                        msg += ` (${status.processed_dates}/${status.total_dates})`;
                    }
                    statusMessage.textContent = msg;
                }
            }
            
            const resumeBtn = document.getElementById('resumeRunBtn');
            if (resumeBtn) {
                resumeBtn.style.display = 'none';
            }
            
            // Ensure container is visible when running
            if (container) {
                container.style.display = 'block';
            }
            
            // Update log content - display full log content
            if (logContent) {
                if (status.latest_log && status.latest_log.trim()) {
                    const logText = status.latest_log.trim();
                    
                    // Replace entire content with full log (preserve line breaks)
                    const logDiv = document.createElement('div');
                    logDiv.style.cssText = 'color: var(--accent-cyan); white-space: pre-wrap; word-break: break-word; font-family: monospace; font-size: 0.85rem; line-height: 1.5;';
                    logDiv.textContent = logText;
                    logContent.innerHTML = '';
                    logContent.appendChild(logDiv);
                    
                    // Auto scroll to bottom to show latest content
                    const logContainer = document.getElementById('runLogContainer');
                    if (logContainer) {
                        logContainer.scrollTop = logContainer.scrollHeight;
                    }
                } else {
                    // Keep "等待日志输出..." if no logs yet
                    if (logContent.innerHTML.trim() === '' || !logContent.innerHTML.includes('等待日志输出')) {
                        logContent.innerHTML = '<div style="color: var(--text-muted);">等待日志输出...</div>';
                    }
                }
            }
        } else if (status.status === 'completed') {
            // Completed state
            statusIcon.textContent = '✅';
            statusText.textContent = `${modeText}已完成`;
            statusMessage.textContent = status.message || '策略运行已完成，可以查看结果';
            
            if (progressFill) {
                progressFill.style.width = '100%';
                progressFill.style.animation = 'none';
                progressFill.style.background = 'var(--success)';
            }
            
            const resumeBtnCompleted = document.getElementById('resumeRunBtn');
            if (resumeBtnCompleted) {
                resumeBtnCompleted.style.display = 'none';
            }
            
            // Keep status container visible (progress bar should be persistent)
            // Removed auto-hide logic to keep progress bar always visible
        } else if (status.status === 'stopped') {
            // Stopped state with partial progress
            statusIcon.textContent = '⏸️';
            statusText.textContent = `${modeText}已停止`;
            statusMessage.textContent = status.message || '策略已停止';
            
            if (progressFill && status.progress) {
                progressFill.style.width = `${status.progress}%`;
                progressFill.style.animation = 'none';
                progressFill.style.background = 'var(--warning)';
            }
            
            // Show progress details in message
            if (statusMessage && status.progress > 0) {
                let msg = status.message || '策略已停止';
                if (status.current_date) {
                    msg += ` 最后处理日期: ${status.current_date}`;
                }
                statusMessage.textContent = msg;
            }
            
            const resumeBtn = document.getElementById('resumeRunBtn');
            // Show resume button if there's progress to resume
            if (resumeBtn && status.progress > 0) {
                resumeBtn.style.display = 'inline-block';
            } else if (resumeBtn) {
                resumeBtn.style.display = 'none';
            }
        } else if (status.status === 'failed') {
            // Failed state
            statusIcon.textContent = '❌';
            statusText.textContent = `${modeText}失败`;
            statusMessage.textContent = status.message || '策略运行失败';
            
            if (progressFill) {
                progressFill.style.width = '100%';
                progressFill.style.animation = 'none';
                progressFill.style.background = 'var(--danger)';
            }
        } else {
            // Not started or unknown
            statusIcon.textContent = '⏸️';
            statusText.textContent = `${modeText}未启动`;
            statusMessage.textContent = status.message || '策略未启动';
            
            if (progressFill) {
                // Show progress if available, otherwise show 0%
                const progress = status.progress || 0;
                progressFill.style.width = `${progress}%`;
                progressFill.style.animation = 'none';
            }
            
            // Keep container visible to show progress bar persistently
            const container = document.getElementById('runStatusContainer');
            if (container && status.progress !== undefined && status.progress > 0) {
                container.style.display = 'block';
            }
        }
    }
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Stop running strategy
    async stopRun() {
        if (!confirm('确定要停止运行中的策略吗？')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/stop/${this.currentMode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(`✅ ${data.message || '策略已停止'}`);
                // Refresh status and update button visibility
                await this.checkRunStatus(this.currentMode);
                // Update backtest buttons if in backtest mode
                if (this.currentMode === 'backtest' && this.currentTab === 'asset') {
                    const statusResponse = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/status/${this.currentMode}`);
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        if (statusData.success && statusData.status) {
                            this.updateBacktestButtonsByStatus(statusData.status);
                        }
                    }
                }
            } else {
                alert(`❌ 停止失败：${data.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('Error stopping strategy:', error);
            alert(`❌ 停止失败：${error.message}`);
        }
    }
    
    async resumeRun() {
        const modeText = this.currentMode === 'backtest' ? '回测' : this.currentMode === 'simulate' ? '模拟盘' : '实盘';
        if (!confirm(`确定要继续运行${modeText}吗？将从上次停止的地方继续。`)) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/resume/${this.currentMode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const resumedFrom = data.resumed_from ? ` (从 ${data.resumed_from} 继续)` : '';
                alert(`✅ ${modeText}已继续运行${resumedFrom}`);
                // Show status and start monitoring
                this.showRunStatus(this.currentMode);
                this.startStatusMonitoring(this.currentMode);
                // Update backtest buttons if in backtest mode
                if (this.currentMode === 'backtest' && this.currentTab === 'asset') {
                    // Wait a moment for status to update, then check
                    setTimeout(async () => {
                        const statusResponse = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/status/${this.currentMode}`);
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            if (statusData.success && statusData.status) {
                                this.updateBacktestButtonsByStatus(statusData.status);
                            }
                        }
                    }, 1000);
                }
            } else {
                alert(`❌ 继续失败：${data.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('Error resuming strategy:', error);
            alert(`❌ 继续失败：${error.message}`);
        }
    }
    
    // Check and show restart button if config was saved
    checkAndShowRestartButton() {
        const configSavedKey = `config_saved_${this.strategyId}_${this.currentConfigMode}`;
        const configSaved = localStorage.getItem(configSavedKey);
        
        if (configSaved === 'true') {
            const configMessage = document.getElementById('config-message');
            const restartBtn = document.getElementById('restartServiceBtn');
            if (configMessage) configMessage.style.display = 'block';
            if (restartBtn) restartBtn.style.display = 'inline-block';
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
                body: JSON.stringify({ 
                    strategy_id: this.strategyId,
                    config_mode: this.currentConfigMode  // Pass the current config mode
                })
            });
            
            if (!response.ok) throw new Error('Failed to restart service');
            
            const result = await response.json();
            
            // Clear the saved config flag from localStorage
            const configSavedKey = `config_saved_${this.strategyId}_${this.currentConfigMode}`;
            localStorage.removeItem(configSavedKey);
            
            // Hide restart button and message
            const configMessage = document.getElementById('config-message');
            const restartBtn = document.getElementById('restartServiceBtn');
            if (configMessage) configMessage.style.display = 'none';
            if (restartBtn) restartBtn.style.display = 'none';
            
            alert('✅ ' + result.message);
        } catch (error) {
            console.error('Error restarting service:', error);
            alert('❌ 重启服务失败：' + error.message);
        }
    }
    
    // Load available data range for asset page
    async loadAvailableDataRangeForAsset() {
        const rangeSpan = document.getElementById('assetAvailableRange');
        if (!rangeSpan) return;
        
        try {
            const response = await fetch(`${this.apiBase}/api/data/available-range`);
            if (!response.ok) {
                rangeSpan.textContent = '加载失败，请检查 API 服务';
                console.error('Failed to load data range:', response.status, response.statusText);
                return;
            }
            
            const data = await response.json();
            
            if (!data.success) {
                rangeSpan.textContent = data.error || '加载失败';
                console.error('API returned error:', data.error);
                return;
            }
            
            if (data.available) {
                rangeSpan.textContent = `${data.start_date} 至 ${data.end_date}`;
                
                // 不再设置 min/max 限制，允许选择超出本地范围的日期
                // 缺失数据将自动从 API 获取
                const startInput = document.getElementById('assetStartDate');
                const endInput = document.getElementById('assetEndDate');
                
                if (startInput && endInput) {
                    // 移除日期限制，允许选择任意日期
                    startInput.removeAttribute('min');
                    startInput.removeAttribute('max');
                    endInput.removeAttribute('min');
                    endInput.removeAttribute('max');
                }
            } else {
                rangeSpan.textContent = '无本地数据（将自动从 API 获取）';
            }
        } catch (error) {
            console.error('Error loading available data range:', error);
            if (rangeSpan) {
                rangeSpan.textContent = '加载失败: ' + error.message;
            }
        }
    }
    
    // Load saved backtest dates for asset page
    async loadBacktestDatesForAsset() {
        try {
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/config/backtest`);
            
            if (response.ok) {
                const data = await response.json();
                const config = data.config || data;
                
                if (config && config.date_range) {
                    const startInput = document.getElementById('assetStartDate');
                    const endInput = document.getElementById('assetEndDate');
                    
                    if (startInput) startInput.value = config.date_range.init_date || '';
                    if (endInput) endInput.value = config.date_range.end_date || '';
                }
            }
        } catch (error) {
            console.error('Error loading backtest dates:', error);
        }
    }
    
    // Save backtest dates from input fields
    async saveBacktestDatesFromInputs() {
        console.log('📝 saveBacktestDatesFromInputs called');
        const startDateInput = document.getElementById('assetStartDate');
        const endDateInput = document.getElementById('assetEndDate');
        
        console.log('📅 Start date input:', startDateInput);
        console.log('📅 End date input:', endDateInput);
        
        if (!startDateInput || !endDateInput) {
            alert('❌ 无法找到日期输入框');
            return;
        }
        
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        if (!startDate || !endDate) {
            alert('❌ 请填写完整的日期范围（开始日期和结束日期）');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            alert('❌ 开始日期不能晚于结束日期');
            return;
        }
        
        try {
            await this.saveBacktestDates(startDate, endDate);
            alert('✅ 回测日期范围已保存');
        } catch (error) {
            console.error('Error saving backtest dates:', error);
            alert(`❌ 保存失败：${error.message}`);
        }
    }
    
    // Save backtest dates before running
    async saveBacktestDates(startDate, endDate) {
        try {
            // First, get existing config
            const response = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/config/backtest`);
            let config = {};
            
            if (response.ok) {
                const data = await response.json();
                config = data.config || data || {};
            }
            
            // Ensure config has required structure
            if (!config.agent_config) {
                config.agent_config = {
                    max_steps: 30,
                    max_retries: 3,
                    base_delay: 1.0,
                    initial_cash: 10000.0
                };
            }
            
            // Update date range
            config.date_range = {
                init_date: startDate,
                end_date: endDate
            };
            
            // Save the updated config - send as {config: {...}} format
            const saveResponse = await fetch(`${this.apiBase}/api/strategies/${this.strategyId}/config/backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: config })
            });
            
            if (!saveResponse.ok) {
                const errorData = await saveResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to save backtest dates');
            }
            
            const saveData = await saveResponse.json();
            console.log('✅ Backtest dates saved successfully:', saveData);
        } catch (error) {
            console.error('Error saving backtest dates:', error);
            throw error; // Re-throw to allow caller to handle
        }
    }
}

// Initialize when page loads
const strategyDetail = new StrategyDetail();
document.addEventListener('DOMContentLoaded', () => {
    strategyDetail.init();
});