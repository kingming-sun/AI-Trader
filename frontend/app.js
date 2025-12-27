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

// --- Analysis Components (Ported from Stock Hackthon) ---

const MarkdownText = ({ text }) => {
    // Simple markdown renderer
    if (!text) return null;
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br />');
    return <div dangerouslySetInnerHTML={{ __html: html }} className="text-sm leading-relaxed" />;
};

const Progress = ({ value, color }) => (
    <div className="h-2 w-full bg-muted rounded overflow-hidden">
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} className={`h-full ${color}`} />
    </div>
);

const ResearchHome = ({ navigate }) => {
    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="text-2xl font-semibold mb-2">欢迎使用 Stock Analysis</div>
                <div className="text-sm text-muted-foreground">选择一个功能开始：分析、报告、对话或预览。</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => navigate('analysis')} className="cursor-pointer rounded-xl border border-border bg-card p-4 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2 mb-2"><i data-lucide="line-chart" className="h-5 w-5"></i><div className="font-medium">分析</div></div>
                    <div className="text-sm text-muted-foreground">技术指标与行情数据的可视化分析。</div>
                </div>
                <div onClick={() => navigate('report')} className="cursor-pointer rounded-xl border border-border bg-card p-4 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2 mb-2"><i data-lucide="file-text" className="h-5 w-5"></i><div className="font-medium">报告</div></div>
                    <div className="text-sm text-muted-foreground">生成并查看股票分析报告。</div>
                </div>
                <div onClick={() => navigate('chat')} className="cursor-pointer rounded-xl border border-border bg-card p-4 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2 mb-2"><i data-lucide="message-square" className="h-5 w-5"></i><div className="font-medium">对话</div></div>
                    <div className="text-sm text-muted-foreground">与AI助手交流股票问题。</div>
                </div>
                <div onClick={() => navigate('preview')} className="cursor-pointer rounded-xl border border-border bg-card p-4 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2 mb-2"><i data-lucide="eye" className="h-5 w-5"></i><div className="font-medium">预览</div></div>
                    <div className="text-sm text-muted-foreground">加载外部页面进行预览。</div>
                </div>
            </div>
        </div>
    );
};

