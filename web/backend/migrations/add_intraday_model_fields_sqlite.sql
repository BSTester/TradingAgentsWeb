-- Migration: Add llm_model field to UserConfig for intraday trading (SQLite)
-- Date: 2025-01-08
-- Description: Adds intraday_llm_model column to user_configs table (uses deep thinker options)

-- SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we need to check first
-- Run this command and ignore error if column already exists

-- Add intraday_llm_model column
ALTER TABLE user_configs ADD COLUMN intraday_llm_model VARCHAR(100);
