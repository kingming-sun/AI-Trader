// Asset Evolution Chart
// Main page visualization

const dataLoader = new DataLoader();
let chartInstance = null;
let allAgentsData = {};
let isLogScale = false;

// Color palette for different agents
const agentColors = [
    '#00d4ff', // Cyan Blue
    '#00ffcc', // Cyan
    '#ff006e', // Hot Pink
    '#ffbe0b', // Yellow
    '#8338ec', // Purple
    '#3a86ff', // Blue
    '#fb5607', // Orange
    '#06ffa5'  // Mint
];

// Cache for loaded SVG images
const iconImageCache = {};

// Function to load SVG as image
function loadIconImage(iconPath) {
    return new Promise((resolve, reject) => {
        if (iconImageCache[iconPath]) {
            resolve(iconImageCache[iconPath]);
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            iconImageCache[iconPath] = img;
            resolve(img);
        };
        img.onerror = reject;
        img.src = iconPath;
    });
}

// Update loading progress message
function updateLoadingProgress(message) {
    const progressEl = document.getElementById('loadingProgress');
    if (progressEl) {
        progressEl.textContent = message;
    }
    console.log(`📌 ${message}`);
}

// Initialize the page
async function init() {
    showLoading();
    updateLoadingProgress('正在初始化...');
    
    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
        console.error('⏱️  Loading timeout - taking too long (2 minutes)');
        hideLoading();
        alert('数据加载超时（2分钟）！\n\n请检查:\n1. 浏览器控制台的错误信息\n2. 数据文件是否存在\n3. 网络连接是否正常\n4. 前端服务器是否在运行\n\n如果问题持续，请刷新页面重试。');
    }, 120000); // 2 minutes timeout

    try {
        // Load all agents data
        updateLoadingProgress('正在加载交易数据...');
        console.log('🚀 Starting data loading process...');
        allAgentsData = await dataLoader.loadAllAgentsData();
        console.log('✅ Data loaded successfully:', Object.keys(allAgentsData));
        
        if (!allAgentsData || Object.keys(allAgentsData).length === 0) {
            throw new Error('没有加载到任何数据！请检查数据文件是否存在。');
        }

        // Preload all agent icons
        const agentNames = Object.keys(allAgentsData);
        updateLoadingProgress(`正在加载图标 (${agentNames.length} 个代理)...`);
        console.log(`🖼️  Preloading icons for ${agentNames.length} agents...`);
        const iconPromises = agentNames.map(agentName => {
            const iconPath = dataLoader.getAgentIcon(agentName);
            return loadIconImage(iconPath).catch(err => {
                console.warn(`⚠️  Failed to load icon for ${agentName}:`, err);
            });
        });
        await Promise.all(iconPromises);
        console.log('✅ Icons preloaded');

        updateLoadingProgress('正在生成图表...');
        // Update stats
        updateStats();

        // Create chart
        createChart();

        // Create legend
        createLegend();

        // Set up event listeners
        setupEventListeners();

        clearTimeout(loadingTimeout);
        console.log('🎉 Page initialization complete!');
    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error('❌ Error initializing page:', error);
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        
        let errorMessage = `加载交易数据失败: ${error.message}\n\n`;
        errorMessage += `请检查:\n`;
        errorMessage += `1. 数据文件是否存在 (docs/data/agent_data/)\n`;
        errorMessage += `2. 浏览器控制台的详细错误信息\n`;
        errorMessage += `3. 网络连接是否正常\n`;
        errorMessage += `4. 前端服务器是否在运行 (http://localhost:8000)\n`;
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage += `\n⚠️  检测到网络错误，可能是:\n`;
            errorMessage += `   - CORS 问题（检查服务器配置）\n`;
            errorMessage += `   - 服务器未运行（运行: cd docs && python3 -m http.server 8000）\n`;
            errorMessage += `   - 数据文件路径不正确\n`;
        }
        
        alert(errorMessage);
    } finally {
        hideLoading();
    }
}

