-- Add company_name column to analysis_records table
-- This migration adds support for storing Chinese company names

ALTER TABLE analysis_records 
ADD COLUMN IF NOT EXISTS company_name VARCHAR(100);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_analysis_records_company_name 
ON analysis_records(company_name);

-- Update existing records to set company_name from ticker (optional)
-- This can be run separately if needed
-- UPDATE analysis_records SET company_name = ticker WHERE company_name IS NULL;
