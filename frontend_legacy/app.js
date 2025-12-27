const { useState, useEffect, useRef, useMemo } = React;

// API Base URL
const API_BASE = 'http://localhost:8005/api';

// --- Utility Components ---
const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
);

// --- Layout Components ---

const Sidebar = ({ activeView, onViewChange, version = "v1.0.0" }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
        { id: 'research', label: 'Market Research', icon: 'search' },
        { id: 'settings', label: 'Settings', icon: 'settings' }
    ];

    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-50">
            {/* Logo */}
            <div className="p-6 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/30">
                        <i data-lucide="zap" className="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">AI-Trader</h1>
                        <p className="text-xs text-slate-400 font-mono">Pro Terminal</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                            activeView === item.id 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <i data-lucide={item.icon} className={`w-5 h-5 ${activeView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}></i>
                        <span className="font-medium text-sm">{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
};

// --- Analysis Components (Strict Port from Stock Hackthon) ---

const StockAnalysisCard = ({ symbol, analysis, loading, onRunAnalysis }) => {
    if (!symbol) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="flex justify-center mb-4">
                    <i data-lucide="bar-chart-3" className="w-12 h-12 text-gray-400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">选择股票开始分析</h3>
                <p className="text-gray-500">请先选择一个股票代码来获取智能分析</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">正在分析中...</h3>
                <p className="text-gray-500">请稍等，我们正在为您生成深度分析报告</p>
            </div>
        );
    }

    if (!analysis) return null;

    const { recommendation, confidence_score, summary, key_metrics, timestamp, analysis_type } = analysis;
    
    const getRecommendationColor = (rec) => {
        switch ((rec || '').toUpperCase()) {
            case 'BUY': return 'text-green-600 bg-green-100';
            case 'SELL': return 'text-red-600 bg-red-100';
            case 'HOLD': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getTrendIcon = (trend) => {
        switch ((trend || '').toLowerCase()) {
            case 'bullish': return <i data-lucide="trending-up" className="w-5 h-5 text-green-600"></i>;
            case 'bearish': return <i data-lucide="trending-down" className="w-5 h-5 text-red-600"></i>;
            default: return <i data-lucide="bar-chart-3" className="w-5 h-5 text-gray-600"></i>;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">智能分析报告</h2>
                <div className="flex items-center space-x-2">
                    <i data-lucide="clock" className="w-4 h-4 text-gray-400"></i>
                    <span className="text-sm text-gray-500">
                        {timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}
                    </span>
                </div>
            </div>

            {/* 核心建议 */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">投资建议</h3>
                        <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(recommendation)}`}>
                                {recommendation}
                            </span>
                            <span className="text-sm text-gray-600">
                                置信度: {(confidence_score * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{symbol}</div>
                        <div className="text-sm text-gray-500">分析类型: {analysis_type || 'comprehensive'}</div>
                    </div>
                </div>
            </div>

            {/* 分析摘要 */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">分析摘要</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
            </div>

            {/* 关键指标 */}
            {key_metrics && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">关键指标</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center mb-2">
                                {getTrendIcon(key_metrics.trend)}
                                <span className="ml-2 text-sm font-medium text-gray-600">技术趋势</span>
                            </div>
                            <div className="text-lg font-semibold text-gray-900 capitalize">
                                {key_metrics.trend}
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center mb-2">
                                <i data-lucide="bar-chart-3" className="w-5 h-5 text-blue-600"></i>
                                <span className="ml-2 text-sm font-medium text-gray-600">RSI指标</span>
                            </div>
                            <div className="text-lg font-semibold text-gray-900">
                                {key_metrics.rsi ? key_metrics.rsi.toFixed(1) : 'N/A'}
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center mb-2">
                                <i data-lucide="trending-up" className="w-5 h-5 text-purple-600"></i>
                                <span className="ml-2 text-sm font-medium text-gray-600">市场情绪</span>
                            </div>
                            <div className="text-lg font-semibold text-gray-900 capitalize">
                                {key_metrics.sentiment}
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center mb-2">
                                <i data-lucide="target" className="w-5 h-5 text-orange-600"></i>
                                <span className="ml-2 text-sm font-medium text-gray-600">持仓状态</span>
                            </div>
                            <div className="text-lg font-semibold text-gray-900">
                                {key_metrics.has_position ? '有持仓' : '无持仓'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 详细分析 JSON (可选) */}
            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">详细分析</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(analysis, null, 2)}
                    </pre>
                </div>
            </div>

            {/* 重新分析按钮 */}
            <div className="mt-6 text-center">
                <button
                    onClick={onRunAnalysis}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                    {loading ? '分析中...' : '重新分析'}
                </button>
            </div>
        </div>
    );
};

const ChatInterface = ({ symbol, analysisResult }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Initial greeting based on analysis
    useEffect(() => {
        if (symbol && analysisResult) {
            const initialMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: `您好！我是AI股票分析助手。我已经为您分析了${symbol}，建议为**${analysisResult.recommendation}**，置信度为${(analysisResult.confidence_score * 100).toFixed(1)}%。\n\n您可以问我关于这只股票的任何问题，比如：\n- 这个建议的依据是什么？\n- 技术面分析的具体情况？\n- 市场消息面对这只股票的影响？\n- 我的持仓情况如何优化？`,
                timestamp: new Date()
            };
            setMessages([initialMessage]);
        }
    }, [symbol, analysisResult]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Use real API instead of simulation
            const res = await axios.post(`${API_BASE}/analysis/chat/${symbol}`, { message: userMessage.content });
            
            const assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.data.content,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '抱歉，我遇到了一些问题。请稍后重试，或者换一个方式提问。 Error: ' + err.message,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        if (analysisResult) {
            const initialMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: `对话已刷新。当前对${symbol}的分析建议是**${analysisResult.recommendation}**，置信度为${(analysisResult.confidence_score * 100).toFixed(1)}%。\n\n请继续提问！`,
                timestamp: new Date()
            };
            setMessages([initialMessage]);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg flex flex-col h-[600px]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center">
                    <i data-lucide="bot" className="w-5 h-5 text-blue-600 mr-2"></i>
                    <h3 className="text-lg font-semibold text-gray-800">AI分析助手</h3>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    <i data-lucide="refresh-cw" className="w-4 h-4 mr-1"></i>
                    刷新
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex items-start max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                message.role === 'user' ? 'bg-blue-600 ml-2' : 'bg-gray-300 mr-2'
                            }`}>
                                <i data-lucide={message.role === 'user' ? 'user' : 'bot'} className={`w-4 h-4 ${message.role === 'user' ? 'text-white' : 'text-gray-600'}`}></i>
                            </div>
                            <div className={`rounded-lg px-4 py-2 ${
                                message.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-800'
                            }`}>
                                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                                <div className={`text-xs mt-1 ${
                                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex items-start max-w-[85%]">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-300 mr-2">
                                <i data-lucide="bot" className="w-4 h-4 text-gray-600"></i>
                            </div>
                            <div className="bg-gray-100 rounded-lg px-4 py-2">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="询问关于这只股票的问题..."
                        className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        rows="2"
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        <i data-lucide="send" className="w-4 h-4"></i>
                    </button>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                    提示：可以问"建议"、"技术"、"消息"、"持仓"、"风险"等关键词
                </div>
            </div>
        </div>
    );
};

const AnalysisView = () => {
    const [symbol, setSymbol] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    const handleSearch = (e) => {
        e.preventDefault();
        const val = e.target.elements.symbol.value.trim().toUpperCase();
        if(val) {
            setSymbol(val);
            setAnalysis(null);
        }
    }

    const runAnalysis = async () => {
        if (!symbol) return;
        setAnalyzing(true);
        try {
            const res = await axios.post(`${API_BASE}/analysis/analyze/${symbol}`, {});
            setAnalysis(res.data);
        } catch (err) {
            alert('Analysis failed: ' + err.message);
        } finally {
            setAnalyzing(false);
        }
    };

    // Auto-run when symbol is selected
    useEffect(() => {
        if (symbol) {
            runAnalysis();
        }
    }, [symbol]);

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
            {/* Search Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Market Research</h2>
                    <p className="text-gray-500 mt-1">Deep fundamental and technical analysis powered by AI agents.</p>
                </div>
                <form onSubmit={handleSearch} className="w-full md:w-96 relative">
                    <i data-lucide="search" className="absolute left-4 top-3.5 w-5 h-5 text-gray-400"></i>
                    <input 
                        name="symbol"
                        type="text" 
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase font-medium placeholder:normal-case"
                        placeholder="Search ticker (e.g. NVDA)"
                    />
                </form>
            </div>
            
            {symbol ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="xl:col-span-2 space-y-8">
                        <StockAnalysisCard 
                            symbol={symbol} 
                            analysis={analysis} 
                            loading={analyzing} 
                            onRunAnalysis={runAnalysis} 
                        />
                    </div>
                    
                    {/* Right Column */}
                    <div className="xl:col-span-1">
                        <div className="sticky top-8">
                            <ChatInterface symbol={symbol} analysisResult={analysis} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-24 text-center">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i data-lucide="bar-chart-3" className="w-10 h-10 text-gray-400"></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Start Your Research</h3>
                    <p className="text-gray-500 mt-2 mb-8 max-w-md mx-auto">Enter a stock symbol above to deploy AI agents for real-time market analysis and insights.</p>
                    <div className="flex justify-center gap-3">
                        {["AAPL", "TSLA", "NVDA", "MSFT"].map(t => (
                            <button 
                                key={t} 
                                onClick={() => setSymbol(t)}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Settings View ---

const SettingsView = () => {
    const [keys, setKeys] = useState({
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        ALPHAVANTAGE_API_KEY: '',
        FINANCIAL_DATASETS_API_KEY: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            const res = await axios.get(`${API_BASE}/settings/keys`);
            if (res.data.success) {
                setKeys(res.data.keys);
            }
        } catch (err) {
            console.error("Failed to fetch keys", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await axios.post(`${API_BASE}/settings/keys`, keys);
            alert('Settings saved successfully!');
            fetchKeys(); // Refresh to get masked versions if needed
        } catch (err) {
            alert('Failed to save settings: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key, value) => {
        setKeys(prev => ({ ...prev, [key]: value }));
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            <div className="pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="text-gray-500 mt-1">Manage API keys and external service connections.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <i data-lucide="brain-circuit" className="w-5 h-5 mr-2 text-blue-600"></i>
                        AI Models
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
                            <input 
                                type="password" 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                placeholder="sk-..."
                                value={keys.OPENAI_API_KEY}
                                onChange={e => handleChange('OPENAI_API_KEY', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
                            <input 
                                type="password" 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                placeholder="sk-ant-..."
                                value={keys.ANTHROPIC_API_KEY}
                                onChange={e => handleChange('ANTHROPIC_API_KEY', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <i data-lucide="line-chart" className="w-5 h-5 mr-2 text-green-600"></i>
                        Market Data Providers
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alpha Vantage API Key</label>
                            <input 
                                type="password" 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                value={keys.ALPHAVANTAGE_API_KEY}
                                onChange={e => handleChange('ALPHAVANTAGE_API_KEY', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Financial Datasets API Key</label>
                            <input 
                                type="password" 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                value={keys.FINANCIAL_DATASETS_API_KEY}
                                onChange={e => handleChange('FINANCIAL_DATASETS_API_KEY', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        type="submit" 
                        disabled={saving}
                        className="px-8 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors shadow-lg shadow-slate-900/20 flex items-center"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <i data-lucide="save" className="w-4 h-4 mr-2"></i>
                                Save Settings
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- Config Tab ---
const ConfigTab = ({ strategyId, mode, config, onSave, onRefresh }) => {
    const [localConfig, setLocalConfig] = useState(config || {});
    const [prompt, setPrompt] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLocalConfig(config || {});
        fetchPrompt();
    }, [config, strategyId, mode]);

    const fetchPrompt = async () => {
        try {
            const res = await axios.get(`${API_BASE}/strategies/${strategyId}/prompt/${mode}`);
            setPrompt(res.data.prompt);
        } catch (err) {
            console.error("Failed to fetch prompt", err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save config
            await axios.post(`${API_BASE}/strategies/${strategyId}/config/${mode}`, { config: localConfig });
            // Save prompt
            await axios.post(`${API_BASE}/strategies/${strategyId}/prompt/${mode}`, { prompt });
            
            onSave && onSave();
            alert('Configuration saved successfully!');
        } catch (err) {
            alert('Failed to save configuration: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateAgentConfig = (key, value) => {
        setLocalConfig(prev => ({
            ...prev,
            agent_config: {
                ...prev.agent_config,
                [key]: parseFloat(value)
            }
        }));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Prompt Config */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">📝 System Prompt</h3>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">System Instruction</label>
                    <textarea 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                        rows="10"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="You are a trading agent..."
                    ></textarea>
                </div>
            </div>

            {/* Agent Config */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">⚙️ Agent Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Steps</label>
                        <input 
                            type="number" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={localConfig.agent_config?.max_steps || 30}
                            onChange={e => updateAgentConfig('max_steps', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
                        <input 
                            type="number" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={localConfig.agent_config?.max_retries || 3}
                            onChange={e => updateAgentConfig('max_retries', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Base Delay (seconds)</label>
                        <input 
                            type="number" 
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={localConfig.agent_config?.base_delay || 1.0}
                            onChange={e => updateAgentConfig('base_delay', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Initial Cash ($)</label>
                        <input 
                            type="number" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={localConfig.agent_config?.initial_cash || 10000}
                            onChange={e => updateAgentConfig('initial_cash', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-4">
                <button 
                    onClick={onRefresh}
                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                    Reset
                </button>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center shadow-sm"
                >
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
};

// --- Asset Tab ---
const AssetTab = ({ strategyId, mode, results, isRunning, onRun, onStop }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);
    const [logs, setLogs] = useState([]);
    const [logDates, setLogDates] = useState([]);
    const [selectedLogDate, setSelectedLogDate] = useState('');

    // Fetch log dates
    useEffect(() => {
        fetchLogDates();
    }, [strategyId, mode]);

    const fetchLogDates = async () => {
        try {
            const res = await axios.get(`${API_BASE}/strategies/${strategyId}/logs/dates/${mode}`);
            setLogDates(res.data.dates);
            if (res.data.dates.length > 0 && !selectedLogDate) {
                setSelectedLogDate(res.data.dates[res.data.dates.length - 1]); // Select latest
            }
        } catch (err) {
            console.error("Failed to fetch log dates", err);
        }
    };

    // Fetch logs when date changes
    useEffect(() => {
        if (selectedLogDate) {
            fetchLogs(selectedLogDate);
        }
    }, [selectedLogDate, strategyId, mode]);

    const fetchLogs = async (date) => {
        try {
            const res = await axios.get(`${API_BASE}/strategies/${strategyId}/logs/${mode}/${date}`);
            setLogs(res.data.logs || []);
        } catch (err) {
            console.error("Failed to fetch logs", err);
        }
    };

    // Render Chart
    useEffect(() => {
        if (!results || !results.asset_evolution || !chartRef.current) return;

        const ctx = chartRef.current.getContext('2d');
        
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const data = results.asset_evolution;
        const labels = data.map(d => d.date);
        const values = data.map(d => d.total_asset);
        
        // Calculate returns for color
        const initialValue = values[0];
        const isPositive = values[values.length - 1] >= initialValue;
        const borderColor = isPositive ? '#10b981' : '#ef4444';
        const backgroundColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Asset Value ($)',
                    data: values,
                    borderColor: borderColor,
                    backgroundColor: backgroundColor,
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    fill: true,
                    tension: 0.1
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
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: '#f3f4f6'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [results]);

    // Calculate metrics
    const metrics = useMemo(() => {
        if (!results || !results.asset_evolution || results.asset_evolution.length === 0) return null;
        
        const assets = results.asset_evolution;
        const initial = assets[0].total_asset;
        const current = assets[assets.length - 1].total_asset;
        const returns = ((current - initial) / initial) * 100;
        
        // Calculate max drawdown
        let maxDrawdown = 0;
        let peak = -Infinity;
        for (let item of assets) {
            if (item.total_asset > peak) peak = item.total_asset;
            const drawdown = (peak - item.total_asset) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        return {
            initial: initial,
            current: current,
            returns: returns,
            maxDrawdown: maxDrawdown * 100,
            days: assets.length
        };
    }, [results]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Control Panel */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-gray-600 text-sm">
                    Mode: <span className="font-bold text-gray-900 uppercase">{mode}</span>
                    {mode === 'backtest' && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Historical Data</span>}
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={onRun}
                        disabled={isRunning}
                        className={`px-6 py-2 rounded-lg font-medium text-white shadow-sm transition-all ${
                            isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:shadow-md'
                        }`}
                    >
                        {isRunning ? 'Running...' : `Run ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
                    </button>
                    {isRunning && (
                        <button 
                            onClick={onStop}
                            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium shadow-sm transition-all"
                        >
                            Stop
                        </button>
                    )}
                </div>
            </div>

            {/* Metrics Grid */}
            {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Initial Cash</div>
                        <div className="text-lg font-bold text-gray-900">${metrics.initial.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Current Asset</div>
                        <div className="text-lg font-bold text-gray-900">${metrics.current.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Total Return</div>
                        <div className={`text-lg font-bold ${metrics.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {metrics.returns >= 0 ? '+' : ''}{metrics.returns.toFixed(2)}%
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Max Drawdown</div>
                        <div className="text-lg font-bold text-red-600">-{metrics.maxDrawdown.toFixed(2)}%</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Trading Days</div>
                        <div className="text-lg font-bold text-gray-900">{metrics.days}</div>
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">📈 Asset Evolution</h3>
                <div className="h-80 relative">
                    <canvas ref={chartRef}></canvas>
                </div>
            </div>

            {/* Logs */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-800">🤖 AI Thinking Process</h3>
                    <select 
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedLogDate}
                        onChange={(e) => setSelectedLogDate(e.target.value)}
                    >
                        {logDates.map(date => (
                            <option key={date} value={date}>{date}</option>
                        ))}
                    </select>
                </div>
                
                <div className="logs-container h-96 overflow-y-auto bg-gray-50 rounded-lg p-4 border border-gray-200 font-mono text-xs leading-relaxed">
                    {logs.length > 0 ? (
                        logs.map((log, idx) => (
                            <div key={idx} className="mb-4 last:mb-0">
                                <div className="text-gray-400 text-[10px] mb-1">{log.timestamp}</div>
                                <div className="pl-2 border-l-2 border-blue-200">
                                    {log.new_messages && log.new_messages.map((msg, msgIdx) => (
                                        <div key={msgIdx} className={`mb-2 ${msg.role === 'user' ? 'text-blue-700' : 'text-gray-800'}`}>
                                            <span className="font-bold uppercase text-[10px] tracking-wider bg-gray-200 px-1 rounded mr-2">{msg.role}</span>
                                            <span className="whitespace-pre-wrap">{msg.content}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-400 py-20">Select a date to view logs</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Create Strategy Modal ---
const CreateStrategyModal = ({ isOpen, onClose, onCreated }) => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/strategies`, {
                strategy_name: name,
                description: desc
            });
            onCreated();
            onClose();
            setName('');
            setDesc('');
        } catch (error) {
            alert('Failed to create strategy: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md transform transition-all scale-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Create New Strategy</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <i data-lucide="x" className="w-5 h-5"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Strategy Name</label>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="e.g. Momentum Alpha V1"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            rows="3"
                            placeholder="Describe your strategy logic..."
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                        ></textarea>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors flex items-center"
                        >
                            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                            Create Strategy
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Agent/Strategy Components ---

const AgentCard = ({ strategy, onSelect, onDelete }) => {
    const statusConfig = {
        'design': { color: 'gray', label: 'Draft', icon: 'edit-2' },
        'backtest': { color: 'blue', label: 'Backtesting', icon: 'history' },
        'simulate': { color: 'yellow', label: 'Paper Trading', icon: 'play-circle' },
        'real': { color: 'red', label: 'Live Trading', icon: 'activity' }
    };
    
    const status = statusConfig[strategy.status] || statusConfig['design'];

    return (
        <div 
            onClick={() => onSelect(strategy)}
            className="group bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="arrow-up-right" className="w-5 h-5 text-blue-500"></i>
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    strategy.status === 'real' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                }`}>
                    <i data-lucide="bot" className="w-6 h-6"></i>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{strategy.strategy_name}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{strategy.strategy_id.substring(0, 18)}...</p>
                </div>
            </div>
            
            <div className="mb-6 h-12">
                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                    {strategy.description || "No description provided for this agent."}
                </p>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full bg-${status.color}-500`}></div>
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{status.label}</span>
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-200">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(strategy.strategy_id); }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Agent"
                    >
                        <i data-lucide="trash-2" className="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Dashboard View ---

const DashboardView = ({ strategies, onNavigate, onCreate, onDelete }) => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl shadow-slate-900/10">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-slate-800 p-2 rounded-lg">
                            <i data-lucide="wallet" className="w-6 h-6 text-blue-400"></i>
                        </div>
                        <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">Live</span>
                    </div>
                    <div className="text-3xl font-bold mb-1">$0.00</div>
                    <div className="text-sm text-slate-400">Total Equity Managed</div>
                </div>
                
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-blue-50 p-2 rounded-lg">
                            <i data-lucide="bot" className="w-6 h-6 text-blue-600"></i>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">{strategies.length}</div>
                    <div className="text-sm text-gray-500">Active Agents</div>
                </div>
                
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-purple-50 p-2 rounded-lg">
                            <i data-lucide="activity" className="w-6 h-6 text-purple-600"></i>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">0</div>
                    <div className="text-sm text-gray-500">Trades Today</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex justify-between items-center pt-4">
                <h2 className="text-xl font-bold text-gray-900">Your Agents</h2>
                <button 
                    onClick={onCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center shadow-sm shadow-blue-600/20"
                >
                    <i data-lucide="plus" className="w-4 h-4 mr-2"></i>
                    Deploy New Agent
                </button>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {strategies.map(s => (
                    <AgentCard 
                        key={s.strategy_id} 
                        strategy={s} 
                        onSelect={() => onNavigate('strategies', s)}
                        onDelete={onDelete}
                    />
                ))}
                {strategies.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <i data-lucide="bot" className="w-8 h-8 text-gray-300"></i>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No agents deployed</h3>
                        <p className="text-gray-500 mt-1 mb-6 max-w-sm mx-auto">Create your first autonomous trading agent to start managing your portfolio.</p>
                        <button onClick={onCreate} className="text-blue-600 font-medium hover:text-blue-700">Deploy Agent &rarr;</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Strategy Detail Component ---
const StrategyDetail = ({ strategy, onBack }) => {
    const [activeTab, setActiveTab] = useState('asset'); 
    const [activeMode, setActiveMode] = useState('backtest');
    const [config, setConfig] = useState(null);
    const [results, setResults] = useState(null);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        // Mock fetches or real fetches
        const fetchAll = async () => {
             try {
                const [cfgRes, resRes, statusRes] = await Promise.all([
                    axios.get(`${API_BASE}/strategies/${strategy.strategy_id}/config/${activeMode}`),
                    axios.get(`${API_BASE}/strategies/${strategy.strategy_id}/results/${activeMode}`).catch(() => ({data: {results: null}})),
                    axios.get(`${API_BASE}/strategies/${strategy.strategy_id}/status/${activeMode}`).catch(() => ({data: {status: {is_running: false}}})),
                ]);
                setConfig(cfgRes.data.config);
                setResults(resRes.data.results);
                setIsRunning(statusRes.data.status?.is_running || false);
            } catch (e) { console.error(e); }
        };
        fetchAll();
        const interval = setInterval(fetchAll, 3000);
        return () => clearInterval(interval);
    }, [strategy.strategy_id, activeMode]);

    const handleRun = async () => {
        try {
            await axios.post(`${API_BASE}/strategies/${strategy.strategy_id}/run/${activeMode}`, activeMode === 'real' ? {confirm: true} : {});
            setIsRunning(true);
        } catch (err) { alert(err.message); }
    };

    const handleStop = async () => {
        try {
            await axios.post(`${API_BASE}/strategies/${strategy.strategy_id}/stop/${activeMode}`);
            setIsRunning(false);
        } catch (err) { alert(err.message); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <i data-lucide="arrow-left" className="w-5 h-5"></i>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{strategy.strategy_name}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <span className="font-mono">{strategy.strategy_id}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span className={`flex items-center ${isRunning ? 'text-green-600' : 'text-gray-400'}`}>
                                <div className={`w-2 h-2 rounded-full mr-2 ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                {isRunning ? 'Agent Running' : 'Agent Idle'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['backtest', 'simulate', 'real'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setActiveMode(mode)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                activeMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    {[
                        { id: 'config', label: 'Agent Config', icon: 'settings' },
                        { id: 'asset', label: 'Performance', icon: 'trending-up' },
                        { id: 'analysis', label: 'Research', icon: 'search' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center py-4 px-1 border-b-2 text-sm font-medium ${
                                activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <i data-lucide={tab.icon} className="w-4 h-4 mr-2"></i>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'config' && (
                    <ConfigTab strategyId={strategy.strategy_id} mode={activeMode} config={config} onSave={()=>{}} onRefresh={()=>{}} />
                )}
                {activeTab === 'asset' && (
                    <AssetTab strategyId={strategy.strategy_id} mode={activeMode} results={results} isRunning={isRunning} onRun={handleRun} onStop={handleStop} />
                )}
                {activeTab === 'analysis' && (
                    <AnalysisView />
                )}
            </div>
        </div>
    );
};

// --- App Container ---

const App = () => {
    const [view, setView] = useState('dashboard'); // dashboard, research, settings (removed strategies)
    const [strategies, setStrategies] = useState([]);
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchStrategies = async () => {
        try {
            const res = await axios.get(`${API_BASE}/strategies`);
            setStrategies(res.data.strategies);
        } catch (error) {
            console.error("Failed to fetch strategies:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStrategies();
        const interval = setInterval(fetchStrategies, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [view, strategies, selectedStrategy, loading]);

    const handleDeleteStrategy = async (id) => {
        if (!confirm('Are you sure you want to delete this agent?')) return;
        try {
            await axios.delete(`${API_BASE}/strategies/${id}`);
            fetchStrategies();
        } catch (error) {
            alert('Failed to delete: ' + error.message);
        }
    };

    // Render logic
    const renderContent = () => {
        if (view === 'research') return <AnalysisView />;
        
        if (view === 'settings') return <SettingsView />;

        if (view === 'strategies') { // Kept as an internal state for detail view
             if (selectedStrategy) {
                return <StrategyDetail strategy={selectedStrategy} onBack={() => { setSelectedStrategy(null); setView('dashboard'); }} />;
            }
            // Fallback to dashboard if no strategy selected
            return <DashboardView strategies={strategies} onNavigate={(v, s) => { setView('strategies'); setSelectedStrategy(s); }} onCreate={() => setCreateModalOpen(true)} onDelete={handleDeleteStrategy} />;
        }

        if (view === 'dashboard') {
            return <DashboardView strategies={strategies} onNavigate={(v, s) => { setView('strategies'); setSelectedStrategy(s); }} onCreate={() => setCreateModalOpen(true)} onDelete={handleDeleteStrategy} />;
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
            <Sidebar activeView={view === 'strategies' ? 'dashboard' : view} onViewChange={(v) => { setView(v); setSelectedStrategy(null); }} />
            
            <main className="flex-1 ml-64 p-8 overflow-y-auto">
                {/* Top Header (Mobile only or Breadcrumbs could go here) */}
                <div className="mb-8 flex justify-between items-center md:hidden">
                    <h1 className="text-xl font-bold">AI-Trader</h1>
                </div>

                {renderContent()}
            </main>

            <CreateStrategyModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setCreateModalOpen(false)}
                onCreated={fetchStrategies}
            />
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);