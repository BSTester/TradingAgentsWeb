"""
Futu Trading Integration Example
演示如何使用 Futu 模拟交易 API 功能
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from tradingagents.dataflows.futu_trading import (
    get_account_info,
    get_positions,
    get_quote,
    get_kline_data,
    get_hot_stocks,
    get_hot_news,
    place_order,
    cancel_order,
    get_orders,
    FutuAPIError
)


def example_account_management():
    """示例：账户管理功能"""
    print("\n" + "="*60)
    print("示例 1: 账户管理")
    print("="*60)
    
    try:
        # 获取美股账户信息
        print("\n1. 获取美股账户信息...")
        account = get_account_info("US")
        print(f"账户净值: {account.get('net_asset_value', 'N/A')}")
        print(f"可用资金: {account.get('cash', 'N/A')}")
        print(f"持仓市值: {account.get('position_value', 'N/A')}")
        
        # 获取持仓列表
        print("\n2. 获取持仓列表...")
        positions = get_positions("US")
        if positions:
            for pos in positions[:5]:  # 只显示前5个
                print(f"  {pos.get('stock_code')}: {pos.get('quantity')} 股, "
                      f"成本 {pos.get('cost_price')}, "
                      f"现价 {pos.get('current_price')}, "
                      f"盈亏 {pos.get('profit_loss_pct')}%")
        else:
            print("  当前无持仓")
            
    except FutuAPIError as e:
        print(f"错误: {e}")
        print(f"错误类型: {e.error_type}")


def example_market_data():
    """示例：市场数据获取"""
    print("\n" + "="*60)
    print("示例 2: 市场数据")
    print("="*60)
    
    try:
        # 获取股票行情
        print("\n1. 获取 AAPL 实时行情...")
        quote = get_quote("AAPL", "US")
        print(f"股票代码: {quote.get('stock_code')}")
        print(f"股票名称: {quote.get('stock_name')}")
        print(f"当前价格: {quote.get('current_price')}")
        print(f"涨跌幅: {quote.get('change_pct')}%")
        
        # 获取K线数据
        print("\n2. 获取 AAPL 日K线数据（最近5条）...")
        klines = get_kline_data("AAPL", "US", kline_type=2)
        if klines:
            for kline in klines[-5:]:
                print(f"  {kline.get('timestamp')}: "
                      f"开 {kline.get('open')}, "
                      f"高 {kline.get('high')}, "
                      f"低 {kline.get('low')}, "
                      f"收 {kline.get('close')}")
        
        # 获取热门股票
        print("\n3. 获取美股热门股票（前5名）...")
        hot_stocks = get_hot_stocks("US", count=5)
        for stock in hot_stocks:
            print(f"  {stock.get('stock_code')}: {stock.get('stock_name')}, "
                  f"涨跌 {stock.get('change_pct')}%")
            
    except FutuAPIError as e:
        print(f"错误: {e}")


def example_trading_operations():
    """示例：交易操作"""
    print("\n" + "="*60)
    print("示例 3: 交易操作")
    print("="*60)
    
    try:
        # 下限价买单
        print("\n1. 下限价买单（AAPL, 10股, $180.50）...")
        result = place_order(
            stock_code="AAPL",
            market_type="US",
            side="BUY",
            quantity=10,
            price=180.50,
            order_type="LIMIT"
        )
        
        if result.get('success'):
            order_id = result.get('order_id')
            print(f"✓ 订单已提交: {order_id}")
            print(f"  消息: {result.get('message')}")
            
            # 查询订单状态
            print("\n2. 查询订单状态...")
            orders = get_orders("US", filter_status=0)  # 查询所有订单
            for order in orders[:3]:  # 只显示前3个
                print(f"  订单 {order.get('order_id')}: "
                      f"{order.get('stock_code')} "
                      f"{order.get('side')} "
                      f"{order.get('quantity')}股 @ {order.get('price')}, "
                      f"状态: {order.get('status')}")
            
            # 撤单示例（如果需要）
            # print("\n3. 撤销订单...")
            # cancel_result = cancel_order(order_id, "US")
            # if cancel_result.get('success'):
            #     print(f"✓ 订单已撤销")
            
        else:
            print(f"✗ 订单失败: {result.get('message')}")
            
    except FutuAPIError as e:
        print(f"错误: {e}")
    except ValueError as e:
        print(f"参数错误: {e}")


def example_news_and_info():
    """示例：资讯信息"""
    print("\n" + "="*60)
    print("示例 4: 资讯信息")
    print("="*60)
    
    try:
        # 获取热门新闻
        print("\n获取热门新闻（中文）...")
        news = get_hot_news("zh-cn")
        for article in news[:5]:  # 只显示前5条
            print(f"  • {article.get('title')}")
            print(f"    来源: {article.get('source')}, "
                  f"时间: {article.get('publish_time')}")
            
    except FutuAPIError as e:
        print(f"错误: {e}")


def main():
    """主函数"""
    print("\n" + "="*60)
    print("Futu 模拟交易 API 集成示例")
    print("="*60)
    
    # 检查环境变量
    base_url = os.getenv("FUTU_API_BASE_URL", "http://localhost:8000")
    print(f"\nAPI 地址: {base_url}")
    print(f"超时设置: {os.getenv('FUTU_API_TIMEOUT', '30')} 秒")
    
    print("\n提示: 确保 Futu API 服务正在运行")
    print("提示: 可以在 .env 文件中配置 FUTU_API_BASE_URL")
    
    # 运行示例
    try:
        example_account_management()
        example_market_data()
        example_news_and_info()
        
        # 交易操作示例（谨慎使用，会实际下单）
        print("\n" + "="*60)
        print("注意: 以下操作会实际下单到模拟账户")
        response = input("是否继续执行交易示例? (y/N): ")
        if response.lower() == 'y':
            example_trading_operations()
        else:
            print("已跳过交易示例")
            
    except KeyboardInterrupt:
        print("\n\n程序已中断")
    except Exception as e:
        print(f"\n发生错误: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*60)
    print("示例运行完成")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
