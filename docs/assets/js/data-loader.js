// Data Loader Utility
// Handles loading and processing all trading data

class DataLoader {
    constructor() {
        this.agentData = {};
        this.priceCache = {};
        // Use 'data' for GitHub Pages deployment, '../data' for local development
        this.baseDataPath = './data';
    }

    // Load all agent names from directory structure
    async loadAgentList() {
        try {
            // Since we can't directly list directories in the browser,
            // we'll try to load known agents based on common patterns
            // Only check agents that might actually exist
            const potentialAgents = [
                'deepseek-chat-v3.1',
                'gemini-2.5-flash',
                'qwen3-max',
                'gpt-5',
                'claude-3.7-sonnet',
            ];

            const agents = [];
            for (const agent of potentialAgents) {
                try {
                    console.log(`Checking agent: ${agent}`);
                    const response = await fetch(`${this.baseDataPath}/agent_data/${agent}/position/position.jsonl`);
                    if (response.ok) {
                        // Double check: read at least one line to ensure data exists
                        const text = await response.text();
                        if (text.trim().length > 0) {
                            agents.push(agent);
                            console.log(`✅ Added agent: ${agent}`);
                        } else {
                            console.log(`⚠️  Agent ${agent} file is empty, skipping`);
                        }
                    } else {
                        console.log(`ℹ️  Agent ${agent} not found (status: ${response.status}), skipping`);
                    }
                } catch (e) {
                    console.log(`❌ Agent ${agent} error:`, e.message);
                }
            }

            console.log(`📊 Found ${agents.length} active agent(s):`, agents);
            return agents;
        } catch (error) {
            console.error('Error loading agent list:', error);
            return [];
        }
    }

    // Determine trading mode from positions
    detectTradingMode(positions) {
        let hasRealTrade = false;
        let tradingMode = 'BACKTEST'; // Default to backtest
        
        for (const pos of positions) {
            const action = pos.this_action;
            if (action && action.real_trade === true) {
                hasRealTrade = true;
                // Check if there's a trd_env field or order_id to distinguish SIMULATE vs REAL
                // For now, we'll use a heuristic: check if order_id format suggests real trading
                // In the future, we should add a trd_env field to the data
                if (action.order_id) {
                    // If order_id exists, it's either SIMULATE or REAL
                    // We'll need to check configuration or add metadata
                    // For now, default to SIMULATE (safer assumption)
                    tradingMode = 'SIMULATE';
                }
            }
        }
        
        // If we have real trades but can't determine SIMULATE vs REAL,
        // check if we can infer from date (today = likely REAL, past = likely SIMULATE)
        if (hasRealTrade && tradingMode === 'BACKTEST') {
            const today = new Date().toISOString().split('T')[0];
            const lastDate = positions[positions.length - 1]?.date;
            if (lastDate === today) {
                tradingMode = 'REAL'; // Today's date with real_trade = likely real
            } else {
                tradingMode = 'SIMULATE'; // Past date with real_trade = likely simulate
            }
        }
        
        return tradingMode;
    }

    // Load position data for a specific agent
    async loadAgentPositions(agentName) {
        try {
            const url = `${this.baseDataPath}/agent_data/${agentName}/position/position.jsonl`;
            console.log(`📥 Fetching position data: ${url}`);
            
            const response = await fetch(url, {
                cache: 'no-cache' // Ensure fresh data
            });
            
            if (!response.ok) {
                const errorMsg = `Failed to load positions for ${agentName}: ${response.status} ${response.statusText}`;
                console.error(`❌ ${errorMsg}`);
                throw new Error(errorMsg);
            }

            const text = await response.text();
            if (!text || text.trim().length === 0) {
                console.warn(`⚠️  Position file for ${agentName} is empty`);
                return [];
            }
            
            const lines = text.trim().split('\n').filter(line => line.trim() !== '');
            const positions = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (parseError) {
                    console.error(`❌ Error parsing line for ${agentName}:`, parseError, line.substring(0, 100));
                    return null;
                }
            }).filter(pos => pos !== null);

