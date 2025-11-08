-- Migration: Add Intraday Trading Agent Tables
-- Date: 2025-11-06
-- Description: Creates three new tables for the intraday trading agent system:
--              1. position_records - Track stock positions with first open time
--              2. trading_history - Record all trades for each position
--              3. intraday_decision_records - Store complete analysis sessions

-- ============================================================================
-- Table: position_records
-- Purpose: Track stock positions for intraday trading
-- ============================================================================
CREATE TABLE IF NOT EXISTS position_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_code VARCHAR(20) NOT NULL,
    market_type VARCHAR(10) NOT NULL,
    
    -- Position info
    first_open_time TIMESTAMP NOT NULL,
    first_open_price REAL NOT NULL,
    initial_quantity INTEGER NOT NULL,
    
    -- Current status
    current_quantity INTEGER NOT NULL,
    last_update_time TIMESTAMP NOT NULL,
    is_closed BOOLEAN DEFAULT 0 NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for position_records
CREATE INDEX IF NOT EXISTS idx_position_records_user_id ON position_records(user_id);
CREATE INDEX IF NOT EXISTS idx_position_records_stock_code ON position_records(stock_code);
CREATE INDEX IF NOT EXISTS idx_position_records_user_stock ON position_records(user_id, stock_code);

-- ============================================================================
-- Table: trading_history
-- Purpose: Track all trades for each position with decision context
-- ============================================================================
CREATE TABLE IF NOT EXISTS trading_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_record_id INTEGER NOT NULL,
    
    -- Trade info
    trade_time TIMESTAMP NOT NULL,
    trade_type VARCHAR(10) NOT NULL,  -- BUY/SELL
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    order_id VARCHAR(50),
    
    -- Decision context
    decision_reason TEXT,
    technical_signals TEXT,  -- JSON stored as TEXT in SQLite
    news_sentiment VARCHAR(20),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Foreign keys
    FOREIGN KEY (position_record_id) REFERENCES position_records(id) ON DELETE CASCADE
);

-- Indexes for trading_history
CREATE INDEX IF NOT EXISTS idx_trading_history_position_id ON trading_history(position_record_id);
CREATE INDEX IF NOT EXISTS idx_trading_history_trade_time ON trading_history(trade_time);

-- ============================================================================
-- Table: intraday_decision_records
-- Purpose: Store complete analysis sessions with tool calls and reasoning
-- ============================================================================
CREATE TABLE IF NOT EXISTS intraday_decision_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    -- Session info
    session_id VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status VARCHAR(20) NOT NULL,  -- running/completed/failed
    
    -- Analysis context
    market_type VARCHAR(10) NOT NULL,
    positions_analyzed TEXT NOT NULL,  -- JSON stored as TEXT in SQLite
    account_snapshot TEXT NOT NULL,    -- JSON stored as TEXT in SQLite
    
    -- Decision output
    decision_report TEXT,
    trades_executed TEXT,  -- JSON stored as TEXT in SQLite
    tool_calls TEXT,       -- JSON stored as TEXT in SQLite
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for intraday_decision_records
CREATE INDEX IF NOT EXISTS idx_intraday_decisions_user_id ON intraday_decision_records(user_id);
CREATE INDEX IF NOT EXISTS idx_intraday_decisions_session_id ON intraday_decision_records(session_id);
CREATE INDEX IF NOT EXISTS idx_intraday_decisions_start_time ON intraday_decision_records(start_time);
CREATE INDEX IF NOT EXISTS idx_intraday_decisions_status ON intraday_decision_records(status);

-- ============================================================================
-- PostgreSQL Version (for production deployments)
-- ============================================================================
-- Note: If using PostgreSQL, replace the above with:
--
-- CREATE TABLE position_records (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     stock_code VARCHAR(20) NOT NULL,
--     market_type VARCHAR(10) NOT NULL,
--     first_open_time TIMESTAMP WITH TIME ZONE NOT NULL,
--     first_open_price DOUBLE PRECISION NOT NULL,
--     initial_quantity INTEGER NOT NULL,
--     current_quantity INTEGER NOT NULL,
--     last_update_time TIMESTAMP WITH TIME ZONE NOT NULL,
--     is_closed BOOLEAN DEFAULT FALSE NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
-- );
--
-- CREATE TABLE trading_history (
--     id SERIAL PRIMARY KEY,
--     position_record_id INTEGER NOT NULL REFERENCES position_records(id) ON DELETE CASCADE,
--     trade_time TIMESTAMP WITH TIME ZONE NOT NULL,
--     trade_type VARCHAR(10) NOT NULL,
--     quantity INTEGER NOT NULL,
--     price DOUBLE PRECISION NOT NULL,
--     order_id VARCHAR(50),
--     decision_reason TEXT,
--     technical_signals JSONB,
--     news_sentiment VARCHAR(20),
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
-- );
--
-- CREATE TABLE intraday_decision_records (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     session_id VARCHAR(255) UNIQUE NOT NULL,
--     start_time TIMESTAMP WITH TIME ZONE NOT NULL,
--     end_time TIMESTAMP WITH TIME ZONE,
--     status VARCHAR(20) NOT NULL,
--     market_type VARCHAR(10) NOT NULL,
--     positions_analyzed JSONB NOT NULL,
--     account_snapshot JSONB NOT NULL,
--     decision_report TEXT,
--     trades_executed JSONB,
--     tool_calls JSONB,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
-- );
--
-- (Add the same indexes as above)
