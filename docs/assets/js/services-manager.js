// Platform Services Manager
// Handles service status monitoring and control

class ServicesManager {
    constructor() {
        this.apiBase = 'http://localhost:8005';
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
        
        if (Object.keys(mcpServices).length === 0) {
            mcpContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">没有检测到 MCP 服务</p>';
        } else {
            mcpContainer.innerHTML = Object.entries(mcpServices).map(([name, running]) => 
                this.createServiceItem('MCP ' + this.formatServiceName(name), running, 'mcp', name)
            ).join('');
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
    }

    // Create service item HTML
    createServiceItem(name, isRunning, type, id, details = '') {
        const statusClass = isRunning ? 'running' : 'stopped';
        const statusIcon = isRunning ? '✅' : '❌';
        const statusText = isRunning ? '运行中' : '已停止';
        
        const actions = isRunning 
            ? `<button class="btn-service btn-restart" data-action="restart" data-type="${type}" data-id="${id}">重启</button>
               <button class="btn-service btn-stop" data-action="stop" data-type="${type}" data-id="${id}">停止</button>`
            : `<button class="btn-service btn-start" data-action="start" data-type="${type}" data-id="${id}">启动</button>`;
        
        return `
            <div class="service-item">
                <div class="service-info">
                    <div class="service-name">${name}</div>
                    ${details ? `<div class="service-details">${details}</div>` : ''}
                </div>
                <div class="service-status ${statusClass}">
                    <span>${statusIcon}</span>
                    <span>${statusText}</span>
                </div>
                <div class="service-actions">
                    ${actions}
                </div>
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

    // Setup event listeners
    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadServicesStatus();
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