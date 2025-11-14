-- Migration: Increase version column length in agent_prompt_templates table
-- Date: 2025-11-14
-- Description: Change version column from VARCHAR(20) to VARCHAR(50) to support longer version strings

-- For MySQL
ALTER TABLE agent_prompt_templates MODIFY COLUMN version VARCHAR(50) NOT NULL DEFAULT '1.0';

-- Note: If using PostgreSQL, use this instead:
-- ALTER TABLE agent_prompt_templates ALTER COLUMN version TYPE VARCHAR(50);

-- Verify the change
-- SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'agent_prompt_templates' AND COLUMN_NAME = 'version';
