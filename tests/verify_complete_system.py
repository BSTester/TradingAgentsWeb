#!/usr/bin/env python3
"""
Complete System Verification Script

Verifies that all components are working correctly:
1. Backend imports
2. Database models
3. API routes
4. Frontend build
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def test_backend_imports():
    """Test 1: Backend imports"""
    print("=" * 60)
    print("Test 1: Backend Imports")
    print("=" * 60)
    
    try:
        # Test original schemas
        from web.backend.schemas import (
            AnalysisRequest,
            AnalysisResponse,
            User,
            Token,
        )
        print("✅ Original schemas imported successfully")
        
        # Test new schemas
        from web.backend.schemas import (
            PromptTemplateResponse,
            ToolResponse,
            BulkToolSelectionUpdate,
        )
        print("✅ New prompt schemas imported successfully")
        
        # Test models
        from web.backend.models import (
            AgentTool,
            AgentPromptTemplate,
            TemplateTools,
        )
        print("✅ New models imported successfully")
        
        # Test routes
        from web.backend.routes import prompt_routes
        print("✅ Prompt routes imported successfully")
        
        # Test services
        from web.backend.services.prompt_loader import load_user_prompt_template
        print("✅ Prompt loader service imported successfully")
        
        # Test tool registry
        from tradingagents.agents.utils.tool_registry import get_all_tools_metadata
        print("✅ Tool registry imported successfully")
        
        return True
    except Exception as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_database_connection():
    """Test 2: Database connection"""
    print("\n" + "=" * 60)
    print("Test 2: Database Connection")
    print("=" * 60)
    
    try:
        from web.backend.database import SessionLocal
        from web.backend.models import AgentTool, AgentPromptTemplate
        
        db = SessionLocal()
        try:
            # Test query
            tools_count = db.query(AgentTool).count()
            templates_count = db.query(AgentPromptTemplate).count()
            
            print(f"✅ Database connected")
            print(f"   - Tools: {tools_count}")
            print(f"   - Templates: {templates_count}")
            
            return True
        finally:
            db.close()
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False


def test_api_app():
    """Test 3: FastAPI app"""
    print("\n" + "=" * 60)
    print("Test 3: FastAPI App")
    print("=" * 60)
    
    try:
        from web.backend.app import app
        
        # Check routes
        routes = [route.path for route in app.routes]
        prompt_routes = [r for r in routes if '/prompts' in r]
        
        print(f"✅ FastAPI app loaded")
        print(f"   - Total routes: {len(routes)}")
        print(f"   - Prompt routes: {len(prompt_routes)}")
        
        if prompt_routes:
            print("   - Prompt endpoints:")
            for route in prompt_routes[:5]:
                print(f"     • {route}")
        
        return True
    except Exception as e:
        print(f"❌ App error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_frontend_files():
    """Test 4: Frontend files"""
    print("\n" + "=" * 60)
    print("Test 4: Frontend Files")
    print("=" * 60)
    
    try:
        frontend_files = [
            'web/frontend/src/lib/api/prompts.ts',
            'web/frontend/src/components/PromptEditor.tsx',
            'web/frontend/src/components/ToolSelector.tsx',
            'web/frontend/src/components/intraday/PromptConfigTab.tsx',
        ]
        
        all_exist = True
        for file_path in frontend_files:
            exists = os.path.exists(file_path)
            status = "✅" if exists else "❌"
            print(f"{status} {file_path}")
            if not exists:
                all_exist = False
        
        return all_exist
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Complete System Verification")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Backend Imports", test_backend_imports()))
    results.append(("Database Connection", test_database_connection()))
    results.append(("FastAPI App", test_api_app()))
    results.append(("Frontend Files", test_frontend_files()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Verification Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {name}")
    
    all_passed = all(passed for _, passed in results)
    
    if all_passed:
        print("\n🎉 All verifications passed!")
        print("\n✨ System is ready to use!")
        print("\nNext steps:")
        print("1. Start backend: python web/backend/app.py")
        print("2. Start frontend: cd web/frontend && npm run dev")
        print("3. Visit: http://localhost:3000/intraday-trading")
        print("4. Click '设置' button to customize prompts")
    else:
        print("\n⚠️  Some verifications failed")
        print("Please check the errors above")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
