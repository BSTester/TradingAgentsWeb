// TradingAgents Web Interface JavaScript

class TradingAgentsApp {
    constructor() {
        this.config = null;
        this.currentAnalysisId = null;
        this.pollInterval = null;
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.setupForm();
        this.setDefaultDate();
        await this.loadAnalysesHistory();
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            this.config = await response.json();
        } catch (error) {
            console.error('Failed to load config:', error);
            this.showToast('无法加载配置', 'error');
        }
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('analysisForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.startAnalysis();
        });

        // LLM Provider change
        document.getElementById('llm_provider').addEventListener('change', (e) => {
            this.updateModels(e.target.value);
            this.updateBackendURL(e.target.value);
            this.updateAPIKeyField(e.target.value);
        });

        // API Key visibility toggle
        document.getElementById('toggle-api-key').addEventListener('click', () => {
            this.toggleAPIKeyVisibility();
        });

        // API Key validation
        document.getElementById('validate-api-key').addEventListener('click', () => {
            this.validateAPIKey();
        });

        // API Key input change
        document.getElementById('api_key').addEventListener('input', () => {
            this.clearAPIKeyStatus();
        });
    }

    setupForm() {
        this.populateAnalysts();
        this.populateResearchDepth();
        this.populateLLMProviders();
    }

    setDefaultDate() {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        document.getElementById('analysis_date').value = dateString;
    }

    populateAnalysts() {
        const container = document.getElementById('analysts-container');
        container.innerHTML = '';

        this.config.analysts.forEach(analyst => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${analyst.value}" 
                       id="analyst_${analyst.value}" name="analysts" checked>
                <label class="form-check-label" for="analyst_${analyst.value}">
                    <strong>${analyst.label}</strong>
                    <br><small class="text-muted">${analyst.description}</small>
                </label>
            `;
            container.appendChild(div);
        });
    }

    populateResearchDepth() {
        const container = document.getElementById('research-depth-container');
        container.innerHTML = '';

        this.config.research_depths.forEach((depth, index) => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="radio" value="${depth.value}" 
                       id="depth_${depth.value}" name="research_depth" ${index === 0 ? 'checked' : ''}>
                <label class="form-check-label" for="depth_${depth.value}">
                    <strong>${depth.label}</strong>
                    <br><small class="text-muted">${depth.description}</small>
                </label>
            `;
            container.appendChild(div);
        });
    }

    populateLLMProviders() {
        const select = document.getElementById('llm_provider');
        select.innerHTML = '';

        this.config.llm_providers.forEach((provider, index) => {
            const option = document.createElement('option');
            option.value = provider.value;
            option.textContent = provider.label;
            if (index === 0) option.selected = true;
            select.appendChild(option);
        });

        // Update models, backend URL, and API key field for the first provider
        if (this.config.llm_providers.length > 0) {
            this.updateModels(this.config.llm_providers[0].value);
            this.updateBackendURL(this.config.llm_providers[0].value);
            this.updateAPIKeyField(this.config.llm_providers[0].value);
        }
    }

    updateModels(providerValue) {
        // This function is called when provider changes
        // Models will be populated only after API key validation
        const shallowSelect = document.getElementById('shallow_thinker');
        const deepSelect = document.getElementById('deep_thinker');

        // Clear existing options
        shallowSelect.innerHTML = '<option value="">验证API密钥后...</option>';
        deepSelect.innerHTML = '<option value="">验证API密钥后...</option>';
        
        // Disable the selects until API key is validated
        shallowSelect.disabled = true;
        deepSelect.disabled = true;
    }

    updateBackendURL(providerValue) {
        const provider = this.config.llm_providers.find(p => p.value === providerValue);
        if (provider) {
            document.getElementById('backend-url-display').textContent = provider.url;
        }
    }

    updateAPIKeyField(providerValue) {
        const container = document.getElementById('api-key-container');
        const input = document.getElementById('api_key');
        const helpText = document.getElementById('api-key-help');

        // Show API key field for most providers, hide for Ollama
        if (providerValue.toLowerCase() === 'ollama') {
            container.classList.add('section-hidden');
            input.required = false;
        } else {
            container.classList.remove('section-hidden');
            input.required = true;
            
            // Update help text based on provider
            const helpTexts = {
                'OpenAI': '从此处获取您的API密钥: https://platform.openai.com/api-keys',
                'Anthropic': '从此处获取您的API密钥: https://console.anthropic.com/',
                'Google': '从此处获取您的API密钥: https://makersuite.google.com/app/apikey',
                'Openrouter': '从此处获取您的API密钥: https://openrouter.ai/keys'
            };
            
            helpText.textContent = helpTexts[providerValue] || '访问所选LLM服务商需要您的API密钥';
        }
        
        // Clear the input when switching providers
        input.value = '';
        
        // Hide thinking agents section when switching providers
        document.getElementById('thinking-agents-section').classList.add('section-hidden');
        this.clearAPIKeyStatus();
    }

    async validateAPIKey() {
        const providerValue = document.getElementById('llm_provider').value;
        const apiKey = document.getElementById('api_key').value.trim();
        const validateBtn = document.getElementById('validate-api-key');
        const statusDiv = document.getElementById('api-key-status');
        
        if (!apiKey) {
            this.showAPIKeyStatus('请输入您的API密钥', 'error');
            return;
        }

        // Show loading state
        validateBtn.disabled = true;
        validateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>验证中...';
        
        try {
            const response = await fetch('/api/validate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: providerValue,
                    api_key: apiKey
                })
            });

            const result = await response.json();
            
            if (response.ok && result.valid) {
                this.showAPIKeyStatus('API密钥验证成功!', 'success');
                this.showThinkingAgents(providerValue);
            } else {
                this.showAPIKeyStatus(result.detail || '无效的API密钥格式', 'error');
            }
        } catch (error) {
            console.error('API key validation error:', error);
            this.showAPIKeyStatus('验证API密钥失败。请重试。', 'error');
        } finally {
            // Reset button state
            validateBtn.disabled = false;
            validateBtn.innerHTML = '<i class="fas fa-check me-1"></i>验证';
        }
    }

    showAPIKeyStatus(message, type) {
        const statusDiv = document.getElementById('api-key-status');
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        
        statusDiv.innerHTML = `
            <div class="alert ${alertClass} alert-sm">
                <i class="fas ${icon} me-1"></i>
                ${message}
            </div>
        `;
    }

    clearAPIKeyStatus() {
        document.getElementById('api-key-status').innerHTML = '';
        document.getElementById('thinking-agents-section').classList.add('section-hidden');
    }

    showThinkingAgents(providerValue) {
        const section = document.getElementById('thinking-agents-section');
        section.classList.remove('section-hidden');
        
        // Update models for the validated provider
        this.updateModelsForProvider(providerValue);
        
        // Enable the select elements
        document.getElementById('shallow_thinker').disabled = false;
        document.getElementById('deep_thinker').disabled = false;
    }

    updateModelsForProvider(providerValue) {
        const provider = providerValue.toLowerCase();
        const shallowSelect = document.getElementById('shallow_thinker');
        const deepSelect = document.getElementById('deep_thinker');

        // Clear existing options
        shallowSelect.innerHTML = '<option value="">选择模型...</option>';
        deepSelect.innerHTML = '<option value="">选择模型...</option>';

        if (this.config.models[provider]) {
            // Populate shallow thinking models
            this.config.models[provider].shallow.forEach((model, index) => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.label;
                if (index === 0) option.selected = true;
                shallowSelect.appendChild(option);
            });

            // Populate deep thinking models
            this.config.models[provider].deep.forEach((model, index) => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.label;
                if (index === 0) option.selected = true;
                deepSelect.appendChild(option);
            });
        }
    }

    toggleAPIKeyVisibility() {
        const input = document.getElementById('api_key');
        const icon = document.getElementById('api-key-icon');

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    getFormData() {
        const formData = new FormData(document.getElementById('analysisForm'));
        const data = {};

        // Get simple values
        data.ticker = formData.get('ticker').toUpperCase();
        data.analysis_date = formData.get('analysis_date');
        data.research_depth = parseInt(formData.get('research_depth'));
        data.llm_provider = formData.get('llm_provider');
        data.shallow_thinker = formData.get('shallow_thinker');
        data.deep_thinker = formData.get('deep_thinker');

        // Get API key based on provider
        const apiKey = formData.get('api_key');
        const provider = data.llm_provider.toLowerCase();
        
        // Set the appropriate API key field
        data.openai_api_key = provider === 'openai' ? apiKey : null;
        data.anthropic_api_key = provider === 'anthropic' ? apiKey : null;
        data.google_api_key = provider === 'google' ? apiKey : null;
        data.openrouter_api_key = provider === 'openrouter' ? apiKey : null;

        // Get backend URL
        const providerObj = this.config.llm_providers.find(p => p.value === data.llm_provider);
        data.backend_url = providerObj ? providerObj.url : '';

        // Get selected analysts
        data.analysts = [];
        const analystCheckboxes = document.querySelectorAll('input[name="analysts"]:checked');
        analystCheckboxes.forEach(checkbox => {
            data.analysts.push(checkbox.value);
        });

        return data;
    }

    validateForm(data) {
        const errors = [];

        if (!data.ticker || data.ticker.length === 0) {
            errors.push('股票代码是必填项');
        }

        if (!data.analysis_date) {
            errors.push('分析日期是必填项');
        }

        if (data.analysts.length === 0) {
            errors.push('至少必须选择一个分析师');
        }

        if (!data.research_depth) {
            errors.push('必须选择研究深度');
        }

        if (!data.llm_provider) {
            errors.push('必须选择LLM服务商');
        }

        // Check API key requirement (not needed for Ollama)
        if (data.llm_provider.toLowerCase() !== 'ollama') {
            const providerLower = data.llm_provider.toLowerCase();
            const hasApiKey = 
                (providerLower === 'openai' && data.openai_api_key) ||
                (providerLower === 'anthropic' && data.anthropic_api_key) ||
                (providerLower === 'google' && data.google_api_key) ||
                (providerLower === 'openrouter' && data.openrouter_api_key);
            
            if (!hasApiKey) {
                errors.push(`${data.llm_provider}需要API密钥`);
            }
        }

        if (!data.shallow_thinker) {
            errors.push('必须选择快速思维模型');
        }

        if (!data.deep_thinker) {
            errors.push('必须选择深度思维模型');
        }

        return errors;
    }

    async startAnalysis() {
        const data = this.getFormData();
        const errors = this.validateForm(data);

        if (errors.length > 0) {
            this.showToast('请修复以下错误:\n' + errors.join('\n'), 'error');
            return;
        }

        try {
            this.showLoadingSpinner();
            
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.currentAnalysisId = result.analysis_id;

            // Navigate to results page instead of showing progress here
            window.location.href = `/results/${this.currentAnalysisId}`;

        } catch (error) {
            this.hideLoadingSpinner();
            console.error('Failed to start analysis:', error);
            this.showToast('启动分析失败: ' + error.message, 'error');
        }
    }

    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        this.pollInterval = setInterval(async () => {
            await this.checkAnalysisStatus();
        }, 2000); // Poll every 2 seconds
    }

    async checkAnalysisStatus() {
        if (!this.currentAnalysisId) return;

        try {
            const response = await fetch(`/api/analysis/${this.currentAnalysisId}/status`);
            const status = await response.json();

            this.updateProgressDisplay(status);

            if (status.status === 'completed') {
                clearInterval(this.pollInterval);
                await this.loadAnalysisResults();
            } else if (status.status === 'error') {
                clearInterval(this.pollInterval);
                this.showToast('分析失败: ' + status.current_step, 'error');
                this.showAnalysisForm();
            }

        } catch (error) {
            console.error('Failed to check analysis status:', error);
        }
    }

    updateProgressDisplay(status) {
        const progressBar = document.getElementById('progress-bar');
        const currentStep = document.getElementById('current-step');

        // Update current step
        currentStep.textContent = status.current_step || '正在处理...';

        // Update progress bar based on status
        let progress = 0;
        switch (status.status) {
            case 'queued':
                progress = 10;
                break;
            case 'initializing':
                progress = 20;
                break;
            case 'running':
                progress = 50;
                break;
            case 'completed':
                progress = 100;
                break;
            case 'error':
                progress = 100;
                progressBar.classList.add('bg-danger');
                break;
        }

        progressBar.style.width = progress + '%';
        progressBar.setAttribute('aria-valuenow', progress);
    }

    async loadAnalysisResults() {
        try {
            const response = await fetch(`/api/analysis/${this.currentAnalysisId}/results`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            
            console.log('Analysis results received:', results); // Debug log
            
            if (results.status === 'completed') {
                this.displayResults(results);
                this.showAnalysisResults();
            } else if (results.status === 'error') {
                console.error('Analysis error:', results.error);
                this.showToast('分析完成但有错误: ' + (results.error?.message || '未知错误'), 'error');
                this.showAnalysisForm();
            } else {
                throw new Error(`意外的分析状态: ${results.status}`);
            }

        } catch (error) {
            console.error('Failed to load analysis results:', error);
            this.showToast('加载分析结果失败: ' + error.message, 'error');
            this.showAnalysisForm();
        }
    }

    displayResults(results) {
        const container = document.getElementById('results-content');
        
        // Create summary section
        const summaryHtml = `
            <div class="results-summary">
                <h5><i class="fas fa-chart-line me-2"></i>Analysis Summary</h5>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>股票代码:</strong> ${results.request.ticker}</p>
                        <p><strong>分析日期:</strong> ${results.request.analysis_date}</p>
                        <p><strong>使用的分析师:</strong> ${results.request.analysts.join(', ')}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>研究深度:</strong> ${this.getResearchDepthLabel(results.request.research_depth)}</p>
                        <p><strong>LLM服务商:</strong> ${results.request.llm_provider}</p>
                        <p><strong>完成时间:</strong> ${new Date(results.timestamp).toLocaleString()}</p>
                    </div>
                </div>
            </div>
        `;

        // Create decision section
        const decisionClass = results.decision && results.decision.toLowerCase().includes('buy') ? 'buy' : 
                             results.decision && results.decision.toLowerCase().includes('sell') ? 'sell' : 'hold';
        
        const decisionHtml = `
            <div class="decision-box ${decisionClass}">
                <h4><i class="fas fa-gavel me-2"></i>交易决策</h4>
                <p class="fs-5 mb-0">${results.decision || '暂无决策'}</p>
            </div>
        `;

        // Create reports section
        let reportsHtml = '<h5><i class="fas fa-file-alt me-2"></i>详细报告</h5>';
        
        if (results.final_state) {
            const state = results.final_state;
            
            if (state.market_report) {
                reportsHtml += `
                    <div class="report-section">
                        <h6><i class="fas fa-chart-bar me-2"></i>市场分析</h6>
                        <div>${this.formatReportContent(state.market_report)}</div>
                    </div>
                `;
            }
            
            if (state.sentiment_report) {
                reportsHtml += `
                    <div class="report-section">
                        <h6><i class="fas fa-comments me-2"></i>情绪分析</h6>
                        <div>${this.formatReportContent(state.sentiment_report)}</div>
                    </div>
                `;
            }
            
            if (state.news_report) {
                reportsHtml += `
                    <div class="report-section">
                        <h6><i class="fas fa-newspaper me-2"></i>新闻分析</h6>
                        <div>${this.formatReportContent(state.news_report)}</div>
                    </div>
                `;
            }
            
            if (state.fundamentals_report) {
                reportsHtml += `
                    <div class="report-section">
                        <h6><i class="fas fa-calculator me-2"></i>基本面分析</h6>
                        <div>${this.formatReportContent(state.fundamentals_report)}</div>
                    </div>
                `;
            }
        }

        // Action buttons
        const actionsHtml = `
            <div class="text-center mt-4">
                <button class="btn btn-primary me-2" onclick="app.showAnalysisForm()">
                    <i class="fas fa-plus me-2"></i>New Analysis
                </button>
                <button class="btn btn-secondary" onclick="app.showAnalyses()">
                    <i class="fas fa-history me-2"></i>View History
                </button>
            </div>
        `;

        container.innerHTML = summaryHtml + decisionHtml + reportsHtml + actionsHtml;
    }

    formatReportContent(content) {
        // Simple formatting for report content
        if (typeof content === 'string') {
            return content.replace(/\n/g, '<br>');
        }
        return JSON.stringify(content, null, 2);
    }

    getResearchDepthLabel(value) {
        const depth = this.config.research_depths.find(d => d.value === value);
        return depth ? depth.label : value;
    }

    async loadAnalysesHistory() {
        try {
            const response = await fetch('/api/analyses');
            const data = await response.json();
            
            this.displayAnalysesHistory(data.analyses);
            
        } catch (error) {
            console.error('Failed to load analyses history:', error);
        }
    }

    displayAnalysesHistory(analyses) {
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '';

        if (analyses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        <i class="fas fa-info-circle me-2"></i>未找到分析
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by timestamp, most recent first
        analyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        analyses.forEach(analysis => {
            const row = document.createElement('tr');
            
            const statusClass = `status-${analysis.status}`;
            const statusIcon = this.getStatusIcon(analysis.status);
            
            row.innerHTML = `
                <td><strong>${analysis.ticker}</strong></td>
                <td>${analysis.analysis_date}</td>
                <td>
                    <span class="badge ${statusClass}">
                        <i class="${statusIcon} me-1"></i>${analysis.status}
                    </span>
                </td>
                <td>${new Date(analysis.timestamp).toLocaleString()}</td>
                <td>
                    ${analysis.status === 'completed' ? 
                        `<button class="btn btn-sm btn-outline-primary" onclick="app.viewAnalysis('${analysis.id}')">
                            <i class="fas fa-eye me-1"></i>查看
                        </button>` : 
                        `<button class="btn btn-sm btn-outline-secondary" disabled>
                            <i class="fas fa-clock me-1"></i>待处理
                        </button>`
                    }
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    getStatusIcon(status) {
        switch (status) {
            case 'completed': return 'fas fa-check-circle';
            case 'running': return 'fas fa-spinner fa-spin';
            case 'error': return 'fas fa-exclamation-circle';
            case 'queued': return 'fas fa-clock';
            default: return 'fas fa-question-circle';
        }
    }

    async viewAnalysis(analysisId) {
        try {
            const response = await fetch(`/api/analysis/${analysisId}/results`);
            const results = await response.json();
            
            this.currentAnalysisId = analysisId;
            this.displayResults(results);
            this.showAnalysisResults();
            
        } catch (error) {
            console.error('Failed to load analysis:', error);
            this.showToast('加载分析结果失败', 'error');
        }
    }

    // UI Navigation Methods
    showAnalysisForm() {
        this.hideAllSections();
        document.getElementById('analysis-form-section').classList.remove('section-hidden');
    }

    showAnalysisProgress() {
        this.hideAllSections();
        document.getElementById('analysis-progress-section').classList.remove('section-hidden');
    }

    showAnalysisResults() {
        this.hideAllSections();
        document.getElementById('analysis-results-section').classList.remove('section-hidden');
    }

    showAnalyses() {
        this.hideAllSections();
        document.getElementById('analysis-history-section').classList.remove('section-hidden');
        this.loadAnalysesHistory();
    }

    hideAllSections() {
        const sections = [
            'analysis-form-section',
            'analysis-progress-section',
            'analysis-results-section',
            'analysis-history-section'
        ];

        sections.forEach(sectionId => {
            document.getElementById(sectionId).classList.add('section-hidden');
        });
    }

    showLoadingSpinner() {
        // Create and show loading overlay
        const overlay = document.createElement('div');
        overlay.className = 'spinner-overlay';
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner-content">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">加载中...</span>
                </div>
                <div>正在启动分析...</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    hideLoadingSpinner() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastBody = document.getElementById('toast-body');
        
        // Update toast content
        toastBody.textContent = message;
        
        // Update toast style based on type
        toast.className = 'toast';
        if (type === 'error') {
            toast.classList.add('bg-danger', 'text-white');
        } else if (type === 'success') {
            toast.classList.add('bg-success', 'text-white');
        } else if (type === 'warning') {
            toast.classList.add('bg-warning');
        } else {
            toast.classList.add('bg-info', 'text-white');
        }
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TradingAgentsApp();
});

// Global functions for button clicks
function showAnalysisForm() {
    if (window.app) {
        window.app.showAnalysisForm();
    }
}

function showAnalyses() {
    if (window.app) {
        window.app.showAnalyses();
    }
}
