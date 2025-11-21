-- ============================================================
-- 数据库迁移：增加API密钥字段长度（MySQL版本）
-- 将所有API密钥字段从VARCHAR(255)增加到VARCHAR(1000)
-- 支持存储JWT token等长密钥
-- ============================================================

-- 使用数据库（根据实际情况修改数据库名）
-- USE tradingagents;

-- ============================================================
-- 1. user_configs 表
-- ============================================================
ALTER TABLE user_configs MODIFY COLUMN intraday_api_key VARCHAR(1000);
ALTER TABLE user_configs MODIFY COLUMN last_api_key VARCHAR(1000);
ALTER TABLE user_configs MODIFY COLUMN futu_api_key VARCHAR(1000);
ALTER TABLE user_configs MODIFY COLUMN intraday_futu_api_key VARCHAR(1000);

-- ============================================================
-- 2. scheduled_tasks 表
-- ============================================================
ALTER TABLE scheduled_tasks MODIFY COLUMN api_key VARCHAR(1000);
ALTER TABLE scheduled_tasks MODIFY COLUMN futu_api_key VARCHAR(1000);

-- ============================================================
-- 3. analysis_records 表
-- ============================================================
ALTER TABLE analysis_records MODIFY COLUMN api_key VARCHAR(1000);
ALTER TABLE analysis_records MODIFY COLUMN futu_api_key VARCHAR(1000);

-- ============================================================
-- 4. llm_providers 表
-- ============================================================
ALTER TABLE llm_providers MODIFY COLUMN api_key VARCHAR(1000);

-- ============================================================
-- 验证修改结果
-- ============================================================
-- 查看 user_configs 表结构
-- DESCRIBE user_configs;

-- 查看 scheduled_tasks 表结构
-- DESCRIBE scheduled_tasks;

-- 查看 analysis_records 表结构
-- DESCRIBE analysis_records;

-- 查看 llm_providers 表结构
-- DESCRIBE llm_providers;

-- ============================================================
-- 完成
-- ============================================================
-- 所有API密钥字段已增加到1000字符
-- 现在可以存储JWT token等长密钥
-- ============================================================