            console.log(`✅ Loaded ${positions.length} positions for ${agentName}`);
            return positions;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error(`🌐 Network error loading positions for ${agentName}:`, error.message);
                console.error(`   请检查：\n   1. 前端服务器是否在运行 (http://localhost:8000)\n   2. 数据文件路径是否正确\n   3. 浏览器控制台是否有 CORS 错误`);
            } else {
                console.error(`❌ Error loading positions for ${agentName}:`, error.message);
            }
            return [];
        }
    }

    // Load price data for a specific stock symbol
    async loadStockPrice(symbol) {
        if (this.priceCache[symbol]) {
            return this.priceCache[symbol];
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const url = `${this.baseDataPath}/daily_prices_${symbol}.json`;
            console.log(`📥 Fetching price data: ${url}`);
            
            const response = await fetch(url, {
                signal: controller.signal,
                cache: 'no-cache' // Ensure fresh data
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorMsg = `Failed to load price for ${symbol}: ${response.status} ${response.statusText}`;
                console.error(`❌ ${errorMsg}`);
                throw new Error(errorMsg);
            }

            const data = await response.json();
            if (!data || !data['Time Series (Daily)']) {
                const errorMsg = `Invalid price data format for ${symbol}`;
                console.error(`❌ ${errorMsg}`, data);
                throw new Error(errorMsg);
            }
            
            this.priceCache[symbol] = data['Time Series (Daily)'];
            console.log(`✅ Loaded price data for ${symbol} (${Object.keys(this.priceCache[symbol]).length} days)`);
            return this.priceCache[symbol];
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`⏱️  Timeout loading price for ${symbol} after 10 seconds`);
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error(`🌐 Network error loading price for ${symbol}:`, error.message);
                console.error(`   请检查：\n   1. 前端服务器是否在运行 (http://localhost:8000)\n   2. 数据文件路径是否正确\n   3. 浏览器控制台是否有 CORS 错误`);
            } else {
                console.error(`❌ Error loading price for ${symbol}:`, error.message);
            }
            // Return empty object instead of null to prevent repeated fetch attempts
            this.priceCache[symbol] = {};
            return this.priceCache[symbol];
        }
    }

    // Get closing price for a symbol on a specific date
    async getClosingPrice(symbol, date) {
        try {
            const prices = await this.loadStockPrice(symbol);
            if (!prices || !prices[date]) {
                console.warn(`No price data for ${symbol} on ${date}`);
                return null;
            }
            return parseFloat(prices[date]['4. close']);
        } catch (error) {
            console.error(`Error getting closing price for ${symbol} on ${date}:`, error);
            return null;
        }
    }

    // Calculate total asset value for a position on a given date
    async calculateAssetValue(position, date) {
        let totalValue = position.positions.CASH || 0;

        // Get all stock symbols (exclude CASH)
        const symbols = Object.keys(position.positions).filter(s => s !== 'CASH');

        // Batch load prices for all symbols at once
        const pricePromises = symbols
            .filter(s => position.positions[s] > 0)
            .map(symbol => this.getClosingPrice(symbol, date));

        const prices = await Promise.all(pricePromises);
        
        let priceIndex = 0;
        for (const symbol of symbols) {
            const shares = position.positions[symbol];
            if (shares > 0) {
                const price = prices[priceIndex++];
                if (price) {
                    totalValue += shares * price;
                }
            }
        }

        return totalValue;
    }

    // Load complete data for an agent including asset values over time
    async loadAgentData(agentName) {
        console.log(`Starting to load data for ${agentName}...`);
        try {
            const positions = await this.loadAgentPositions(agentName);
            if (positions.length === 0) {
                console.log(`No positions found for ${agentName}`);
                return null;
            }

            console.log(`Processing ${positions.length} positions for ${agentName}...`);
            
            // Group positions by date and take only the last position for each date
            const positionsByDate = {};
            positions.forEach(position => {
                const date = position.date;
                if (!positionsByDate[date] || position.id > positionsByDate[date].id) {
                    positionsByDate[date] = position;
                }
            });
            
            // Convert to array and sort by date
            const uniquePositions = Object.values(positionsByDate).sort((a, b) => {
                if (a.date !== b.date) {
                    return a.date.localeCompare(b.date);
                }
                return a.id - b.id;
            });
            
            console.log(`Reduced from ${positions.length} to ${uniquePositions.length} unique daily positions for ${agentName}`);
            
            const assetHistory = [];
            const totalPositions = uniquePositions.length;

            for (let i = 0; i < uniquePositions.length; i++) {
                const position = uniquePositions[i];
                const date = position.date;
                
                // Update loading progress
                if (i % 5 === 0 || i === totalPositions - 1) {
                    console.log(`Processing ${agentName}: ${i + 1}/${totalPositions} (${Math.round((i + 1) / totalPositions * 100)}%)`);
                }
                
                try {
                    const assetValue = await this.calculateAssetValue(position, date);
                    assetHistory.push({
                        date: date,
                        value: assetValue,
                        id: position.id,
                        action: position.this_action || null
                    });
                } catch (error) {
                    console.error(`Error calculating asset value for ${agentName} on ${date}:`, error);
                    // Continue with next position even if this one fails
                    if (assetHistory.length > 0) {
                        // Use previous value as fallback
                        assetHistory.push({
                            date: date,
                            value: assetHistory[assetHistory.length - 1].value,
                            id: position.id,
                            action: position.this_action || null
                        });
                    }
                }
            }

            // Detect trading mode
            const tradingMode = this.detectTradingMode(positions);
            
            const result = {
                name: agentName,
                positions: positions,
                assetHistory: assetHistory,
                initialValue: assetHistory[0]?.value || 10000,
                currentValue: assetHistory[assetHistory.length - 1]?.value || 0,
                return: assetHistory.length > 0 ?
                    ((assetHistory[assetHistory.length - 1].value - assetHistory[0].value) / assetHistory[0].value * 100) : 0,
                tradingMode: tradingMode  // BACKTEST, SIMULATE, or REAL
            };

            console.log(`Successfully loaded data for ${agentName}:`, {
                positions: positions.length,
                assetHistory: assetHistory.length,
                initialValue: result.initialValue,
                currentValue: result.currentValue,
                return: result.return
            });

            return result;
        } catch (error) {
            console.error(`Error loading data for ${agentName}:`, error);
            return null;
        }
    }

    // Load QQQ invesco data
    async loadQQQData() {
        try {
            console.log('Loading QQQ invesco data...');
            const response = await fetch(`${this.baseDataPath}/Adaily_prices_QQQ.json`);
            if (!response.ok) throw new Error('Failed to load QQQ data');
            
            const data = await response.json();
            const timeSeries = data['Time Series (Daily)'];
            
            // Convert to asset history format
            const assetHistory = [];
            const dates = Object.keys(timeSeries).sort();
            
            // Calculate QQQ performance starting from first agent's initial value
            const agentNames = Object.keys(this.agentData);
            let initialValue = 10000; // Default initial value
            
            if (agentNames.length > 0) {
                const firstAgent = this.agentData[agentNames[0]];
                if (firstAgent && firstAgent.assetHistory.length > 0) {
                    initialValue = firstAgent.assetHistory[0].value;
                }
            }
            
            // Find the earliest start date and latest end date across all agents
            let startDate = null;
            let endDate = null;
            if (agentNames.length > 0) {
                agentNames.forEach(agentName => {
                    const agent = this.agentData[agentName];
                    if (agent && agent.assetHistory.length > 0) {
                        const agentStartDate = agent.assetHistory[0].date;
                        const agentEndDate = agent.assetHistory[agent.assetHistory.length - 1].date;
                        
                        if (!startDate || agentStartDate < startDate) {
                            startDate = agentStartDate;
                        }
                        if (!endDate || agentEndDate > endDate) {
                            endDate = agentEndDate;
                        }
                    }
                });
            }
            
            let qqqStartPrice = null;
            let currentValue = initialValue;
            
            for (const date of dates) {
                if (startDate && date < startDate) continue;
                if (endDate && date > endDate) continue;
                
                const price = parseFloat(timeSeries[date]['4. close']);
                if (!qqqStartPrice) {
                    qqqStartPrice = price;
                }
                
                // Calculate QQQ performance relative to start
                const qqqReturn = (price - qqqStartPrice) / qqqStartPrice;
                currentValue = initialValue * (1 + qqqReturn);
                
                assetHistory.push({
                    date: date,
                    value: currentValue,
                    id: `qqq-${date}`,
                    action: null
                });
            }
            
            const result = {
                name: 'QQQ',
                positions: [],
                assetHistory: assetHistory,
                initialValue: initialValue,
                currentValue: assetHistory.length > 0 ? assetHistory[assetHistory.length - 1].value : initialValue,
                return: assetHistory.length > 0 ?
                    ((assetHistory[assetHistory.length - 1].value - assetHistory[0].value) / assetHistory[0].value * 100) : 0
            };
            
            console.log('Successfully loaded QQQ data:', {
                assetHistory: assetHistory.length,
                initialValue: result.initialValue,
                currentValue: result.currentValue,
                return: result.return
            });
            
            return result;
        } catch (error) {
            console.error('Error loading QQQ data:', error);
            return null;
        }
    }

    // Load all agents data
    async loadAllAgentsData() {
        console.log('🚀 Starting to load all agents data...');
        console.log(`📂 Base data path: ${this.baseDataPath}`);
        
        try {
            const agents = await this.loadAgentList();
            console.log(`📊 Found ${agents.length} agent(s):`, agents);
            
            if (agents.length === 0) {
                console.warn('⚠️  No agents found! Please check:');
                console.warn('   1. Data files exist in docs/data/agent_data/');
                console.warn('   2. Agent names match the expected patterns');
                console.warn('   3. Position files are named correctly (position/position.jsonl)');
            }
            
            const allData = {};

            for (let i = 0; i < agents.length; i++) {
                const agent = agents[i];
                console.log(`\n📦 [${i + 1}/${agents.length}] Loading data for ${agent}...`);
                try {
                    const data = await this.loadAgentData(agent);
                    if (data) {
                        allData[agent] = data;
                        console.log(`✅ Successfully loaded ${agent}: ${data.positions.length} positions, ${data.assetHistory.length} asset history points`);
                    } else {
                        console.warn(`⚠️  Failed to load data for ${agent}`);
                    }
                } catch (error) {
                    console.error(`❌ Error loading data for ${agent}:`, error);
                    console.error('   Stack:', error.stack);
                }
            }

            console.log(`\n📊 Final allData keys:`, Object.keys(allData));
            this.agentData = allData;
            
            // Load QQQ invesco data
            console.log('\n📈 Loading QQQ benchmark data...');
            try {
                const qqqData = await this.loadQQQData();
                if (qqqData) {
                    allData['QQQ'] = qqqData;
                    console.log(`✅ Successfully added QQQ benchmark: ${qqqData.assetHistory.length} data points`);
                } else {
                    console.warn('⚠️  Failed to load QQQ benchmark data');
                }
            } catch (error) {
                console.error('❌ Error loading QQQ data:', error);
            }
            
            if (Object.keys(allData).length === 0) {
                throw new Error('No data loaded! Please check the console for details.');
            }
            
            return allData;
        } catch (error) {
            console.error('❌ Fatal error in loadAllAgentsData:', error);
            console.error('   Stack:', error.stack);
            throw error;
        }
    }

    // Get current holdings for an agent (latest position)
    getCurrentHoldings(agentName) {
        const data = this.agentData[agentName];
        if (!data || !data.positions || data.positions.length === 0) return null;

        const latestPosition = data.positions[data.positions.length - 1];
        return latestPosition && latestPosition.positions ? latestPosition.positions : null;
    }

    // Get trade history for an agent
    getTradeHistory(agentName) {
        const data = this.agentData[agentName];
        if (!data) return [];

        return data.positions
            .filter(p => p.this_action)
            .map(p => ({
                date: p.date,
                action: p.this_action.action,
                symbol: p.this_action.symbol,
                amount: p.this_action.amount
            }))
            .reverse(); // Most recent first
    }

    // Format number as currency
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    }

    // Format percentage
    formatPercent(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    }

    // Get nice display name for agent
    getAgentDisplayName(agentName) {
        const names = {
            'gemini-2.5-flash': 'Gemini-2.5-flash',
            'qwen3-max': 'Qwen3-max',
            'gpt-5': 'GPT-5',
            'deepseek-chat-v3.1': 'DeepSeek-v3.1',
            'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
            'QQQ': 'QQQ invesco'
        };
        return names[agentName] || agentName;
    }
    
    // Get trading mode display text
    getTradingModeText(mode) {
        const modeTexts = {
            'BACKTEST': '回测',
            'SIMULATE': '模拟盘',
            'REAL': '实盘'
        };
        return modeTexts[mode] || mode;
    }
    
    // Get trading mode badge color
    getTradingModeColor(mode) {
        const colors = {
            'BACKTEST': '#00d4ff',  // Cyan blue
            'SIMULATE': '#ffbe0b',  // Yellow
            'REAL': '#f56565'       // Red
        };
        return colors[mode] || '#718096';
    }

    // Get icon for agent (SVG file path)
    getAgentIcon(agentName) {
        const icons = {
            'gemini-2.5-flash': './figs/google.svg',
            'qwen3-max': './figs/qwen.svg',
            'gpt-5': './figs/openai.svg',
            'claude-3.7-sonnet': './figs/claude-color.svg',
            'deepseek-chat-v3.1': './figs/deepseek.svg',
            'QQQ': './figs/stock.svg'  // 使用默认图标
        };
        return icons[agentName] || './figs/stock.svg';
    }
    
    // Get agent name without version suffix for icon lookup
    getAgentIconKey(agentName) {
        // 处理可能的版本号变体
        if (agentName.includes('gemini')) return 'gemini-2.5-flash';
        if (agentName.includes('qwen')) return 'qwen3-max';
        if (agentName.includes('gpt')) return 'gpt-5';
        if (agentName.includes('claude')) return 'claude-3.7-sonnet';
        if (agentName.includes('deepseek')) return 'deepseek-chat-v3.1';
        return agentName;
    }

    // Get brand color for agent
    getAgentBrandColor(agentName) {
        const colors = {
            'gemini-2.5-flash': '#8A2BE2',      // Google purple
            'qwen3-max': '#0066ff',       // Qwen Blue
            'gpt-5': '#10a37f',                  // OpenAI Green
            'deepseek-chat-v3.1': '#4a90e2',  // DeepSeek Blue
            'claude-3.7-sonnet': '#cc785c', // Anthropic Orange
            'QQQ': '#ff6b00'                       // QQQ Orange
        };
        return colors[agentName] || null;
    }
}

// Export for use in other modules
window.DataLoader = DataLoader;
