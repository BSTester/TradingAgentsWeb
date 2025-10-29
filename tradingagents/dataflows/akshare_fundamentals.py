"""
AkShare Fundamentals Data
Get fundamental data for stocks (company profile, key metrics, financial statements)
"""

import logging
import pandas as pd
from datetime import datetime
from .akshare_common import (
    _identify_market,
    normalize_symbol_for_sina,
    normalize_symbol_for_us,
    normalize_symbol_for_hk,
    map_frequency,
    map_statement_type,
    format_large_number,
    MARKET_PATTERNS,
    get_akshare
)


def get_fundamentals(ticker: str, curr_date: str = None) -> str:
    """
    Get fundamental data for a stock using AKShare with multi-source fallback
    
    Fallback strategy by market:
    - A股: stock_individual_info_em → stock_individual_basic_info_xq
    - 美股: stock_individual_basic_info_us_xq
    - 港股: stock_individual_basic_info_hk_xq
    
    Args:
        ticker: Stock symbol (e.g., "600000", "AAPL", "00700", "00700.HK")
        curr_date: Current date (not used for AkShare, kept for Alpha Vantage compatibility)
    
    Returns:
        Formatted string with fundamental data
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    market = _identify_market(ticker)
    logging.info(f"Getting fundamentals for {ticker}, identified market: {market}")
    
    try:
        # Normalize symbol for AKShare calls
        symbol_for_ak = ticker
        if market == 'HK_STOCK':
            symbol_for_ak = normalize_symbol_for_hk(ticker)
        
        company_name = "N/A"
        basic_info = {}
        data_source = ""
        
        # === A股降级策略 ===
        if market == 'A_STOCK':
            # 优先级1: 东方财富个股信息
            try:
                logging.info(f"Trying stock_individual_info_em for A-stock {ticker}")
                info_df = ak.stock_individual_info_em(symbol=ticker)
                
                if not info_df.empty:
                    info_dict = dict(zip(info_df['item'], info_df['value']))
                    # 东方财富使用 '股票简称' 字段
                    company_name = info_dict.get('股票简称', info_dict.get('公司名称', 'N/A'))
                    basic_info = info_dict
                    data_source = "stock_individual_info_em (EastMoney)"
                    logging.info(f"Successfully got A-stock fundamentals from EastMoney: {len(basic_info)} fields")
                else:
                    raise ValueError("Empty dataframe from EastMoney")
                    
            except Exception as e:
                logging.warning(f"stock_individual_info_em failed for {ticker}: {e}")
                
                # 优先级2: 雪球个股基本信息（降级）
                try:
                    logging.info(f"Falling back to stock_individual_basic_info_xq for A-stock {ticker}")
                    # 雪球接口需要带交易所前缀
                    xq_symbol = ticker
                    if ticker.startswith(('60', '68')):  # 上海
                        xq_symbol = f"SH{ticker}"
                    elif ticker.startswith(('00', '30')):  # 深圳
                        xq_symbol = f"SZ{ticker}"
                    elif ticker.startswith(('83', '87')):  # 北交所
                        xq_symbol = f"BJ{ticker}"
                    
                    info_df = ak.stock_individual_basic_info_xq(symbol=xq_symbol)
                    
                    if not info_df.empty:
                        info_dict = dict(zip(info_df['item'], info_df['value']))
                        company_name = info_dict.get('公司名称', info_dict.get('companyName', 'N/A'))
                        basic_info = info_dict
                        data_source = "stock_individual_basic_info_xq (Xueqiu)"
                        logging.info(f"Successfully got A-stock fundamentals from Xueqiu: {len(basic_info)} fields")
                    else:
                        raise ValueError("Empty dataframe from Xueqiu")
                        
                except Exception as e2:
                    logging.warning(f"stock_individual_basic_info_xq failed for {ticker}: {e2}")
                    basic_info = {}
                    company_name = "N/A"
                    data_source = "No data source available"
        
        # === 美股策略 ===
        elif market == 'US_STOCK':
            try:
                logging.info(f"Trying stock_individual_basic_info_us_xq for US stock {ticker}")
                info_df = ak.stock_individual_basic_info_us_xq(symbol=ticker)
                
                if not info_df.empty:
                    info_dict = dict(zip(info_df['item'], info_df['value']))
                    # 美股字段名: org_name_cn (中文), org_name_en (英文), org_short_name_cn, org_short_name_en
                    company_name = (info_dict.get('org_name_cn') or 
                                  info_dict.get('org_short_name_cn') or
                                  info_dict.get('org_name_en') or 
                                  info_dict.get('org_short_name_en') or
                                  info_dict.get('公司名称') or 
                                  info_dict.get('companyName') or 
                                  'N/A')
                    basic_info = info_dict
                    data_source = "stock_individual_basic_info_us_xq (Xueqiu)"
                    logging.info(f"Successfully got US stock fundamentals from Xueqiu: {len(basic_info)} fields")
                else:
                    raise ValueError("Empty dataframe from Xueqiu US")
                    
            except Exception as e:
                logging.warning(f"stock_individual_basic_info_us_xq failed for {ticker}: {e}")
                basic_info = {}
                company_name = "N/A"
                data_source = "No data source available"
        
        # === 港股策略 ===
        elif market == 'HK_STOCK':
            try:
                logging.info(f"Trying stock_individual_basic_info_hk_xq for HK stock {symbol_for_ak}")
                info_df = ak.stock_individual_basic_info_hk_xq(symbol=symbol_for_ak)
                
                if not info_df.empty:
                    info_dict = dict(zip(info_df['item'], info_df['value']))
                    # 港股字段名: comcnname (中文), comenname (英文)
                    company_name = (info_dict.get('comcnname') or 
                                  info_dict.get('comenname') or
                                  info_dict.get('org_name_cn') or 
                                  info_dict.get('org_short_name_cn') or
                                  info_dict.get('org_name_en') or 
                                  info_dict.get('org_short_name_en') or
                                  info_dict.get('公司名称') or 
                                  info_dict.get('companyName') or 
                                  'N/A')
                    basic_info = info_dict
                    data_source = "stock_individual_basic_info_hk_xq (Xueqiu)"
                    logging.info(f"Successfully got HK stock fundamentals from Xueqiu: {len(basic_info)} fields")
                else:
                    raise ValueError("Empty dataframe from Xueqiu HK")
                    
            except Exception as e:
                logging.warning(f"stock_individual_basic_info_hk_xq failed for {symbol_for_ak}: {e}")
                basic_info = {}
                company_name = "N/A"
                data_source = "No data source available"
        
        else:
            return f"Market type not supported for fundamentals: {market}"
        
        # === 格式化输出 ===
        result = f"## Company Profile for {ticker}:\n\n"
        result += f"**Basic Information:**\n"
        result += f"- Company Name: {company_name}\n"
        result += f"- Stock Code: {ticker}\n"
        result += f"- Market: {MARKET_PATTERNS[market]['description']}\n\n"
        
        # 添加关键指标（如果可用）
        if basic_info:
            result += f"**Key Metrics:**\n"
            
            # 通用字段映射（支持中英文字段名）
            # A股字段 + 美股雪球字段 + 港股雪球字段
            key_fields = [
                # 基本信息
                ('员工数', 'Staff Number', 'staff_num', 'staffNum'),
                ('网站', 'Website', 'org_website', 'web_site', 'website'),
                ('电话', 'Telephone', 'telephone', 'tel', 'phone'),
                ('传真', 'Fax', 'fax'),
                ('邮箱', 'Email', 'email'),
                ('交易所', 'Exchange', 'td_mkt', 'exchange'),
                ('主要股东', 'Major Holder', 'mainholder', 'majorHolder'),
                ('董事长', 'Chairman', 'chairman'),
                ('主营业务', 'Main Business', 'main_operation_business', 'mbu'),
                ('公司简介', 'Introduction', 'org_cn_introduction', 'comintr'),
                ('注册地址', 'Registered Address', 'reg_address_cn', 'rgiofc'),
                ('办公地址', 'Office Address', 'office_address_cn', 'hofclctmbu'),
                # 财务指标
                ('总股本', 'Total Shares', 'totalShares', 'total_share', 'actual_issue_total_shares_num', 'numtissh'),
                ('发行价', 'Issue Price', 'actual_issue_price', 'ispr'),
                ('募集资金', 'Raised Capital', 'total_raise_capital', 'nrfd'),
                ('流通股', 'Float Shares', 'floatShares', 'float_share'), 
                ('总市值', 'Market Cap', 'marketCap', 'total_mv'),
                ('流通市值', 'Float Market Cap', 'floatMarketCap', 'circ_mv'),
                ('市盈率', 'P/E Ratio', 'peRatio', 'pe_ratio'),
                ('市净率', 'P/B Ratio', 'pbRatio', 'pb_ratio'),
                ('每股收益', 'EPS', 'eps', 'eps_ttm'),
                ('每股净资产', 'Book Value Per Share', 'bvps', 'bv_per_share'),
                ('净资产收益率', 'ROE', 'roe', 'roe_ttm'),
                ('毛利率', 'Gross Margin', 'grossMargin', 'gross_profit_margin'),
                ('净利率', 'Net Margin', 'netMargin', 'net_profit_margin')
            ]
            
            displayed_count = 0
            for field_names in key_fields:
                value = None
                display_name = field_names[0]  # 使用中文名作为显示名
                
                # 尝试所有可能的字段名
                for field_name in field_names:
                    if field_name in basic_info:
                        value = basic_info[field_name]
                        break
                
                if value and str(value) not in ['nan', '-', 'None', '']:
                    try:
                        # 格式化大数字
                        if isinstance(value, (int, float)) and value > 1000:
                            formatted_value = f"{value:,.0f}"
                        elif isinstance(value, str) and value.replace('.', '').replace(',', '').isdigit():
                            num_value = float(value.replace(',', ''))
                            if num_value > 1000:
                                formatted_value = f"{num_value:,.0f}"
                            else:
                                formatted_value = value
                        else:
                            formatted_value = str(value)
                    except:
                        formatted_value = str(value)
                    
                    result += f"- {display_name}: {formatted_value}\n"
                    displayed_count += 1
            
            if displayed_count == 0:
                result += "- No key metrics available\n"
        else:
            result += f"**Key Metrics:** No data available\n"
        
        # 添加数据源信息
        result += f"\n**Data Source:** AKShare - {data_source}\n"
        result += f"**Market Type:** {market}\n"
        result += f"**Retrieved:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        
        logging.info(f"Successfully returned fundamentals for {ticker} from {data_source}")
        return result
        
    except Exception as e:
        error_msg = f"Error retrieving fundamental data for {ticker}: {str(e)}"
        logging.error(error_msg)
        return error_msg


# ============================================================================
# Financial Statements Functions
# ============================================================================

def _get_financial_statement(
    ticker: str,
    statement_type: str,
    freq: str,
    market: str = None
) -> pd.DataFrame:
    """
    Internal function to get financial statements for all markets
    
    Args:
        ticker: Stock symbol
        statement_type: 'balance_sheet', 'cashflow', or 'income_statement'
        freq: Frequency ('annual' or 'quarterly')
        market: Market type (auto-detected if None)
        
    Returns:
        DataFrame or None if failed
    """
    ak = get_akshare()
    if not ak:
        return None
    
    if market is None:
        market = _identify_market(ticker)
    
    logging.info(f"Getting {statement_type} for {ticker} ({market}), freq={freq}")
    
    statement_name = map_statement_type(statement_type, market)
    freq_mapped = map_frequency(freq, market)
    
    try:
        if market == 'A_STOCK':
            # 优先使用 Sina 接口
            symbol_sina = normalize_symbol_for_sina(ticker, market)
            logging.info(f"Trying Sina: stock={symbol_sina}, symbol={statement_name}")
            
            try:
                df = ak.stock_financial_report_sina(stock=symbol_sina, symbol=statement_name)
                if not df.empty:
                    logging.info(f"Got data from Sina: {df.shape}")
                    return df
            except Exception as e:
                logging.warning(f"Sina failed: {e}")
            
            # 降级到 EastMoney
            logging.info(f"Falling back to EastMoney")
            if statement_type == 'balance_sheet':
                df = ak.stock_balance_sheet_by_yearly_em(symbol=ticker) if freq.lower() == 'annual' else ak.stock_balance_sheet_by_report_em(symbol=ticker)
            elif statement_type == 'cashflow':
                if freq.lower() == 'annual':
                    df = ak.stock_cash_flow_sheet_by_yearly_em(symbol=ticker)
                elif freq.lower() == 'quarterly':
                    df = ak.stock_cash_flow_sheet_by_quarterly_em(symbol=ticker)
                else:
                    df = ak.stock_cash_flow_sheet_by_report_em(symbol=ticker)
            elif statement_type == 'income_statement':
                if freq.lower() == 'annual':
                    df = ak.stock_profit_sheet_by_yearly_em(symbol=ticker)
                elif freq.lower() == 'quarterly':
                    df = ak.stock_profit_sheet_by_quarterly_em(symbol=ticker)
                else:
                    df = ak.stock_profit_sheet_by_report_em(symbol=ticker)
            
            if not df.empty:
                logging.info(f"Got data from EastMoney: {df.shape}")
                return df
                
        elif market == 'US_STOCK':
            symbol_us = normalize_symbol_for_us(ticker)
            logging.info(f"Trying EastMoney US: stock={symbol_us}, symbol={statement_name}, indicator={freq_mapped}")
            df = ak.stock_financial_us_report_em(stock=symbol_us, symbol=statement_name, indicator=freq_mapped)
            if not df.empty:
                logging.info(f"Got US data: {df.shape}")
                return df
                
        elif market == 'HK_STOCK':
            symbol_hk = normalize_symbol_for_hk(ticker)
            logging.info(f"Trying EastMoney HK: stock={symbol_hk}, symbol={statement_name}, indicator={freq_mapped}")
            df = ak.stock_financial_hk_report_em(stock=symbol_hk, symbol=statement_name, indicator=freq_mapped)
            if not df.empty:
                logging.info(f"Got HK data: {df.shape}")
                return df
        
    except Exception as e:
        logging.error(f"Error getting {statement_type}: {e}")
    
    return None


def _format_statement_output(df: pd.DataFrame, ticker: str, statement_type: str, freq: str, market: str) -> str:
    """Format financial statement DataFrame to Markdown"""
    if df is None or df.empty:
        return f"No {statement_type} data available for {ticker}"
    
    type_names = {
        'balance_sheet': 'Balance Sheet (资产负债表)',
        'cashflow': 'Cash Flow Statement (现金流量表)',
        'income_statement': 'Income Statement (利润表/综合损益表)'
    }
    
    statement_name = type_names.get(statement_type, statement_type)
    freq_desc = 'Annual' if freq.lower() == 'annual' else 'Quarterly'
    
    result = f"## {statement_name} ({freq_desc}) for {ticker}\n\n"
    result += f"**Market**: {market}\n"
    result += f"**Retrieved**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    # Show recent periods (last 4)
    recent_df = df.head(4)
    
    # Find date column - support multiple formats
    date_cols = [col for col in df.columns if any(x in col for x in ['日期', 'DATE', '报告日', 'REPORT_DATE'])]
    date_col = date_cols[0] if date_cols else None
    
    # Metadata columns to skip
    skip_cols = [date_col, '币种', '类型', '更新日期', 'SECUCODE', 'SECURITY_CODE', 
                'SECURITY_NAME_ABBR', 'ORG_CODE', 'DATE_TYPE_CODE', 'FISCAL_YEAR',
                'STD_ITEM_CODE', 'STD_REPORT_DATE', 'REPORT_TYPE', 'REPORT', 'STD_ITEM_NAME']
    
    # For US/HK stocks with different structure
    if market in ['US_STOCK', 'HK_STOCK']:
        # Check if data is in long format (ITEM_NAME column)
        if 'ITEM_NAME' in df.columns or 'STD_ITEM_NAME' in df.columns:
            item_col = 'ITEM_NAME' if 'ITEM_NAME' in df.columns else 'STD_ITEM_NAME'
            amount_col = 'AMOUNT'
            
            # Group by date and pivot
            if date_col and amount_col in df.columns:
                result += "### Recent Periods:\n\n"
                
                # Get unique dates (most recent 4)
                dates = df[date_col].unique()[:4]
                
                for date in dates:
                    date_data = df[df[date_col] == date]
                    result += f"**Period**: {date}\n\n"
                    
                    item_count = 0
                    for _, row in date_data.iterrows():
                        item_name = row.get(item_col, '')
                        value = row.get(amount_col)
                        
                        if pd.notna(value) and str(value) not in ['nan', 'None', ''] and item_name:
                            formatted_value = format_large_number(value, item_name)
                            if formatted_value != 'N/A':
                                result += f"- {item_name}: {formatted_value}\n"
                                item_count += 1
                                if item_count >= 15:
                                    result += "- ...(more items available)\n"
                                    break
                    result += "\n"
                
                return result
    
    # Standard format (A-stock or wide format)
    if date_col:
        result += "### Recent Periods:\n\n"
        
        for idx, row in recent_df.iterrows():
            period = row.get(date_col, 'N/A')
            result += f"**Period**: {period}\n\n"
            
            item_count = 0
            for col in df.columns:
                if col in skip_cols or col is None:
                    continue
                
                value = row.get(col)
                if pd.notna(value) and str(value) not in ['nan', 'None', '']:
                    formatted_value = format_large_number(value, col)
                    if formatted_value != 'N/A':
                        result += f"- {col}: {formatted_value}\n"
                        item_count += 1
                        if item_count >= 15:
                            result += "- ...(more items available)\n"
                            break
            result += "\n"
    else:
        # Fallback: show as table
        result += "### Data:\n\n"
        result += recent_df.to_string(index=False)
        result += "\n"
    
    return result


def get_balance_sheet(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str:
    """
    Get balance sheet data for A-shares, US stocks, and HK stocks
    
    Supports:
    - A股: Sina Finance → EastMoney (fallback)
    - 美股: EastMoney
    - 港股: EastMoney
    
    Args:
        ticker: Stock symbol (e.g., "600000", "TSLA", "00700")
        freq: 'annual' or 'quarterly' (default: 'quarterly')
        curr_date: Not used, kept for Alpha Vantage compatibility
    
    Returns:
        Formatted Markdown string with balance sheet data
    """
    try:
        market = _identify_market(ticker)
        df = _get_financial_statement(ticker, 'balance_sheet', freq, market)
        
        if df is None or df.empty:
            return f"No balance sheet data available for {ticker} ({market})"
        
        return _format_statement_output(df, ticker, 'balance_sheet', freq, market)
        
    except Exception as e:
        return f"Error retrieving balance sheet for {ticker}: {str(e)}"


def get_cashflow(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str:
    """
    Get cash flow statement data for A-shares, US stocks, and HK stocks
    
    Supports:
    - A股: Sina Finance → EastMoney (fallback)
    - 美股: EastMoney
    - 港股: EastMoney
    
    Args:
        ticker: Stock symbol (e.g., "600000", "TSLA", "00700")
        freq: 'annual' or 'quarterly' (default: 'quarterly')
        curr_date: Not used, kept for Alpha Vantage compatibility
    
    Returns:
        Formatted Markdown string with cash flow data
    """
    try:
        market = _identify_market(ticker)
        df = _get_financial_statement(ticker, 'cashflow', freq, market)
        
        if df is None or df.empty:
            return f"No cash flow data available for {ticker} ({market})"
        
        return _format_statement_output(df, ticker, 'cashflow', freq, market)
        
    except Exception as e:
        return f"Error retrieving cash flow for {ticker}: {str(e)}"


def get_income_statement(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str:
    """
    Get income statement data for A-shares, US stocks, and HK stocks
    
    Supports:
    - A股: Sina Finance → EastMoney (fallback)
    - 美股: EastMoney (综合损益表)
    - 港股: EastMoney
    
    Args:
        ticker: Stock symbol (e.g., "600000", "TSLA", "00700")
        freq: 'annual' or 'quarterly' (default: 'quarterly')
        curr_date: Not used, kept for Alpha Vantage compatibility
    
    Returns:
        Formatted Markdown string with income statement data
    """
    try:
        market = _identify_market(ticker)
        df = _get_financial_statement(ticker, 'income_statement', freq, market)
        
        if df is None or df.empty:
            return f"No income statement data available for {ticker} ({market})"
        
        return _format_statement_output(df, ticker, 'income_statement', freq, market)
        
    except Exception as e:
        return f"Error retrieving income statement for {ticker}: {str(e)}"
