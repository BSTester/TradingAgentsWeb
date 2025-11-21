-- Migration: Add llm_model field to UserConfig for intraday trading
-- Date: 2025-01-08
-- Description: Adds intraday_llm_model column to user_configs table (uses deep thinker options)

-- Add intraday_llm_model column
ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS intraday_llm_model VARCHAR(100);

-- Add comment for documentation
COMMENT ON COLUMN user_configs.intraday_llm_model IS 'LLM model for intraday trading (uses deep thinker options from analysis config)';