const KLineChart = ({ data }) => {
    const W = 640;
    const H = 360;
    const PL = 48, PR = 24, PT = 24, PB = 46;
    
    if (!data || data.length === 0) return <div>No Data</div>;

    const minV = Math.min(...data.map(d => d.close));
    const maxV = Math.max(...data.map(d => d.close));
    const scaleY = (v) => PT + (1 - (v - minV) / ((maxV - minV) || 1)) * (H - PT - PB);
    const scaleX = (i) => PL + i * ((W - PL - PR) / Math.max(1, data.length - 1));
    
    const toPath = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d[key])}`).join(' ');
    
    const areaPath = () => {
        const top = toPath('close');
        const lastX = scaleX(data.length - 1);
        const firstX = scaleX(0);
        return `${top} L ${lastX} ${H - PB} L ${firstX} ${H - PB} Z`;
    };

    const yTicks = 5;
    const yStep = (maxV - minV) / yTicks;
    const xIndices = [0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5), Math.floor(data.length * 0.75), data.length - 1]
        .filter((i, idx, arr) => i >= 0 && i < data.length && arr.indexOf(i) === idx);

    const fmt = (s) => s ? s.slice(5, 10).replace(/-/g, '/') : '';
    
    const firstPrice = data[0]?.close || 0;
    const lastPrice = data[data.length - 1]?.close || 0;
    const changePercent = ((lastPrice - firstPrice) / (firstPrice || 1)) * 100;
    const isPositive = changePercent >= 0;

    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">价格走势</div>
                <div className={isPositive ? 'text-green-600' : 'text-red-600'}>{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</div>
            </div>
            <div className="w-full overflow-hidden rounded-lg border border-border bg-background relative">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[360px]" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} fill="#fff" stroke="#e2e8f0" />
                    {Array.from({ length: yTicks + 1 }, (_, k) => (
                        <g key={`h-${k}`}>
                            <line x1={PL} y1={PT + k * ((H - PT - PB) / yTicks)} x2={W - PR} y2={PT + k * ((H - PT - PB) / yTicks)} stroke="#e2e8f0" strokeDasharray="4 4" />
                            <text x={PL - 8} y={PT + k * ((H - PT - PB) / yTicks) + 4} textAnchor="end" fontSize={12} fill="#64748b">{(maxV - k * yStep).toFixed(0)}</text>
                        </g>
                    ))}
                    <path d={areaPath()} fill="url(#colorPrice)" />
                    <path d={toPath('close')} stroke="#3b82f6" strokeWidth={2} fill="none" />
                    {data[0].ma5 && <path d={toPath('ma5')} stroke="#8b5cf6" strokeWidth={1.5} fill="none" />}
                    {data[0].ma20 && <path d={toPath('ma20')} stroke="#f59e0b" strokeWidth={1.5} fill="none" />}
                    <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#e2e8f0" />
                    {xIndices.map((i) => (
                        <g key={`v-${i}`}>
                            <line x1={scaleX(i)} y1={H - PB} x2={scaleX(i)} y2={H - PB - 6} stroke="#e2e8f0" />
                            <text x={scaleX(i)} y={H - PB + 18} textAnchor="middle" fontSize={12} fill="#64748b">{fmt(data[i]?.time)}</text>
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};

const ResearchNews = ({ navigate, initialSymbol, embedded }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [symbol, setSymbol] = useState(initialSymbol || '');

    useEffect(() => {
        if (initialSymbol) setSymbol(initialSymbol);
    }, [initialSymbol]);

    useEffect(() => {
        if (!symbol) return;
        setLoading(true);
        axios.get(`${API_BASE}/analysis/news/${symbol}`)
            .then(res => setNews(res.data.feed || []))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [symbol]);

    const formatDate = (str) => {
        if (!str || str.length < 8) return str;
        return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)} ${str.slice(9, 11)}:${str.slice(11, 13)}`;
    };

    return (
        <div className="space-y-4">
            {!embedded && (
                 <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => navigate('home')} className="p-2 hover:bg-gray-100 rounded-lg"><i data-lucide="arrow-left" className="w-5 h-5"></i></button>
                    <h2 className="text-xl font-bold">{symbol} Latest News</h2>
                </div>
             )}
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {loading && <div className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>}
                {!loading && news.length === 0 && <div className="text-center p-8 text-muted-foreground">No news found for {symbol}.</div>}
                {news.map((item, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4 hover:border-blue-500/50 transition-colors">
                        <div className="flex justify-between items-start mb-2 gap-4">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-blue-600 line-clamp-2">{item.title}</a>
                            <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">{formatDate(item.time_published)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{item.summary}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="bg-muted px-2 py-1 rounded-md font-medium">{item.source}</span>
                            {item.overall_sentiment_label && (
                                <span className={`px-2 py-1 rounded-md font-medium ${
                                    item.overall_sentiment_label.includes('Bullish') ? 'bg-green-100 text-green-700' :
                                    item.overall_sentiment_label.includes('Bearish') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {item.overall_sentiment_label}
                                </span>
                            )}
                            {item.topics && item.topics.slice(0, 3).map((t, idx) => (
                                <span key={idx} className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md">{t.topic}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ResearchAnalysis = ({ navigate, params }) => {
    const [selected, setSelected] = useState(params.symbol ? { symbol: params.symbol } : null);
    const [position, setPosition] = useState({ shares: 0, cost: 0, cash: 0, assets: 0 });
    const [analysis, setAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [tab, setTab] = useState('kline');
    
    const presets = [
        { symbol: 'AAPL', name: 'Apple Inc.', nameCN: '苹果' },
        { symbol: 'TSLA', name: 'Tesla, Inc.', nameCN: '特斯拉' },
        { symbol: 'NVDA', name: 'NVIDIA Corp.', nameCN: '英伟达' },
        { symbol: 'MSFT', name: 'Microsoft Corp.', nameCN: '微软' }
    ];

    const analyze = async () => {
        if (!selected) return;
        setIsAnalyzing(true);
        try {
            // Fetch logic
            const [quoteRes, historyRes, aiRes] = await Promise.all([
                axios.get(`${API_BASE}/analysis/quote/${selected.symbol}`),
                axios.get(`${API_BASE}/analysis/history/${selected.symbol}`),
                axios.post(`${API_BASE}/analysis/analyze/${selected.symbol}`, {
                    analysis_type: 'comprehensive',
                    portfolio: position.shares ? { positions: { [selected.symbol]: { shares: position.shares, avg_cost: position.cost } } } : {}
                })
            ]);

            // Handle Quote (AV Raw Format)
            const quoteData = quoteRes.data["Global Quote"] || {};
            const quote = {
                price: parseFloat(quoteData["05. price"]) || 0,
                change_percent: parseFloat((quoteData["10. change percent"] || "0").replace('%', ''))
            };

            // Handle History (AV Raw Format)
            const historyRaw = historyRes.data["Time Series (Daily)"] || {};
            const history = Object.entries(historyRaw).map(([date, val]) => ({
                date,
                open: parseFloat(val["1. open"]),
                high: parseFloat(val["2. high"]),
                low: parseFloat(val["3. low"]),
                close: parseFloat(val["4. close"]),
                volume: parseFloat(val["5. volume"])
            })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Ascending

            const ai = aiRes.data;

            // Process candles
            const candles = history.map(d => ({
                time: d.date,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume,
                ma5: 0, ma20: 0
            }));

            // Calc MA
            for (let i = 0; i < candles.length; i++) {
                candles[i].ma5 = candles.slice(Math.max(0, i - 4), i + 1).reduce((s, c) => s + c.close, 0) / Math.min(i + 1, 5);
                candles[i].ma20 = candles.slice(Math.max(0, i - 19), i + 1).reduce((s, c) => s + c.close, 0) / Math.min(i + 1, 20);
            }

            // Calc Indicators (Simplified)
            const price = quote.price || candles[candles.length-1]?.close || 0;
            const changePercent = quote.change_percent || 0;
            const rsi = 50; // Mock or calc
            
            setAnalysis({
                price,
                changePercent,
                kline: candles,
                rsi,
                summary: ai.summary,
                recommendation: ai.recommendation,
                confidence: ai.confidence_score,
                key_metrics: ai.key_metrics,
                detailed_analysis: ai.detailed_analysis,
                levels: { resistance: 0, support: 0, current: price }, // Simplified
                volume: { avg: 0, today: 0 }
            });

        } catch (e) {
            console.error(e);
            const msg = e.response?.data?.error || e.message;
            alert('Analysis failed: ' + msg);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
                <h2 className="text-xl font-bold">Market Analysis</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <div className="lg:col-span-1 space-y-4">
                     <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="font-semibold">选择股票</div>
                        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 bg-muted">
                            <i data-lucide="search" className="h-4 w-4 text-muted-foreground"></i>
                            <input 
                                placeholder="Search symbol..." 
                                className="w-full bg-transparent outline-none text-sm" 
                                onChange={(e) => {
                                    const v = e.target.value.trim().toUpperCase();
                                    if(v.length > 0) setSelected({symbol: v});
                                }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {presets.map(p => (
                                <button key={p.symbol} onClick={() => setSelected(p)} className={`px-3 py-2 rounded-md border text-sm ${selected?.symbol === p.symbol ? 'bg-muted' : ''}`}>
                                    {p.symbol}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={analyze}
                            disabled={!selected || isAnalyzing}
                            className="w-full mt-2 h-12 rounded-2xl bg-[#0b0b17] text-white disabled:opacity-60 shadow-sm flex items-center justify-center gap-2 hover:brightness-110"
                        >
                            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                        </button>
                     </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    {!analysis && (
                        <div className="rounded-xl border border-border bg-muted p-6 h-[380px] flex items-center justify-center text-sm text-muted-foreground">
                            <div className="text-center space-y-2">
                                <i data-lucide="circle-help" className="mx-auto h-6 w-6"></i>
                                <div>Select a stock and click "Start Analysis"</div>
                            </div>
                        </div>
                    )}
                    {analysis && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-border bg-card p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm">Stock ({selected?.symbol})</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-semibold">{analysis.price.toFixed(2)}</div>
                                        <div className={analysis.changePercent >= 0 ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>{analysis.changePercent >= 0 ? '+' : ''}{analysis.changePercent}%</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 text-sm mt-3">
                                    <button className={`flex items-center gap-1 px-3 py-1.5 rounded-md border ${tab === 'kline' ? 'bg-muted' : ''}`} onClick={() => setTab('kline')}>K-Line</button>
                                    <button className={`flex items-center gap-1 px-3 py-1.5 rounded-md border ${tab === 'analysis' ? 'bg-muted' : ''}`} onClick={() => setTab('analysis')}>Analysis</button>
                                    <button className={`flex items-center gap-1 px-3 py-1.5 rounded-md border ${tab === 'news' ? 'bg-muted' : ''}`} onClick={() => setTab('news')}>News</button>
                                    <button className={`flex items-center gap-1 px-3 py-1.5 rounded-md border ${tab === 'chat' ? 'bg-muted' : ''}`} onClick={() => setTab('chat')}>Chat</button>
                                </div>
                            </div>
                            
                            {tab === 'kline' && (
                                <div className="rounded-xl border border-border bg-card p-4">
                                    <KLineChart data={analysis.kline} />
                                </div>
                            )}

                            {tab === 'analysis' && (
                                <div className="rounded-xl border border-border bg-card p-4">
                                    <div className="font-semibold mb-2">AI Summary</div>
                                    <MarkdownText text={analysis.summary} />
                                    <div className="mt-4 font-semibold">Recommendation: {analysis.recommendation} (Confidence: {(analysis.confidence * 100).toFixed(0)}%)</div>
                                </div>
                            )}

                            {tab === 'news' && (
                                <div className="rounded-xl border border-border bg-card p-4">
                                    <ResearchNews embedded={true} initialSymbol={selected?.symbol} />
                                </div>
                            )}

                            {tab === 'chat' && (
                                <div className="rounded-xl border border-border bg-card p-4">
                                    <ResearchChat embedded={true} initialSymbol={selected?.symbol} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Section = ({ title, children }) => (
    <div className="rounded-xl border border-border bg-card p-6">
        <div className="text-lg font-semibold mb-4">{title}</div>
        {children}
    </div>
);

const ResearchReport = ({ navigate, params, symbol: propSymbol, embedded, data }) => {
    const [symbol, setSymbol] = useState(propSymbol || params?.symbol || '—');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [analysis, setAnalysis] = useState(data || null);

    useEffect(() => {
        if (propSymbol) setSymbol(propSymbol);
    }, [propSymbol]);

    useEffect(() => {
        if (data) {
            setAnalysis(data);
            return;
        }

        if (!symbol || symbol === '—') return;
        setLoading(true);
        setError(null);
        
        axios.post(`${API_BASE}/analysis/analyze/${symbol}`, { analysis_type: 'comprehensive' })
            .then(res => {
                const d = res.data;
                setAnalysis({
                    summary: d.summary,
                    recommendation: d.recommendation,
                    confidence_score: d.confidence_score,
                    key_metrics: d.key_metrics || {}
                });
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [symbol, data]);

    return (
        <div className="space-y-6">
             {!embedded && (
                 <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => navigate('home')} className="p-2 hover:bg-gray-100 rounded-lg"><i data-lucide="arrow-left" className="w-5 h-5"></i></button>
                    <h2 className="text-xl font-bold">{symbol} Analysis Report</h2>
                </div>
             )}
            
            {!embedded && !params?.symbol && (
                <div className="flex gap-2 mb-4">
                    <input 
                        placeholder="Enter symbol..." 
                        className="border p-2 rounded" 
                        onKeyDown={e => {
                            if(e.key === 'Enter') setSymbol(e.target.value.toUpperCase());
                        }}
                    />
                    <button onClick={() => setSymbol(document.querySelector('input[placeholder="Enter symbol..."]').value.toUpperCase())} className="bg-primary text-white px-4 py-2 rounded">Load</button>
                </div>
            )}

            <Section title="Technical Analysis">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="h-64 rounded-lg bg-muted flex items-center justify-center">
                        {loading ? 'Loading...' : error ? `Error: ${error}` : 'K-Line Chart Placeholder'}
                    </div>
                    <div className="space-y-2 text-sm">
                        {analysis ? (
                            <>
                                <div><MarkdownText text={analysis.summary} /></div>
                                <div className="font-bold mt-2">Recommendation: {analysis.recommendation}</div>
                                <div>Confidence: {(analysis.confidence_score * 100).toFixed(0)}%</div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {analysis.key_metrics && Object.entries(analysis.key_metrics).map(([k, v]) => (
                                        <div key={k} className="flex justify-between border-b py-1"><span>{k}</span><span>{String(v)}</span></div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-muted-foreground">Enter a symbol to view report.</div>
                        )}
                    </div>
                </div>
            </Section>
            
            {analysis && (
                <Section title="Investment Advice">
                    <div className="space-y-2 text-sm">
                        <div className="font-medium">Advice: {analysis.recommendation}</div>
                        <div>Risk Level: Medium</div>
                    </div>
                </Section>
            )}
        </div>
    );
};

const ResearchChat = ({ navigate, initialSymbol, embedded }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [symbol, setSymbol] = useState(initialSymbol || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialSymbol) setSymbol(initialSymbol);
    }, [initialSymbol]);

    const send = async () => {
        if (!input.trim() || !symbol.trim()) return;
        setMessages(m => [...m, { role: 'user', content: input }]);
        setLoading(true);
        setInput('');
        
        try {
            const res = await axios.post(`${API_BASE}/analysis/chat/${symbol}`, { message: input });
            setMessages(m => [...m, { role: 'ai', content: res.data.content }]);
        } catch (e) {
            const msg = e.response?.data?.error || e.message;
            setMessages(m => [...m, { role: 'ai', content: 'Error: ' + msg }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            {!embedded && (
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => navigate('home')} className="p-2 hover:bg-gray-100 rounded-lg"><i data-lucide="arrow-left" className="w-5 h-5"></i></button>
                    <h2 className="text-xl font-bold">AI Chat Assistant</h2>
                </div>
            )}
            
            <div className={`flex-1 rounded-xl border border-border bg-card p-6 flex flex-col ${embedded ? 'min-h-[400px]' : ''}`}>
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-[500px]">
                     {messages.length === 0 && <div className="text-center text-sm text-muted-foreground">Start chatting with AI assistant about stocks.</div>}
                     {messages.map((m, i) => (
                        <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                            <div className={`inline-block px-3 py-2 rounded-lg ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <MarkdownText text={m.content} />
                            </div>
                        </div>
                     ))}
                </div>
                
                <div className="flex gap-2">
                    <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Symbol (e.g. AAPL)" className="w-32 rounded-md border border-border px-3 py-2 bg-transparent" />
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question..." className="flex-1 rounded-md border border-border px-3 py-2 bg-transparent" />
                    <button onClick={send} disabled={loading} className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-white">{loading ? '...' : 'Send'}</button>
                </div>
            </div>
        </div>
    );
};

const ResearchPreview = ({ navigate }) => {
    const [src, setSrc] = useState('https://6ad6a239-53f2-4e5e-8c15-7e470819f6d6-figmaiframepreview.figma.site/preview_page_v2.html');
    
    return (
        <div className="space-y-4">
             <div className="flex items-center gap-4 mb-4">
                <button onClick={() => navigate('home')} className="p-2 hover:bg-gray-100 rounded-lg"><i data-lucide="arrow-left" className="w-5 h-5"></i></button>
                <h2 className="text-xl font-bold">Preview</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex gap-2">
                <input value={src} onChange={e => setSrc(e.target.value)} className="flex-1 rounded-md border px-3 py-2 bg-transparent" />
            </div>
            <iframe src={src} className="w-full h-[700px] rounded-xl border border-border bg-white" />
        </div>
    );
};

const AnalysisView = () => {
    const [page, setPage] = useState('analysis');
    const [params, setParams] = useState({});

    const navigate = (to, newParams = {}) => {
        setPage(to);
        setParams(newParams);
        // Refresh icons after navigation
        setTimeout(() => window.lucide && window.lucide.createIcons(), 100);
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [page]);

    return (
        <div className="max-w-7xl mx-auto animate-fade-in">
            {page === 'home' && <ResearchHome navigate={navigate} />}
            {page === 'analysis' && <ResearchAnalysis navigate={navigate} params={params} />}
            {page === 'report' && <ResearchReport navigate={navigate} params={params} />}
            {page === 'chat' && <ResearchChat navigate={navigate} params={params} />}
            {page === 'preview' && <ResearchPreview navigate={navigate} params={params} />}
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
                            <span className="flex items-center">
                                <i data-lucide="save" className="w-4 h-4 mr-2"></i>
                                Save Settings
                            </span>
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

    const updateDateRange = (key, value) => {
        setLocalConfig(prev => ({
            ...prev,
            date_range: {
                ...prev.date_range,
                [key]: value
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

            {/* Date Range Config */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">📅 Backtest Date Range</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input 
                            type="date" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={localConfig.date_range?.init_date || ''}
                            onChange={e => updateDateRange('init_date', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input 
                            type="date" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={localConfig.date_range?.end_date || ''}
                            onChange={e => updateDateRange('end_date', e.target.value)}
                        />
                    </div>
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
const AssetTab = ({ strategyId, mode, results, isRunning, onRun, onStop, config, onSaveConfig }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);
    const [logs, setLogs] = useState([]);
    const [logDates, setLogDates] = useState([]);
    const [selectedLogDate, setSelectedLogDate] = useState('');
    const [localDateRange, setLocalDateRange] = useState({ init_date: '', end_date: '' });
    const [availableDataRange, setAvailableDataRange] = useState({ min: '', max: '' });

    // Fetch available data range
    useEffect(() => {
        const fetchDataRange = async () => {
            try {
                const res = await axios.get(`${API_BASE}/data/available-range`);
                if (res.data.success && res.data.available) {
                    setAvailableDataRange({
                        min: res.data.start_date,
                        max: res.data.end_date
                    });
                    
                    // Optional: Auto-set dates if not set
                    // if (!localDateRange.init_date) setLocalDateRange(prev => ({...prev, init_date: res.data.start_date}));
                    // if (!localDateRange.end_date) setLocalDateRange(prev => ({...prev, end_date: res.data.end_date}));
                }
            } catch (err) {
                console.error("Failed to fetch data range", err);
            }
        };
        fetchDataRange();
    }, []);

    // Update local date range when config changes
    useEffect(() => {
        if (config?.date_range) {
            setLocalDateRange(config.date_range);
        }
    }, [config]);

    const handleRunClick = async () => {
        // For backtest, save config first if we have it
        if (mode === 'backtest' && onSaveConfig && config) {
            try {
                await onSaveConfig({
                    ...config,
                    date_range: localDateRange
                });
            } catch (e) {
                alert('Failed to save date configuration: ' + e.message);
                return;
            }
        }
        onRun();
    };

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
        
        // Safety check for first element
        if (!assets[0] || typeof assets[0].total_asset === 'undefined') return null;

        const initial = assets[0].total_asset || 0;
        const current = assets[assets.length - 1]?.total_asset || 0;
        const returns = initial !== 0 ? ((current - initial) / initial) * 100 : 0;
        
        // Calculate max drawdown
        let maxDrawdown = 0;
        let peak = -Infinity;
        for (let item of assets) {
            const val = item.total_asset || 0;
            if (val > peak) peak = val;
            const drawdown = peak > 0 ? (peak - val) / peak : 0;
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
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
                    <div className="text-gray-600 text-sm flex items-center">
                        <span className="mr-2">Mode:</span>
                        <span className="font-bold text-gray-900 uppercase">{mode}</span>
                        {mode === 'backtest' && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Historical Data</span>}
                    </div>

                    {/* Date Inputs for Backtest */}
                    {mode === 'backtest' && (
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                    <span className="text-xs text-gray-500 font-medium">Start:</span>
                                    <input 
                                        type="date" 
                                        className="bg-transparent text-sm font-medium outline-none text-gray-700"
                                        value={localDateRange.init_date || ''}
                                        min={availableDataRange.min}
                                        max={availableDataRange.max}
                                        onChange={e => setLocalDateRange(prev => ({...prev, init_date: e.target.value}))}
                                    />
                                </div>
                                <span className="text-gray-400">→</span>
                                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                    <span className="text-xs text-gray-500 font-medium">End:</span>
                                    <input 
                                        type="date" 
                                        className="bg-transparent text-sm font-medium outline-none text-gray-700"
                                        value={localDateRange.end_date || ''}
                                        min={availableDataRange.min}
                                        max={availableDataRange.max}
                                        onChange={e => setLocalDateRange(prev => ({...prev, end_date: e.target.value}))}
                                    />
                                </div>
                            </div>
                            {availableDataRange.min && (
                                <div className="text-[10px] text-gray-400 font-mono">
                                    Local Data: {availableDataRange.min} ~ {availableDataRange.max}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button 
                            onClick={handleRunClick}
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
            </div>

            {/* Metrics Grid */}
            {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Initial Cash</div>
                        <div className="text-lg font-bold text-gray-900">${(metrics.initial || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Current Asset</div>
                        <div className="text-lg font-bold text-gray-900">${(metrics.current || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Total Return</div>
                        <div className={`text-lg font-bold ${metrics.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {metrics.returns >= 0 ? '+' : ''}{(metrics.returns || 0).toFixed(2)}%
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Max Drawdown</div>
                        <div className="text-lg font-bold text-red-600">-{(metrics.maxDrawdown || 0).toFixed(2)}%</div>
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
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{(strategy.strategy_id || '').substring(0, 18)}...</p>
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

    const handleSaveConfig = async (newConfig) => {
        try {
            await axios.post(`${API_BASE}/strategies/${strategy.strategy_id}/config/${activeMode}`, { config: newConfig });
            setConfig(newConfig);
        } catch (err) {
            console.error("Failed to save config", err);
            throw err;
        }
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
                            <span className="font-mono">{strategy.strategy_id || 'N/A'}</span>
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
                        { id: 'asset', label: 'Performance', icon: 'trending-up' }
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
                    <AssetTab 
                        strategyId={strategy.strategy_id} 
                        mode={activeMode} 
                        results={results} 
                        isRunning={isRunning} 
                        onRun={handleRun} 
                        onStop={handleStop} 
                        config={config}
                        onSaveConfig={handleSaveConfig}
                    />
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