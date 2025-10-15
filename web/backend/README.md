# TradingAgents Web Interface

A modern, user-friendly web interface for the TradingAgents Multi-Agents LLM Financial Trading Framework.

## Features

### 🌐 Web-Based Configuration
- Intuitive web forms for all analysis parameters
- Real-time validation and feedback
- Mobile-responsive design
- No command-line knowledge required

### 📊 Real-Time Analysis Monitoring
- Live progress tracking with visual progress bars
- Agent status monitoring (Analyst Team, Research Team, Trading Team, Risk Management)
- Step-by-step analysis progress updates
- Real-time notifications

### 📈 Rich Results Display
- Comprehensive analysis reports
- Formatted trading decisions with visual indicators
- Detailed breakdowns by analyst team
- Export and sharing capabilities

### 📚 Analysis History Management
- View all past analyses
- Filter by ticker, date, or status
- Reload previous analysis results
- Status tracking (completed, running, error, queued)

## Quick Start

1. **Install Dependencies** (if not already installed):
   ```bash
   pip install fastapi uvicorn jinja2
   ```

2. **Set up API Keys** (create a `.env` file):
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys
   ```

3. **Start the Web Interface**:
   ```bash
   python start_web.py
   ```

4. **Open in Browser**:
   Navigate to `http://localhost:8000`

## Interface Sections

### Configuration Form
The main configuration form includes 6 steps:

1. **Ticker Symbol**: Enter the stock symbol to analyze
2. **Analysis Date**: Select the date for historical analysis
3. **Analysts Team**: Choose which AI analysts to include
4. **Research Depth**: Select analysis complexity level
5. **LLM Provider**: Choose AI service (OpenAI, Anthropic, Google, etc.)
6. **Thinking Agents**: Select specific AI models for analysis

### Analysis Progress
Real-time monitoring includes:
- Progress bar showing analysis completion
- Current step description
- Agent status grid showing team progress
- Option to return to configuration

### Results Display
Comprehensive results showing:
- Analysis summary with key parameters
- Trading decision with visual indicators
- Detailed reports from each analyst team
- Options for new analysis or viewing history

### Analysis History
Historical view featuring:
- Table of all past analyses
- Status indicators and timestamps
- Action buttons to view completed analyses
- Filter and search capabilities

## API Endpoints

The web interface provides a REST API:

- `GET /api/config` - Get configuration options
- `POST /api/analyze` - Start new analysis
- `GET /api/analysis/{id}/status` - Check analysis status
- `GET /api/analysis/{id}/results` - Get analysis results
- `GET /api/analyses` - List all analyses

## Architecture

### Frontend
- **HTML5** with Bootstrap 5 for responsive design
- **Vanilla JavaScript** for interactivity
- **Font Awesome** icons for visual elements
- **Real-time polling** for status updates

### Backend
- **FastAPI** for REST API
- **Uvicorn** ASGI server
- **Jinja2** templating
- **Pydantic** data validation
- **Background tasks** for analysis execution

## Configuration Options

### Supported Analysts
- Market Analyst - Technical and market trend analysis
- Social Media Analyst - Sentiment from social platforms
- News Analyst - News impact and sentiment analysis
- Fundamentals Analyst - Company financial analysis

### Research Depth Levels
- **Shallow (1)** - Quick research, minimal debate rounds
- **Medium (3)** - Balanced research with moderate discussion
- **Deep (5)** - Comprehensive research with extensive debate

### LLM Providers
- **OpenAI** - GPT models including o1, o3, GPT-4o series
- **Anthropic** - Claude models (Haiku, Sonnet, Opus)
- **Google** - Gemini models
- **OpenRouter** - Access to multiple model providers
- **Ollama** - Local model deployment

## Security Considerations

- API keys stored in environment variables
- No sensitive data logged
- Session-based analysis tracking
- Input validation and sanitization

## Troubleshooting

### Common Issues

1. **Port 8000 already in use**:
   ```bash
   # Kill any existing process
   lsof -ti:8000 | xargs kill -9
   # Or use a different port
   uvicorn web.app:app --port 8001
   ```

2. **Import errors**:
   - Ensure you're using the virtual environment
   - Check all dependencies are installed
   - Verify project structure is intact

3. **API key errors**:
   - Check `.env` file exists and has correct keys
   - Ensure environment variables are loaded
   - Verify API key format and validity

4. **Analysis failures**:
   - Check internet connectivity
   - Verify API quotas and limits
   - Review error messages in browser console

### Getting Help

1. Check the main [README.md](../README.md) for general setup
2. Review the [Troubleshooting section](../README.md#troubleshooting)
3. Open an issue on [GitHub](https://github.com/TauricResearch/TradingAgents/issues)
4. Join the [Discord community](https://discord.com/invite/hk9PGKShPK)

## Development

To modify or extend the web interface:

1. **Frontend**: Edit files in `web/static/` and `web/templates/`
2. **Backend**: Modify `web/app.py` for API changes
3. **Styling**: Update `web/static/css/style.css`
4. **JavaScript**: Modify `web/static/js/app.js`

The web server runs in development mode with auto-reload enabled.