// Update statistics cards
function updateStats() {
    const agentNames = Object.keys(allAgentsData);
    const agentCount = agentNames.length;

    // Calculate date range
    let minDate = null;
    let maxDate = null;

    agentNames.forEach(name => {
        const history = allAgentsData[name].assetHistory;
        if (history.length > 0) {
            const firstDate = history[0].date;
            const lastDate = history[history.length - 1].date;

            if (!minDate || firstDate < minDate) minDate = firstDate;
            if (!maxDate || lastDate > maxDate) maxDate = lastDate;
        }
    });

    // Find best performer
    let bestAgent = null;
    let bestReturn = -Infinity;

    agentNames.forEach(name => {
        const returnValue = allAgentsData[name].return;
        if (returnValue > bestReturn) {
            bestReturn = returnValue;
            bestAgent = name;
        }
    });

    // Detect trading modes
    const tradingModes = new Set();
    agentNames.forEach(name => {
        const mode = allAgentsData[name].tradingMode || 'BACKTEST';
        tradingModes.add(mode);
    });
    
    // Display trading mode(s)
    let modeDisplay = 'Mixed';
    if (tradingModes.size === 1) {
        const mode = Array.from(tradingModes)[0];
        modeDisplay = dataLoader.getTradingModeText(mode);
    } else if (tradingModes.size > 1) {
        modeDisplay = Array.from(tradingModes).map(m => dataLoader.getTradingModeText(m)).join(' / ');
    }
    
    // Update DOM
    document.getElementById('agent-count').textContent = agentCount;
    document.getElementById('trading-period').textContent = minDate && maxDate ?
        `${minDate} to ${maxDate}` : 'N/A';
    document.getElementById('best-performer').textContent = bestAgent ?
        dataLoader.getAgentDisplayName(bestAgent) : 'N/A';
    document.getElementById('avg-return').textContent = bestAgent ?
        dataLoader.formatPercent(bestReturn) : 'N/A';
    
    // Update trading mode display
    const tradingModeEl = document.getElementById('trading-mode');
    tradingModeEl.textContent = modeDisplay;
    if (tradingModes.size === 1) {
        const mode = Array.from(tradingModes)[0];
        tradingModeEl.style.color = dataLoader.getTradingModeColor(mode);
    } else {
        tradingModeEl.style.color = 'var(--text-secondary)';
    }
}

// Create the main chart
function createChart() {
    const ctx = document.getElementById('assetChart').getContext('2d');

    // Collect all unique dates and sort them
    const allDates = new Set();
    Object.keys(allAgentsData).forEach(agentName => {
        allAgentsData[agentName].assetHistory.forEach(h => allDates.add(h.date));
    });
    const sortedDates = Array.from(allDates).sort();

    const datasets = Object.keys(allAgentsData).map((agentName, index) => {
        const data = allAgentsData[agentName];
        let color, borderWidth, borderDash;
        
        // Override color based on trading mode
        const tradingMode = data.tradingMode || 'BACKTEST';
        
        // Special styling for QQQ benchmark
        if (agentName === 'QQQ') {
            color = dataLoader.getAgentBrandColor(agentName) || '#ff6b00';
            borderWidth = 2;
            borderDash = [5, 5]; // Dashed line for benchmark
        } else {
            // Use trading mode color if available
            if (tradingMode === 'SIMULATE') {
                color = '#ffbe0b'; // Yellow for simulate
            } else if (tradingMode === 'REAL') {
                color = '#f56565'; // Red for real
            } else {
                color = agentColors[index % agentColors.length];
            }
            borderWidth = 3;
            borderDash = [];
        }

        // Create data points for all dates, filling missing dates with null
        const chartData = sortedDates.map(date => {
            const historyEntry = data.assetHistory.find(h => h.date === date);
            return {
                x: date,
                y: historyEntry ? historyEntry.value : null
            };
        });

        return {
            label: dataLoader.getAgentDisplayName(agentName),
            data: chartData,
            borderColor: color,
            backgroundColor: agentName === 'QQQ' ? 'transparent' : createGradient(ctx, color),
            borderWidth: borderWidth,
            borderDash: borderDash,
            tension: 0.42, // Smooth curves for financial charts
            pointRadius: 0,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 3,
            fill: agentName !== 'QQQ', // No fill for QQQ benchmark
            agentName: agentName,
            agentIcon: dataLoader.getAgentIcon(agentName),
            cubicInterpolationMode: 'monotone' // Smooth, monotonic interpolation
        };
    });

    // Create gradient for area fills
    function createGradient(ctx, color) {
        // Parse color and create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, color + '30'); // 30% opacity at top
        gradient.addColorStop(0.5, color + '15'); // 15% opacity at middle
        gradient.addColorStop(1, color + '05'); // 5% opacity at bottom
        return gradient;
    }

    // Custom plugin to draw icons on chart lines
    const iconPlugin = {
        id: 'iconLabels',
        afterDatasetsDraw: (chart) => {
            const ctx = chart.ctx;

            chart.data.datasets.forEach((dataset, datasetIndex) => {
                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta.hidden && dataset.data.length > 0) {
                    // Get the last point
                    const lastPoint = meta.data[meta.data.length - 1];

                    if (lastPoint) {
                        const x = lastPoint.x;
                        const y = lastPoint.y;

                        ctx.save();

                        // Draw background circle with glow
                        const iconSize = 30;

                        // Outer glow
                        ctx.shadowColor = dataset.borderColor;
                        ctx.shadowBlur = 15;
                        ctx.fillStyle = dataset.borderColor;
                        ctx.beginPath();
                        ctx.arc(x + 22, y, iconSize / 2, 0, Math.PI * 2);
                        ctx.fill();

                        // Reset shadow
                        ctx.shadowBlur = 0;

                        // Draw icon image if loaded
                        if (iconImageCache[dataset.agentIcon]) {
                            const img = iconImageCache[dataset.agentIcon];
                            const imgSize = iconSize * 0.6; // Icon slightly smaller than circle
                            ctx.drawImage(img, x + 22 - imgSize/2, y - imgSize/2, imgSize, imgSize);
                        }

                        ctx.restore();
                    }
                }
            });
        }
    };

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 200,
            layout: {
                padding: {
                    right: 50,
                    top: 10,
                    bottom: 10
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            elements: {
                line: {
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round'
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 34, 56, 0.95)',
                    titleColor: '#00d4ff',
                    bodyColor: '#fff',
                    borderColor: '#2d3748',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = dataLoader.formatCurrency(context.parsed.y);
                            // Tooltips don't support images, so just show label and value
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: sortedDates,
                    grid: {
                        color: 'rgba(45, 55, 72, 0.3)',
                        drawBorder: false,
                        lineWidth: 1
                    },
                    ticks: {
                        color: '#a0aec0',
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 10,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    type: isLogScale ? 'logarithmic' : 'linear',
                    grid: {
                        color: 'rgba(45, 55, 72, 0.3)',
                        drawBorder: false,
                        lineWidth: 1
                    },
                    ticks: {
                        color: '#a0aec0',
                        callback: function(value) {
                            return dataLoader.formatCurrency(value);
                        },
                        font: {
                            size: 11
                        }
                    }
                }
            }
        },
        plugins: [iconPlugin]
    });
}

