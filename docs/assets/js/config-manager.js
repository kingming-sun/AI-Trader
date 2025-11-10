// Configuration Manager
// Handles loading, editing, and saving system configuration

class ConfigManager {
    constructor() {
        // API endpoint - should be running on port 8004
        // Use API_CONFIG if available (from api-config.js), otherwise fallback to localhost
        this.apiBase = window.API_CONFIG?.configApi || 'http://localhost:8004';
        this.config = null;
        this.originalPrompt = null;
    }

    // Load configuration from API
    async loadConfig() {
        try {
            const response = await fetch(`${this.apiBase}/api/config`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to load config: ${response.statusText}`);
            }
            this.config = await response.json();
            return this.config;
        } catch (error) {
            console.error('Error loading config:', error);
            throw error;
        }
    }

    // Load prompt from API
    async loadPrompt() {
        try {
            const response = await fetch(`${this.apiBase}/api/prompt`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to load prompt: ${response.statusText}`);
            }
            const data = await response.json();
            this.originalPrompt = data.prompt || '';
            return this.originalPrompt;
        } catch (error) {
            console.error('Error loading prompt:', error);
            throw error;
        }
    }

    // Populate form with current configuration
    populateForm() {
        if (!this.config) return;

        // Helper function to safely set element value
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        };

        // Date range
        setValue('init_date', this.config.date_range?.init_date || '');
        setValue('end_date', this.config.date_range?.end_date || '');

        // Agent config
        const agentConfig = this.config.agent_config || {};
        setValue('max_steps', agentConfig.max_steps || 30);
        setValue('max_retries', agentConfig.max_retries || 3);
        setValue('base_delay', agentConfig.base_delay || 1.0);
        setValue('initial_cash', agentConfig.initial_cash || 10000);

        // Models
        this.populateModels();

        // Prompt
        if (this.originalPrompt) {
            setValue('system_prompt', this.originalPrompt);
        }
    }

    // Populate models section
    populateModels() {
        const container = document.getElementById('modelsContainer');
        container.innerHTML = '';

        if (!this.config.models || this.config.models.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No models configured</p>';
            return;
        }

        this.config.models.forEach((model, index) => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            modelItem.innerHTML = `
                <div class="model-header">
                    <span class="model-name">${model.name}</span>
                    <label class="toggle-switch">
                        <input type="checkbox" 
                               data-model-index="${index}" 
                               class="model-enabled" 
                               ${model.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="form-group">
                    <label>Base Model</label>
                    <input type="text" 
                           data-model-index="${index}" 
                           class="model-basemodel" 
                           value="${model.basemodel || ''}" 
                           placeholder="e.g., deepseek/deepseek-chat-v3.1">
                </div>
                <div class="form-group">
                    <label>Signature</label>
                    <input type="text" 
                           data-model-index="${index}" 
                           class="model-signature" 
                           value="${model.signature || ''}" 
                           placeholder="e.g., deepseek-chat-v3.1">
                </div>
            `;
            container.appendChild(modelItem);
        });
    }

    // Collect form data
    collectFormData() {
        // Helper function to safely get element value
        const getValue = (id, defaultValue = '') => {
            const element = document.getElementById(id);
            return element ? element.value : defaultValue;
        };

        const formData = {
            agent_type: this.config?.agent_type || 'BaseAgent',
            date_range: {
                init_date: getValue('init_date'),
                end_date: getValue('end_date')
            },
            models: (this.config?.models || []).map((model, index) => {
                const enabledCheckbox = document.querySelector(`.model-enabled[data-model-index="${index}"]`);
                const basemodelInput = document.querySelector(`.model-basemodel[data-model-index="${index}"]`);
                const signatureInput = document.querySelector(`.model-signature[data-model-index="${index}"]`);
                
                return {
                    name: model.name,
                    basemodel: basemodelInput?.value || model.basemodel,
                    signature: signatureInput?.value || model.signature,
                    enabled: enabledCheckbox?.checked || false,
                    openai_base_url: model.openai_base_url || '',
                    openai_api_key: model.openai_api_key || ''
                };
            }),
            agent_config: {
                max_steps: parseInt(getValue('max_steps', '30')),
                max_retries: parseInt(getValue('max_retries', '3')),
                base_delay: parseFloat(getValue('base_delay', '1.0')),
                initial_cash: parseFloat(getValue('initial_cash', '10000'))
            },
            log_config: this.config?.log_config || {
                log_path: './data/agent_data'
            }
        };

        return formData;
    }

    // Get prompt from form
    getPromptFromForm() {
        const element = document.getElementById('system_prompt');
        return element ? element.value.trim() : '';
    }

    // Save configuration via API
    async saveConfig() {
        try {
            const formData = this.collectFormData();
            const response = await fetch(`${this.apiBase}/api/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to save config: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    // Save prompt via API
    async savePrompt() {
        try {
            const prompt = this.getPromptFromForm();
            const response = await fetch(`${this.apiBase}/api/prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to save prompt: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error saving prompt:', error);
            throw error;
        }
    }

    // Show status message
    showMessage(message, type = 'success') {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }

    // Check main.py status
    async checkMainStatus() {
        try {
            const response = await fetch(`${this.apiBase}/api/main-status`);
            if (!response.ok) {
                throw new Error('Failed to check status');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking main.py status:', error);
            return { is_running: false, error: error.message };
        }
    }

    // Restart main.py
    async restartMain() {
        try {
            const response = await fetch(`${this.apiBase}/api/restart-main`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to restart: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error restarting main.py:', error);
            throw error;
        }
    }

    // Update status display
    async updateStatusDisplay() {
        const statusEl = document.getElementById('mainStatus');
        statusEl.textContent = 'Checking...';
        statusEl.style.color = 'var(--text-secondary)';

        try {
            const status = await this.checkMainStatus();
            if (status.is_running) {
                statusEl.textContent = `✅ Running (PID: ${status.processes[0]?.pid || 'unknown'})`;
                statusEl.style.color = 'var(--success)';
            } else {
                statusEl.textContent = '❌ Not running';
                statusEl.style.color = 'var(--danger)';
            }
        } catch (error) {
            statusEl.textContent = `⚠️ Error: ${error.message}`;
            statusEl.style.color = 'var(--warning)';
        }
    }

    // Validate configuration
    validateConfig(formData) {
        const errors = [];

        if (!formData.date_range.init_date || !formData.date_range.end_date) {
            errors.push('Date range is required');
        }

        if (new Date(formData.date_range.init_date) > new Date(formData.date_range.end_date)) {
            errors.push('Start date must be before end date');
        }

        if (formData.agent_config.max_steps < 1 || formData.agent_config.max_steps > 100) {
            errors.push('Max steps must be between 1 and 100');
        }

        if (formData.agent_config.initial_cash < 100) {
            errors.push('Initial cash must be at least $100');
        }

        const prompt = this.getPromptFromForm();
        if (!prompt || prompt.length < 50) {
            errors.push('Prompt must be at least 50 characters');
        }

        return errors;
    }
}

// Initialize page
const configManager = new ConfigManager();

// Load configuration on page load
async function init() {
    try {
        await configManager.loadConfig();
        await configManager.loadPrompt();
        configManager.populateForm();
        await configManager.updateStatusDisplay();
    } catch (error) {
        configManager.showMessage(`Error loading configuration: ${error.message}`, 'error');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', init);

document.getElementById('loadConfigBtn').addEventListener('click', async () => {
    try {
        await configManager.loadConfig();
        await configManager.loadPrompt();
        configManager.populateForm();
        configManager.showMessage('Configuration loaded successfully');
    } catch (error) {
        configManager.showMessage(`Error loading configuration: ${error.message}`, 'error');
    }
});

document.getElementById('resetConfigBtn').addEventListener('click', () => {
    if (confirm('Reset to default configuration? This will lose all changes.')) {
        init();
        configManager.showMessage('Configuration reset to defaults');
    }
});

document.getElementById('downloadConfigBtn').addEventListener('click', async () => {
    try {
        const formData = configManager.collectFormData();
        const errors = configManager.validateConfig(formData);
        
        if (errors.length > 0) {
            configManager.showMessage(`Validation errors: ${errors.join(', ')}`, 'error');
            return;
        }

        // Download as backup
        const jsonStr = JSON.stringify(formData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'default_config.json';
        a.click();
        URL.revokeObjectURL(url);
        
        configManager.showMessage('Configuration downloaded as backup file');
    } catch (error) {
        configManager.showMessage(`Error: ${error.message}`, 'error');
    }
});

document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const formData = configManager.collectFormData();
        const errors = configManager.validateConfig(formData);
        
        if (errors.length > 0) {
            configManager.showMessage(`Validation errors: ${errors.join(', ')}`, 'error');
            return;
        }

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        // Save both config and prompt
        await Promise.all([
            configManager.saveConfig(),
            configManager.savePrompt()
        ]);
        
        configManager.showMessage('✅ Configuration saved successfully! ⚠️ Please restart main.py for changes to take effect.', 'success');
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    } catch (error) {
        configManager.showMessage(`❌ Error saving configuration: ${error.message}`, 'error');
        
        // Reset button
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Save Configuration';
        submitBtn.disabled = false;
    }
});

// Restart main.py button
document.getElementById('restartMainBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to restart main.py? This will stop the current process and start a new one.')) {
        return;
    }

    try {
        const btn = document.getElementById('restartMainBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Restarting...';
        btn.disabled = true;

        const result = await configManager.restartMain();
        
        configManager.showMessage('✅ main.py restart initiated. Please wait for it to complete running with new date range, then refresh the frontend page to see updated trading period.', 'success');
        
        // Update status after a delay
        setTimeout(async () => {
            await configManager.updateStatusDisplay();
        }, 2000);

        btn.textContent = originalText;
        btn.disabled = false;
    } catch (error) {
        configManager.showMessage(`❌ Error restarting main.py: ${error.message}`, 'error');
        const btn = document.getElementById('restartMainBtn');
        btn.textContent = '🔄 Restart main.py';
        btn.disabled = false;
    }
});

// Refresh status button
document.getElementById('refreshStatusBtn').addEventListener('click', async () => {
    await configManager.updateStatusDisplay();
});

