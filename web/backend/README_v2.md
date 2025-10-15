# TradingAgents Web Interface v2 - Authentication System

## Overview

This version adds user authentication and database integration to the TradingAgents web interface.

## Features

- User registration and login
- JWT-based authentication
- SQLite database for user and analysis data
- Protected API endpoints
- Analysis history per user

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Initialize database:
```bash
python web/init_db.py --sample-user
```

3. Run the application:
```bash
python web/app_v2.py
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/refresh` - Refresh token

### Analysis (Protected)
- `POST /api/analyze` - Start new analysis
- `GET /api/analysis/{id}/status` - Get analysis status
- `GET /api/analysis/{id}/results` - Get analysis results
- `GET /api/analyses` - List user's analyses

## Database Schema

- `users` - User accounts
- `analysis_records` - Analysis requests and results
- `analysis_logs` - Real-time analysis logs
- `export_records` - PDF export tracking

## Testing

Run authentication tests:
```bash
python test_auth.py
```

## Default User

Username: admin
Password: admin123
Email: admin@tradingagents.com