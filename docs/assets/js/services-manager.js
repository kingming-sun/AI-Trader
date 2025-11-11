// Platform Services Manager
// Handles service status monitoring and control

class ServicesManager {
    constructor() {
        // Use API_CONFIG if available (from api-config.js), otherwise fallback to localhost
        this.apiBase = window.API_CONFIG?.strategyApi || 'http://localhost:8005';
        this.refreshInterval = null;
        this.isLoading = false;
    }

    // Initialize the page
    async init() {
        await this.loadServicesStatus();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    // Load and display services status
    async loadServicesStatus() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        document.querySelector('.services-header').classList.add('loading');
        
        try {
            const response = await fetch(`${this.apiBase}/api/services/status`);
            if (!response.ok) throw new Error('Failed to load services status');
            
            const data = await response.json();
            console.log('📊 Services status data:', data);
            console.log('📊 MCP tools:', data.status?.mcp_tools);
            this.displayServicesStatus(data.status || {});
        } catch (error) {
            console.error('Error loading services status:', error);
            this.displayError('无法加载服务状态，请检查 Strategy API 是否运行');
        } finally {
            this.isLoading = false;
            document.querySelector('.services-header').classList.remove('loading');
        }
    }

    // Display services status
    displayServicesStatus(status) {
        // Display MCP services
        const mcpContainer = document.getElementById('mcpServices');
        const mcpServices = status.mcp_services || {};
        const mcpTools = status.mcp_tools || {};
        
        let mcpHTML = '';
        
        // Display local MCP services
        if (Object.keys(mcpServices).length > 0) {
            mcpHTML = Object.entries(mcpServices).map(([name, running]) => {
                const toolsInfo = mcpTools[name] || {};
                return this.createServiceItem('MCP ' + this.formatServiceName(name), running, 'mcp', name, '', toolsInfo);
            }).join('');
        }
        
        // Add Alpha Vantage service if configured (check both mcpTools and if API key might be set)
        if (mcpTools.alphavantage) {
            console.log('✅ Alpha Vantage tools found:', mcpTools.alphavantage);
            const alphaInfo = mcpTools.alphavantage;
            const alphaItem = this.createServiceItem(
                'Alpha Vantage MCP Service', 
                true, // Always show as available if configured
                'mcp', 
                'alphavantage', 
                'Remote Service',
                alphaInfo,
                true // isRemote = true, don't show action buttons
            );
            mcpHTML += alphaItem;
        } else {
            console.log('⚠️ Alpha Vantage tools not found in response');
            console.log('Available tools:', Object.keys(mcpTools));
        }
        
        if (mcpHTML) {
            mcpContainer.innerHTML = mcpHTML;
        } else {
            mcpContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">没有检测到 MCP 服务</p>';
        }
        
        // Display API services
        const apiContainer = document.getElementById('apiServices');
        const apiServices = status.api_services || {};
        
        if (Object.keys(apiServices).length === 0) {
            apiContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">没有检测到 API 服务</p>';
        } else {
            apiContainer.innerHTML = Object.entries(apiServices).map(([name, running]) => {
                let displayName = this.formatServiceName(name);
                let port = '';
                
                if (name === 'config_api') {
                    displayName = 'Config API';
                    port = 'Port: 8004';
                } else if (name === 'strategy_api') {
                    displayName = 'Strategy API';
                    port = 'Port: 8005';
                }
                
                return this.createServiceItem(displayName, running, 'api', name, port);
            }).join('');
        }
        
        // Add event listeners to action buttons
        this.attachServiceActionListeners();
        
        // Add click listeners for service items with tools
        document.querySelectorAll('.service-item[data-clickable="true"]').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons
                if (!e.target.closest('.service-actions')) {
                    const serviceId = item.dataset.serviceId;
                    this.showToolDetails(serviceId);
                }
            });
        });
    }

    // Create service item HTML
    createServiceItem(name, isRunning, type, id, details = '', toolsInfo = {}, isRemote = false) {
        const statusClass = isRunning ? 'running' : 'stopped';
        const statusIcon = isRunning ? '✅' : '❌';
        const statusText = isRunning ? '运行中' : '已停止';
        
        // Remote services don't have action buttons
        const actions = isRemote 
            ? '' 
            : (isRunning 
                ? `<button class="btn-service btn-restart" data-action="restart" data-type="${type}" data-id="${id}">重启</button>
                   <button class="btn-service btn-stop" data-action="stop" data-type="${type}" data-id="${id}">停止</button>`
                : `<button class="btn-service btn-start" data-action="start" data-type="${type}" data-id="${id}">启动</button>`);
        
        // Build tools display
        let toolsHTML = '';
        if (toolsInfo.tools && toolsInfo.tools.length > 0) {
            const tools = toolsInfo.tools;
            const toolCount = toolsInfo.count || tools.length;
            const serviceType = toolsInfo.type || 'local';
            const maxDisplay = 10; // Show first 10 tools
            
            toolsHTML = `
                <div class="service-tools">
                    <div class="tools-header">
                        <span class="tools-count">${toolCount} 个工具</span>
                        <span class="tools-type">${serviceType === 'remote' ? '🌐 远程' : '💻 本地'}</span>
                    </div>
                    <div class="tools-list">
                        ${tools.slice(0, maxDisplay).map(tool => 
                            `<span class="tool-tag">${tool}</span>`
                        ).join('')}
                        ${tools.length > maxDisplay ? `<span class="tool-more">+${tools.length - maxDisplay} 更多...</span>` : ''}
                    </div>
                </div>
            `;
        }
        
        // Add click handler for viewing tools (only if tools exist)
        // Use data attribute instead of inline onclick for better practice
        const clickable = toolsInfo.tools && toolsInfo.tools.length > 0;
        
        return `
            <div class="service-item ${toolsInfo.tools ? 'has-tools' : ''} ${isRemote ? 'is-remote' : ''}" ${clickable ? `data-service-id="${id}" data-clickable="true"` : ''}>
                <div class="service-info">
                    <div class="service-name">${name}</div>
                    ${details ? `<div class="service-details">${details}</div>` : ''}
                    ${toolsHTML}
                    ${clickable ? '<div style="margin-top: 0.5rem; color: var(--accent-blue); font-size: 0.85rem;">👆 点击查看所有工具详情</div>' : ''}
                </div>
                <div class="service-status ${statusClass}">
                    <span>${statusIcon}</span>
                    <span>${statusText}</span>
                </div>
                ${actions ? `<div class="service-actions">${actions}</div>` : ''}
            </div>
        `;
    }

    // Format service name for display
    formatServiceName(name) {
        const nameMap = {
            'math': 'Math Service',
            'search': 'Search Service',
            'trade': 'Trade Service',
            'price': 'Price Service',
            'config_api': 'Config API',
            'strategy_api': 'Strategy API'
        };
        return nameMap[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Attach event listeners to service action buttons
    attachServiceActionListeners() {
        document.querySelectorAll('.btn-service').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = e.target.dataset.action;
                const type = e.target.dataset.type;
                const id = e.target.dataset.id;
                
                await this.handleServiceAction(action, type, id);
            });
        });
    }

    // Handle service action
    async handleServiceAction(action, type, id) {
        try {
            let endpoint = '';
            
            if (type === 'mcp') {
                if (action === 'start' || action === 'restart') {
                    endpoint = `/api/services/mcp/start`;
                } else if (action === 'stop') {
                    endpoint = `/api/services/mcp/stop`;
                }
            } else if (type === 'api') {
                // For API services, we might need different handling
                console.log(`API service ${action} not implemented yet`);
                return;
            }
            
            if (!endpoint) return;
            
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: id })
            });
            
            if (!response.ok) throw new Error(`Failed to ${action} service`);
            
            const result = await response.json();
            console.log(`Service ${action} result:`, result);
            
            // Reload status after action
            setTimeout(() => this.loadServicesStatus(), 1000);
        } catch (error) {
            console.error(`Error performing ${action}:`, error);
            alert(`操作失败: ${error.message}`);
        }
    }

    // Show tool details modal
    async showToolDetails(serviceName) {
        try {
            const response = await fetch(`${this.apiBase}/api/services/${serviceName}/tools`);
            if (!response.ok) throw new Error('Failed to load tool details');
            
            const data = await response.json();
            if (!data.success) {
                console.error('Error loading tools:', data.error);
                alert('加载工具详情失败: ' + data.error);
                return;
            }
            
            console.log('📊 Tool details data:', data);
            console.log('📊 Tools count:', data.count);
            console.log('📊 Tools array length:', data.tools ? data.tools.length : 0);
            
            const modal = document.getElementById('toolModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');
            
            // Set title
            const serviceDisplayName = this.formatServiceName(serviceName);
            const actualCount = data.tools ? data.tools.length : 0;
            modalTitle.textContent = `${serviceDisplayName} - 工具详情 (${actualCount} 个工具)`;
            
            // Show warning if count mismatch or connection issue
            let warningHTML = '';
            if (data.count && data.count !== actualCount) {
                console.warn(`⚠️ Count mismatch: expected ${data.count}, got ${actualCount}`);
                warningHTML = `<div style="background: rgba(237, 137, 54, 0.1); border: 1px solid var(--warning); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; color: var(--warning);">
                    ⚠️ 工具数量不匹配：预期 ${data.count} 个，实际获取 ${actualCount} 个
                </div>`;
            }
            
            // Check if there's a note (connection issue)
            if (data.note) {
                warningHTML = `<div style="background: rgba(237, 137, 54, 0.1); border: 1px solid var(--warning); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; color: var(--warning);">
                    ${data.note}
                </div>`;
            }
            
            // Build tools HTML
            let toolsHTML = '';
            if (data.tools && data.tools.length > 0) {
                toolsHTML = data.tools.map(tool => {
                    let paramsHTML = '';
                    
                    // Handle parameters
                    if (tool.parameters) {
                        if (typeof tool.parameters === 'object') {
                            const params = tool.parameters.properties || tool.parameters;
                            if (params && typeof params === 'object') {
                                paramsHTML = Object.entries(params).map(([paramName, paramInfo]) => {
                                    const paramType = paramInfo.type || paramInfo || 'unknown';
                                    return `
                                        <div class="param-item">
                                            <span class="param-name">${paramName}</span>
                                            <span class="param-type">${paramType}</span>
                                        </div>
                                    `;
                                }).join('');
                            }
                        }
                    } else if (tool.parameters && typeof tool.parameters === 'object') {
                        // Handle simple parameter dict
                        paramsHTML = Object.entries(tool.parameters).map(([paramName, paramType]) => {
                            return `
                                <div class="param-item">
                                    <span class="param-name">${paramName}</span>
                                    <span class="param-type">${paramType}</span>
                                </div>
                            `;
                        }).join('');
                    }
                    
                    return `
                        <div class="tool-item">
                            <div class="tool-name">${tool.name}</div>
                            <div class="tool-description">${tool.description || '暂无描述'}</div>
                            ${paramsHTML ? `
                                <div class="tool-params">
                                    <div class="tool-params-title">参数:</div>
                                    ${paramsHTML}
                                </div>
                            ` : ''}
                            ${tool.returns ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">返回类型: <code style="color: var(--accent-blue);">${tool.returns}</code></div>` : ''}
                        </div>
                    `;
                }).join('');
            } else {
                toolsHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">暂无工具信息</p>';
            }
            
            modalBody.innerHTML = warningHTML + toolsHTML;
            modal.classList.add('active');
        } catch (error) {
            console.error('Error loading tool details:', error);
            alert('加载工具详情失败: ' + error.message);
        }
    }
    
    // Close tool details modal
    closeToolModal() {
        const modal = document.getElementById('toolModal');
        modal.classList.remove('active');
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadServicesStatus();
        });
        
        // Modal close button
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeToolModal();
        });
        
        // Close modal when clicking outside
        document.getElementById('toolModal').addEventListener('click', (e) => {
            if (e.target.id === 'toolModal') {
                this.closeToolModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeToolModal();
            }
        });
        
        // Start all services
        document.getElementById('startAllBtn').addEventListener('click', async () => {
            if (!confirm('确定要启动所有服务吗？')) return;
            
            try {
                // Start MCP services
                const mcpResponse = await fetch(`${this.apiBase}/api/services/mcp/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (mcpResponse.ok) {
                    const result = await mcpResponse.json();
                    console.log('MCP services started:', result);
                }
                
                // Reload status
                setTimeout(() => this.loadServicesStatus(), 2000);
            } catch (error) {
                console.error('Error starting all services:', error);
                alert('启动服务失败，请查看控制台');
            }
        });
        
        // Stop all services
        document.getElementById('stopAllBtn').addEventListener('click', async () => {
            if (!confirm('确定要停止所有服务吗？这将影响正在运行的策略。')) return;
            
            try {
                // Stop MCP services
                const mcpResponse = await fetch(`${this.apiBase}/api/services/mcp/stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (mcpResponse.ok) {
                    const result = await mcpResponse.json();
                    console.log('MCP services stopped:', result);
                }
                
                // Reload status
                setTimeout(() => this.loadServicesStatus(), 2000);
            } catch (error) {
                console.error('Error stopping all services:', error);
                alert('停止服务失败，请查看控制台');
            }
        });
    }

    // Start auto refresh
    startAutoRefresh() {
        // Refresh every 5 seconds
        this.refreshInterval = setInterval(() => {
            this.loadServicesStatus();
        }, 5000);
    }

    // Stop auto refresh
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Display error message
    displayError(message) {
        const mcpContainer = document.getElementById('mcpServices');
        const apiContainer = document.getElementById('apiServices');
        
        const errorHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--danger);">
                ⚠️ ${message}
            </div>
        `;
        
        mcpContainer.innerHTML = errorHTML;
        apiContainer.innerHTML = '';
    }
}

// Initialize when page loads
const servicesManager = new ServicesManager();
document.addEventListener('DOMContentLoaded', () => {
    servicesManager.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    servicesManager.stopAutoRefresh();
});