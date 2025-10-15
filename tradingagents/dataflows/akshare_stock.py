"""
AKShare股票数据获取模块
提供股票历史数据和实时数据的获取功能
"""
from typing import Annotated
from .akshare_common import (
    check_akshare_availability, validate_market_support, format_symbol_for_market,
    validate_date_format, format_date_for_akshare, standardize_column_names,
    process_dataframe_for_output, handle_akshare_exception, log_operation, ak
)


def get_stock_data(
    symbol: Annotated[str, "ticker symbol of the company"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """
    获取股票历史数据 - 支持A股、港股、美股
    
    Args:
        symbol: 股票代码
        start_date: 开始日期 (YYYY-MM-DD)
        end_date: 结束日期 (YYYY-MM-DD)
        
    Returns:
        str: CSV格式的股票历史数据
    """
    try:
        check_akshare_availability()
        
        # 验证日期格式
        validate_date_format(start_date)
        validate_date_format(end_date)
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "stock data retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        
        # 格式化日期
        formatted_start = format_date_for_akshare(start_date, market)
        formatted_end = format_date_for_akshare(end_date, market)
        
        log_operation("get_stock_data", symbol, market, "ATTEMPT")
        
        # 根据市场选择对应的AKShare接口
        data = None
        if market == 'A_STOCK':
            data = ak.stock_zh_a_hist(
                symbol=formatted_symbol,
                period="daily",
                start_date=formatted_start,
                end_date=formatted_end,
                adjust="qfq"  # 前复权
            )
        elif market == 'HK_STOCK':
            data = ak.stock_hk_hist(
                symbol=formatted_symbol,
                period="daily",
                start_date=formatted_start,
                end_date=formatted_end,
                adjust="qfq"
            )
        elif market == 'US_STOCK':
            # 使用 AKShare 的 stock_us_daily 接口，支持标准美股代码
            try:
                # 获取全部历史数据
                data = ak.stock_us_daily(symbol=formatted_symbol, adjust="qfq")
                
                if data is not None and not data.empty:
                    # 处理日期列和索引
                    import pandas as pd
                    data['date'] = pd.to_datetime(data['date'])
                    data.set_index('date', inplace=True)
                    
                    # 按日期范围筛选数据
                    start_dt = pd.to_datetime(start_date)
                    end_dt = pd.to_datetime(end_date)
                    data = data[(data.index >= start_dt) & (data.index <= end_dt)]
                    
            except Exception as e:
                # AKShare美股接口失败，抛出异常以触发回退
                raise Exception(f"AKShare US stock interface failed for {symbol}: {str(e)}")
        
        if data is None or data.empty:
            log_operation("get_stock_data", symbol, market, "FAILED")
            error_msg = f"No data found for symbol '{symbol}' between {start_date} and {end_date}"
            # 对于美股，抛出异常以触发回退到其他数据源
            if market == 'US_STOCK':
                raise Exception(error_msg)
            return error_msg
        
        # 标准化列名
        data = standardize_column_names(data, market)
        
        # 生成标准化输出
        additional_info = {
            "Formatted symbol": formatted_symbol,
            "Date range": f"{start_date} to {end_date}"
        }
        
        log_operation("get_stock_data", symbol, market, "SUCCESS")
        return process_dataframe_for_output(data, symbol, market_info, "Stock", additional_info)
        
    except Exception as e:
        log_operation("get_stock_data", symbol, market if 'market' in locals() else None, "FAILED")
        # 对于美股，直接抛出异常以触发回退
        if 'market' in locals() and market == 'US_STOCK':
            raise e
        return handle_akshare_exception(e, "retrieving stock data", symbol)


def get_realtime_data(
    symbol: Annotated[str, "ticker symbol of the company"]
) -> str:
    """
    获取股票实时数据
    
    Args:
        symbol: 股票代码
        
    Returns:
        str: CSV格式的实时股票数据
    """
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "realtime data retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        
        log_operation("get_realtime_data", symbol, market, "ATTEMPT")
        
        # 根据市场获取实时数据
        if market == 'A_STOCK':
            data = ak.stock_zh_a_spot_em()
            # 筛选特定股票
            clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
            stock_data = data[data['代码'] == clean_symbol]
            
        elif market == 'HK_STOCK':
            data = ak.stock_hk_spot_em()
            stock_data = data[data['代码'] == formatted_symbol]
            
        elif market == 'US_STOCK':
            data = ak.stock_us_spot_em()
            stock_data = data[data['代码'] == formatted_symbol]
        
        if stock_data.empty:
            log_operation("get_realtime_data", symbol, market, "FAILED")
            return f"No real-time data found for symbol '{symbol}'"
        
        # 转换为CSV字符串
        csv_string = stock_data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Real-time data for {symbol} ({market_info['market_name']})",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Data source: AKShare",
            f"# Data retrieved on: {ak.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_realtime_data", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_realtime_data", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_akshare_exception(e, "retrieving real-time data", symbol)


def get_stock_info(
    symbol: Annotated[str, "ticker symbol of the company"]
) -> str:
    """
    获取股票基本信息
    
    Args:
        symbol: 股票代码
        
    Returns:
        str: CSV格式的股票基本信息
    """
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "company info retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        
        log_operation("get_stock_info", symbol, market, "ATTEMPT")
        
        if market == 'A_STOCK':
            # A股公司信息
            clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
            basic_info = ak.stock_individual_info_em(symbol=clean_symbol)
            
            # 转换为更易读的格式
            info_dict = {}
            for _, row in basic_info.iterrows():
                info_dict[row['item']] = row['value']
            
            # 转换为DataFrame以便输出CSV
            import pandas as pd
            info_df = pd.DataFrame(list(info_dict.items()), columns=['Item', 'Value'])
            csv_string = info_df.to_csv(index=False)
            
        elif market == 'HK_STOCK':
            log_operation("get_stock_info", symbol, market, "FAILED")
            return f"Company info for Hong Kong stocks not fully supported by AKShare"
            
        elif market == 'US_STOCK':
            log_operation("get_stock_info", symbol, market, "FAILED")
            return f"Company info for US stocks not fully supported by AKShare"
        
        # 构建头部信息
        header_lines = [
            f"# Company information for {symbol} ({market_info['market_name']})",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Data source: AKShare",
            f"# Data retrieved on: {ak.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_stock_info", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_stock_info", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_akshare_exception(e, "retrieving company info", symbol)