// Create legend
function createLegend() {
    const legendContainer = document.getElementById('agentLegend');
    legendContainer.innerHTML = '';

    Object.keys(allAgentsData).forEach((agentName, index) => {
        const data = allAgentsData[agentName];
        let color, borderStyle;
        
        const tradingMode = data.tradingMode || 'BACKTEST';
        
        // Special styling for QQQ benchmark
        if (agentName === 'QQQ') {
            color = dataLoader.getAgentBrandColor(agentName) || '#ff6b00';
            borderStyle = 'dashed';
        } else {
            // Use trading mode color if available
            if (tradingMode === 'SIMULATE') {
                color = '#ffbe0b'; // Yellow for simulate
            } else if (tradingMode === 'REAL') {
                color = '#f56565'; // Red for real
            } else {
                color = agentColors[index % agentColors.length];
            }
            borderStyle = 'solid';
        }
        
        const returnValue = data.return;
        const returnClass = returnValue >= 0 ? 'positive' : 'negative';
        const iconPath = dataLoader.getAgentIcon(agentName);
        const brandColor = dataLoader.getAgentBrandColor(agentName);

        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-icon" ${brandColor ? `style="background: ${brandColor}20;"` : ''}>
                <img src="${iconPath}" alt="${agentName}" class="legend-icon-img" />
            </div>
            <div class="legend-color" style="background: ${color}; border-style: ${borderStyle};"></div>
            <div class="legend-info">
                <div class="legend-name">
                    ${dataLoader.getAgentDisplayName(agentName)}
                    <span class="legend-mode" style="color: ${dataLoader.getTradingModeColor(tradingMode)}; font-size: 0.75rem; margin-left: 0.5rem; font-weight: 500;">
                        [${dataLoader.getTradingModeText(tradingMode)}]
                    </span>
                </div>
                <div class="legend-return ${returnClass}">${dataLoader.formatPercent(returnValue)}</div>
            </div>
        `;

        legendContainer.appendChild(legendItem);
    });
}

// Toggle between linear and log scale
function toggleScale() {
    isLogScale = !isLogScale;

    const button = document.getElementById('toggle-log');
    button.textContent = isLogScale ? '对数坐标' : '线性坐标';

    // Update chart
    if (chartInstance) {
        chartInstance.destroy();
    }
    createChart();
}

// Export chart data as CSV
function exportData() {
    let csv = 'Date,';

    // Header row with agent names
    const agentNames = Object.keys(allAgentsData);
    csv += agentNames.map(name => dataLoader.getAgentDisplayName(name)).join(',') + '\n';

    // Collect all unique dates
    const allDates = new Set();
    agentNames.forEach(name => {
        allAgentsData[name].assetHistory.forEach(h => allDates.add(h.date));
    });

    // Sort dates
    const sortedDates = Array.from(allDates).sort();

    // Data rows
    sortedDates.forEach(date => {
        const row = [date];
        agentNames.forEach(name => {
            const history = allAgentsData[name].assetHistory;
            const entry = history.find(h => h.date === date);
            row.push(entry ? entry.value.toFixed(2) : '');
        });
        csv += row.join(',') + '\n';
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aitrader_asset_evolution.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Set up event listeners
function setupEventListeners() {
    document.getElementById('toggle-log').addEventListener('click', toggleScale);
    document.getElementById('export-chart').addEventListener('click', exportData);

    // Scroll to top button
    const scrollBtn = document.getElementById('scrollToTop');
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });

    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Window resize handler for chart responsiveness
    let resizeTimeout;
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (chartInstance) {
                console.log('Resizing chart...'); // Debug log
                chartInstance.resize();
                chartInstance.update('none'); // Force update without animation
            }
        }, 100); // Faster response
    };

    window.addEventListener('resize', handleResize);

    // Also handle orientation change for mobile
    window.addEventListener('orientationchange', handleResize);
}

// Loading overlay controls
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);
