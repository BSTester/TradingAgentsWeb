#!/usr/bin/env python3
"""
重置数据库脚本
警告：这将删除所有现有数据！
"""

import sys
import pymysql
from getpass import getpass

def reset_database():
    """重置数据库"""
    print("=" * 60)
    print("重置 TradingAgents 数据库")
    print("=" * 60)
    print()
    print("⚠️  警告：这将删除所有现有数据！")
    print()
    
    confirm = input("确认要继续吗？(输入 'yes' 继续): ")
    if confirm.lower() != 'yes':
        print("❌ 操作已取消")
        sys.exit(0)
    
    # 数据库配置
    config = {
        'host': '127.0.0.1',
        'port': 3306,
        'user': 'tradingagents',
        'password': 'tradingagents123',
        'charset': 'utf8mb4'
    }
    
    try:
        print("\n🔄 正在连接 MySQL...")
        # 连接到 MySQL（不指定数据库）
        conn = pymysql.connect(**config)
        cursor = conn.cursor()
        
        print("🗑️  正在删除旧数据库...")
        cursor.execute("DROP DATABASE IF EXISTS tradingagents")
        
        print("✨ 正在创建新数据库...")
        cursor.execute("CREATE DATABASE tradingagents CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("\n✅ 数据库已重置成功！")
        print("\n📋 下一步：")
        print("1. 启动应用：uvicorn web.backend.app_v2:app --reload")
        print("2. 数据库表将自动创建（包含 company_name 字段）")
        print("3. 第一个注册的用户将自动成为管理员")
        print()
        
    except pymysql.Error as e:
        print(f"\n❌ 数据库重置失败: {e}")
        print("\n请检查：")
        print("1. MySQL 服务是否运行")
        print("2. 用户名和密码是否正确")
        print("3. 用户是否有 DROP DATABASE 和 CREATE DATABASE 权限")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    reset_database()
