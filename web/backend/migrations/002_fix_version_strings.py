"""
Apply migration 002: Fix corrupted version strings
Run this script to clean up version strings like "1.0_edited_edited_edited"
"""
import sys
import os
import re

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL

def fix_version_strings():
    """Fix corrupted version strings in agent_prompt_templates table"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    try:
        with engine.connect() as conn:
            print("Checking for corrupted version strings...")
            
            # Get all templates with their versions
            result = conn.execute(text("""
                SELECT id, version FROM agent_prompt_templates
            """))
            
            rows = result.fetchall()
            fixed_count = 0
            
            for row in rows:
                template_id, version = row
                
                # Check if version contains underscore or is too long
                if '_' in version or len(version) > 10:
                    # Extract numeric part (e.g., "1.0_edited_edited" -> "1.0")
                    match = re.match(r'^(\d+\.\d+)', version)
                    if match:
                        clean_version = match.group(1)
                    else:
                        # If no numeric part found, reset to 1.0
                        clean_version = "1.0"
                    
                    print(f"  Fixing template {template_id}: '{version}' -> '{clean_version}'")
                    
                    conn.execute(text("""
                        UPDATE agent_prompt_templates 
                        SET version = :clean_version 
                        WHERE id = :template_id
                    """), {"clean_version": clean_version, "template_id": template_id})
                    
                    fixed_count += 1
            
            if fixed_count > 0:
                conn.commit()
                print(f"✓ Fixed {fixed_count} corrupted version string(s)")
            else:
                print("✓ No corrupted version strings found")
            
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    fix_version_strings()
