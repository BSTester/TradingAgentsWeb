#!/usr/bin/env python3
"""
Migration: Add email_verification_codes table
Creates table for storing email verification codes for email-based login
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import DATABASE_URL

# Convert async database URL to sync for migrations
SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '+pymysql')


def migrate():
    """Create email_verification_codes table"""
    print("Creating email_verification_codes table...")
    
    engine = create_engine(SYNC_DATABASE_URL, echo=False)
    inspector = inspect(engine)
    
    # Check if table already exists
    if inspector.has_table('email_verification_codes'):
        print("✅ Table email_verification_codes already exists, skipping creation")
        return True
    
    try:
        with engine.begin() as conn:
            # Detect database type
            dialect_name = engine.dialect.name
            
            if dialect_name == 'sqlite':
                # SQLite version
                conn.execute(text("""
                    CREATE TABLE email_verification_codes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email VARCHAR(255) NOT NULL,
                        code_hash VARCHAR(255) NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME NOT NULL,
                        used BOOLEAN NOT NULL DEFAULT 0,
                        used_at DATETIME NULL,
                        ip_address VARCHAR(45) NULL
                    )
                """))
                
                # Create indexes
                conn.execute(text("""
                    CREATE INDEX idx_email_verification_codes_email 
                    ON email_verification_codes(email)
                """))
                
                conn.execute(text("""
                    CREATE INDEX idx_email_verification_codes_expires_at 
                    ON email_verification_codes(expires_at)
                """))
                
                conn.execute(text("""
                    CREATE INDEX idx_email_verification_codes_used 
                    ON email_verification_codes(used)
                """))
                
            elif dialect_name == 'mysql':
                # MySQL version
                conn.execute(text("""
                    CREATE TABLE email_verification_codes (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        code_hash VARCHAR(255) NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME NOT NULL,
                        used TINYINT(1) NOT NULL DEFAULT 0,
                        used_at DATETIME NULL,
                        ip_address VARCHAR(45) NULL,
                        INDEX idx_email (email),
                        INDEX idx_expires_at (expires_at),
                        INDEX idx_used (used)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """))
            
            elif dialect_name == 'postgresql':
                # PostgreSQL version
                conn.execute(text("""
                    CREATE TABLE email_verification_codes (
                        id SERIAL PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        code_hash VARCHAR(255) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        used BOOLEAN NOT NULL DEFAULT FALSE,
                        used_at TIMESTAMP WITH TIME ZONE NULL,
                        ip_address VARCHAR(45) NULL
                    )
                """))
                
                # Create indexes
                conn.execute(text("""
                    CREATE INDEX idx_email_verification_codes_email 
                    ON email_verification_codes(email)
                """))
                
                conn.execute(text("""
                    CREATE INDEX idx_email_verification_codes_expires_at 
                    ON email_verification_codes(expires_at)
                """))
                
                conn.execute(text("""
                    CREATE INDEX idx_email_verification_codes_used 
                    ON email_verification_codes(used)
                """))
            
            else:
                print(f"❌ Unsupported database dialect: {dialect_name}")
                return False
        
        print("✅ Successfully created email_verification_codes table")
        return True
        
    except OperationalError as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    finally:
        engine.dispose()


def main():
    """Run migration"""
    success = migrate()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
