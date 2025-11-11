import os
from dotenv import load_dotenv
load_dotenv()
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import sys
import requests
import time

# 将项目根目录加入 Python 路径，便于从子目录直接运行本文件
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
from tools.general_tools import get_config_value

# Alpha Vantage API Configuration
ALPHA_VANTAGE_KEY = os.getenv("ALPHAADVANTAGE_API_KEY", "")

all_nasdaq_100_symbols = [
    "NVDA", "MSFT", "AAPL", "GOOG", "GOOGL", "AMZN", "META", "AVGO", "TSLA",
    "NFLX", "PLTR", "COST", "ASML", "AMD", "CSCO", "AZN", "TMUS", "MU", "LIN",
    "PEP", "SHOP", "APP", "INTU", "AMAT", "LRCX", "PDD", "QCOM", "ARM", "INTC",
    "BKNG", "AMGN", "TXN", "ISRG", "GILD", "KLAC", "PANW", "ADBE", "HON",
    "CRWD", "CEG", "ADI", "ADP", "DASH", "CMCSA", "VRTX", "MELI", "SBUX",
    "CDNS", "ORLY", "SNPS", "MSTR", "MDLZ", "ABNB", "MRVL", "CTAS", "TRI",
    "MAR", "MNST", "CSX", "ADSK", "PYPL", "FTNT", "AEP", "WDAY", "REGN", "ROP",
    "NXPI", "DDOG", "AXON", "ROST", "IDXX", "EA", "PCAR", "FAST", "EXC", "TTWO",
    "XEL", "ZS", "PAYX", "WBD", "BKR", "CPRT", "CCEP", "FANG", "TEAM", "CHTR",
    "KDP", "MCHP", "GEHC", "VRSK", "CTSH", "CSGP", "KHC", "ODFL", "DXCM", "TTD",
    "ON", "BIIB", "LULU", "CDW", "GFS"
]

def get_yesterday_date(today_date: str) -> str:
    """
    获取昨日日期，考虑休市日。
    Args:
        today_date: 日期字符串，格式 YYYY-MM-DD，代表今天日期。

    Returns:
        yesterday_date: 昨日日期字符串，格式 YYYY-MM-DD。
    """
    # 计算昨日日期，考虑休市日
    today_dt = datetime.strptime(today_date, "%Y-%m-%d")
    yesterday_dt = today_dt - timedelta(days=1)
    
    # 如果昨日是周末，向前找到最近的交易日
    while yesterday_dt.weekday() >= 5:  # 5=Saturday, 6=Sunday
        yesterday_dt -= timedelta(days=1)
    
    yesterday_date = yesterday_dt.strftime("%Y-%m-%d")
    return yesterday_date

def _get_price_from_local(symbol: str, date_str: str) -> Optional[Dict[str, float]]:
    """
    从本地 merged.jsonl 文件获取价格数据
    
    Args:
        symbol: 股票代码
        date_str: 日期字符串，格式 YYYY-MM-DD
        
    Returns:
        价格数据字典，如果未找到则返回 None
    """
    # 查找 merged.jsonl 文件
    data_file = project_root / "data" / "merged.jsonl"
    if not data_file.exists():
        return None
    
    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    doc = json.loads(line)
                    meta = doc.get("Meta Data", {})
                    if meta.get("2. Symbol") != symbol:
                        continue
                    
                    series = doc.get("Time Series (Daily)", {})
                    day_data = series.get(date_str)
                    if day_data:
                        # Support both formats: "1. open"/"4. close" and "1. buy price"/"4. sell price"
                        open_price = day_data.get("1. open") or day_data.get("1. buy price", 0)
                        close_price = day_data.get("4. close") or day_data.get("4. sell price", 0)
                        return {
                            "open": float(open_price),
                            "high": float(day_data.get("2. high", 0)),
                            "low": float(day_data.get("3. low", 0)),
                            "close": float(close_price),
                            "volume": int(day_data.get("5. volume", 0))
                        }
                except (json.JSONDecodeError, KeyError, ValueError):
                    continue
    except Exception as e:
        print(f"⚠️  Error reading local data for {symbol}: {e}")
    
    return None

def _save_price_to_local(symbol: str, date_str: str, price_data: Dict[str, float], full_api_response: Optional[Dict] = None) -> None:
    """
    将价格数据保存到本地 merged.jsonl 文件
    
    Args:
        symbol: 股票代码
        date_str: 日期字符串，格式 YYYY-MM-DD
        price_data: 价格数据字典
        full_api_response: 完整的 API 响应（可选，用于保存更多历史数据）
    """
    data_file = project_root / "data" / "merged.jsonl"
    
    # 确保 data 目录存在
    data_file.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # 读取现有数据
        existing_data = {}
        if data_file.exists():
            with open(data_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        doc = json.loads(line)
                        meta = doc.get("Meta Data", {})
                        if meta.get("2. Symbol") == symbol:
                            existing_data = doc
                            break
                    except (json.JSONDecodeError, KeyError):
                        continue
        
        # 准备要保存的数据
        if existing_data:
            # 更新现有记录
            series = existing_data.get("Time Series (Daily)", {})
            # 使用 merged.jsonl 的格式：1. buy price 和 4. sell price
            series[date_str] = {
                "1. buy price": str(price_data.get("open", 0)),
                "2. high": str(price_data.get("high", 0)),
                "3. low": str(price_data.get("low", 0)),
                "4. sell price": str(price_data.get("close", 0)),
                "5. volume": str(price_data.get("volume", 0))
            }
            existing_data["Time Series (Daily)"] = series
            # 更新最后刷新日期
            if "Meta Data" in existing_data:
                existing_data["Meta Data"]["3. Last Refreshed"] = date_str
            
            # 如果有完整的 API 响应，合并更多历史数据
            if full_api_response:
                api_series = full_api_response.get("Time Series (Daily)", {})
                for api_date, api_day_data in api_series.items():
                    if api_date not in series:
                        series[api_date] = {
                            "1. buy price": api_day_data.get("1. open", "0"),
                            "2. high": api_day_data.get("2. high", "0"),
                            "3. low": api_day_data.get("3. low", "0"),
                            "4. sell price": api_day_data.get("4. close", "0"),
                            "5. volume": api_day_data.get("5. volume", "0")
                        }
            
            # 重写整个文件，更新该股票的数据
            lines_to_write = []
            updated = False
            if data_file.exists():
                with open(data_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if not line.strip():
                            continue
                        try:
                            doc = json.loads(line)
                            meta = doc.get("Meta Data", {})
                            if meta.get("2. Symbol") == symbol:
                                # 替换为更新后的数据
                                lines_to_write.append(json.dumps(existing_data, ensure_ascii=False) + "\n")
                                updated = True
                            else:
                                lines_to_write.append(line.rstrip() + "\n")
                        except (json.JSONDecodeError, KeyError):
                            lines_to_write.append(line.rstrip() + "\n")
            
            # 如果没找到现有记录，添加新行
            if not updated:
                lines_to_write.append(json.dumps(existing_data, ensure_ascii=False) + "\n")
            
            # 写入文件
            with open(data_file, 'w', encoding='utf-8') as f:
                f.writelines(lines_to_write)
        else:
            # 创建新记录
            new_data = {
                "Meta Data": {
                    "1. Information": "Daily Prices (buy price, high, low, sell price) and Volumes",
                    "2. Symbol": symbol,
                    "3. Last Refreshed": date_str,
                    "4. Output Size": "Compact",
                    "5. Time Zone": "US/Eastern"
                },
                "Time Series (Daily)": {
                    date_str: {
                        "1. buy price": str(price_data.get("open", 0)),
                        "2. high": str(price_data.get("high", 0)),
                        "3. low": str(price_data.get("low", 0)),
                        "4. sell price": str(price_data.get("close", 0)),
                        "5. volume": str(price_data.get("volume", 0))
                    }
                }
            }
            
            # 如果有完整的 API 响应，添加更多历史数据
            if full_api_response:
                api_series = full_api_response.get("Time Series (Daily)", {})
                for api_date, api_day_data in api_series.items():
                    if api_date != date_str:
                        new_data["Time Series (Daily)"][api_date] = {
                            "1. buy price": api_day_data.get("1. open", "0"),
                            "2. high": api_day_data.get("2. high", "0"),
                            "3. low": api_day_data.get("3. low", "0"),
                            "4. sell price": api_day_data.get("4. close", "0"),
                            "5. volume": api_day_data.get("5. volume", "0")
                        }
            
            # 追加到文件
            with open(data_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(new_data, ensure_ascii=False) + "\n")
        
        print(f"💾 Saved price data for {symbol} on {date_str} to local file")
    except Exception as e:
        print(f"⚠️  Error saving price data to local file for {symbol}: {e}")

def _fetch_price_from_alpha_vantage(symbol: str, date_str: str, save_to_local: bool = True) -> Optional[Dict[str, float]]:
    """Fetch price data from Alpha Vantage API and optionally save to local file"""
    if not ALPHA_VANTAGE_KEY:
        print(f"⚠️  Alpha Vantage API key not configured, cannot fetch price for {symbol}")
        return None
    
    try:
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": "compact",  # Get recent 100 days of data
            "apikey": ALPHA_VANTAGE_KEY,
            "datatype": "json"
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"⚠️  API request failed for {symbol} with status {response.status_code}")
            return None
        
        data = response.json()
        
        # Check for API errors
        if "Error Message" in data:
            print(f"⚠️  API error for {symbol}: {data['Error Message']}")
            return None
        
        if "Note" in data:
            print(f"⚠️  API rate limit reached for {symbol}: {data['Note']}")
            return None
        
        # Extract time series data
        time_series = data.get("Time Series (Daily)", {})
        
        if date_str in time_series:
            day_data = time_series[date_str]
            price_data = {
                "open": float(day_data.get("1. open", 0)),
                "high": float(day_data.get("2. high", 0)),
                "low": float(day_data.get("3. low", 0)),
                "close": float(day_data.get("4. close", 0)),
                "volume": int(day_data.get("5. volume", 0))
            }
            
            # Save to local file if requested
            if save_to_local:
                _save_price_to_local(symbol, date_str, price_data, data)
            
            return price_data
        else:
            # Try to find the closest trading day
            available_dates = sorted(time_series.keys(), reverse=True)
            if available_dates:
                # Use the most recent date if exact date not found
                closest_date = available_dates[0]
                day_data = time_series[closest_date]
                print(f"⚠️  Date {date_str} not found for {symbol}, using closest date {closest_date}")
                price_data = {
                    "open": float(day_data.get("1. open", 0)),
                    "high": float(day_data.get("2. high", 0)),
                    "low": float(day_data.get("3. low", 0)),
                    "close": float(day_data.get("4. close", 0)),
                    "volume": int(day_data.get("5. volume", 0))
                }
                
                # Save to local file if requested (save with the requested date, not closest date)
                if save_to_local:
                    _save_price_to_local(symbol, date_str, price_data, data)
                
                return price_data
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"⚠️  API request failed for {symbol}: {e}")
        return None
    except Exception as e:
        print(f"⚠️  Error fetching price for {symbol} from Alpha Vantage: {e}")
        return None

def get_open_prices(today_date: str, symbols: List[str], merged_path: Optional[str] = None) -> Dict[str, Optional[float]]:
    """获取指定日期与标的的开盘价，优先使用本地数据，如果没有则从 Alpha Vantage API 获取。

    Args:
        today_date: 日期字符串，格式 YYYY-MM-DD。
        symbols: 需要查询的股票代码列表。
        merged_path: 已废弃，保留以兼容旧代码。

    Returns:
        {symbol_price: open_price 或 None} 的字典；若未找到对应日期或标的，则值为 None。
    """
    results: Dict[str, Optional[float]] = {}
    local_count = 0
    api_count = 0
    
    print(f"📊 Fetching open prices for {len(symbols)} stocks on {today_date}...")
    
    # Fetch prices for each symbol, prioritizing local data
    for symbol in symbols:
        # First try local data
        price_data = _get_price_from_local(symbol, today_date)
        if price_data and price_data.get("open"):
            results[f'{symbol}_price'] = price_data["open"]
            local_count += 1
        else:
            # Fall back to API if local data not found
            price_data = _fetch_price_from_alpha_vantage(symbol, today_date)
            if price_data and price_data.get("open"):
                results[f'{symbol}_price'] = price_data["open"]
                api_count += 1
                # Add delay to avoid rate limiting (only after API calls)
                time.sleep(0.45)  # 450ms delay between API requests
            else:
                results[f'{symbol}_price'] = None
    
    print(f"✅ Price fetch complete: {local_count} from local, {api_count} from API, {len(symbols) - local_count - api_count} missing")
    return results

def get_yesterday_open_and_close_price(today_date: str, symbols: List[str], merged_path: Optional[str] = None) -> tuple[Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    """获取指定日期与股票的昨日开盘价和收盘价，优先使用本地数据，如果没有则从 Alpha Vantage API 获取。

    Args:
        today_date: 日期字符串，格式 YYYY-MM-DD，代表今天日期。
        symbols: 需要查询的股票代码列表。
        merged_path: 已废弃，保留以兼容旧代码。

    Returns:
        (开盘价字典, 收盘价字典) 的元组；若未找到对应日期或标的，则值为 None。
    """
    buy_results: Dict[str, Optional[float]] = {}
    sell_results: Dict[str, Optional[float]] = {}
    
    yesterday_date = get_yesterday_date(today_date)
    local_count = 0
    api_count = 0
    
    print(f"📊 Fetching yesterday's prices for {len(symbols)} stocks (date: {yesterday_date})...")
    
    # Fetch prices for each symbol, prioritizing local data
    for symbol in symbols:
        # First try local data
        price_data = _get_price_from_local(symbol, yesterday_date)
        if price_data:
            buy_results[f'{symbol}_price'] = price_data.get("open")
            sell_results[f'{symbol}_price'] = price_data.get("close")
            local_count += 1
        else:
            # Fall back to API if local data not found
            price_data = _fetch_price_from_alpha_vantage(symbol, yesterday_date)
            if price_data:
                buy_results[f'{symbol}_price'] = price_data.get("open")
                sell_results[f'{symbol}_price'] = price_data.get("close")
                api_count += 1
                # Add delay to avoid rate limiting (only after API calls)
                time.sleep(0.45)  # 450ms delay between API requests
            else:
                buy_results[f'{symbol}_price'] = None
                sell_results[f'{symbol}_price'] = None
    
    print(f"✅ Yesterday's price fetch complete: {local_count} from local, {api_count} from API, {len(symbols) - local_count - api_count} missing")
    return buy_results, sell_results

def get_yesterday_profit(today_date: str, yesterday_buy_prices: Dict[str, Optional[float]], yesterday_sell_prices: Dict[str, Optional[float]], yesterday_init_position: Dict[str, float]) -> Dict[str, float]:
    """
    获取今日开盘时持仓的收益，收益计算方式为：(昨日收盘价格 - 昨日开盘价格)*当前持仓。
    Args:
        today_date: 日期字符串，格式 YYYY-MM-DD，代表今天日期。
        yesterday_buy_prices: 昨日开盘价格字典，格式为 {symbol_price: price}
        yesterday_sell_prices: 昨日收盘价格字典，格式为 {symbol_price: price}
        yesterday_init_position: 昨日初始持仓字典，格式为 {symbol: weight}

    Returns:
        {symbol: profit} 的字典；若未找到对应日期或标的，则值为 0.0。
    """
    profit_dict = {}
    
    # 遍历所有股票代码
    for symbol in all_nasdaq_100_symbols:
        symbol_price_key = f'{symbol}_price'
        
        # 获取昨日开盘价和收盘价
        buy_price = yesterday_buy_prices.get(symbol_price_key)
        sell_price = yesterday_sell_prices.get(symbol_price_key)
        
        # 获取昨日持仓权重
        position_weight = yesterday_init_position.get(symbol, 0.0)
        
        # 计算收益：(收盘价 - 开盘价) * 持仓权重
        if buy_price is not None and sell_price is not None and position_weight > 0:
            profit = (sell_price - buy_price) * position_weight
            profit_dict[symbol] = round(profit, 4)  # 保留4位小数
        else:
            profit_dict[symbol] = 0.0
    
    return profit_dict

def get_today_init_position(today_date: str, modelname: str) -> Dict[str, float]:
    """
    获取今日开盘时的初始持仓（即文件中上一个交易日代表的持仓）。
    优先从环境变量 DATA_PATH 获取路径，否则使用旧路径结构。
    如果同一日期有多条记录，选择id最大的记录作为初始持仓。
    如果找不到昨天的记录，则查找今天之前最近的记录（包括初始注册记录）。
    
    Args:
        today_date: 日期字符串，格式 YYYY-MM-DD，代表今天日期。
        modelname: 模型名称，用于构建文件路径。

    Returns:
        {symbol: weight} 的字典；若未找到对应日期，则返回空字典。
    """
    base_dir = Path(__file__).resolve().parents[1]
    
    # Try new path structure first (from DATA_PATH in runtime_env.json or environment variable)
    from tools.general_tools import get_config_value
    data_path = get_config_value("DATA_PATH") or os.getenv("DATA_PATH")
    if data_path:
        position_file = Path(data_path) / "position" / "position.jsonl"
    else:
        # Fallback to old structure
        position_file = base_dir / "data" / "agent_data" / modelname / "position" / "position.jsonl"

    if not position_file.exists():
        print(f"Position file {position_file} does not exist")
        return {}
    
    yesterday_date = get_yesterday_date(today_date)
    today_date_obj = datetime.strptime(today_date, "%Y-%m-%d")
    max_id = -1
    latest_positions = {}
    
    # Also track the most recent position before today (for fallback)
    most_recent_date_obj = None
    most_recent_positions = {}
    most_recent_id = -1
    
    # Track any position with actual data (non-empty positions dict) as ultimate fallback
    any_valid_position = None
    any_valid_date = None
    any_valid_id = -1
  
    with position_file.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                doc = json.loads(line)
                record_date = doc.get("date")
                if not record_date:
                    continue
                    
                record_date_obj = datetime.strptime(record_date, "%Y-%m-%d")
                current_id = doc.get("id", 0)
                positions = doc.get("positions", {})
                
                # Check if positions dict has actual data (not empty and has CASH or stocks)
                has_data = positions and (positions.get("CASH", 0) > 0 or any(shares > 0 for symbol, shares in positions.items() if symbol != "CASH"))
                
                # First, try to find yesterday's position
                if record_date == yesterday_date:
                    if current_id > max_id:
                        max_id = current_id
                        latest_positions = positions
                
                # Also track the most recent position before today (for fallback)
                if record_date_obj < today_date_obj:
                    if most_recent_date_obj is None or record_date_obj > most_recent_date_obj:
                        most_recent_date_obj = record_date_obj
                        most_recent_id = current_id
                        most_recent_positions = positions
                    elif record_date_obj == most_recent_date_obj and current_id > most_recent_id:
                        most_recent_id = current_id
                        most_recent_positions = positions
                
                # Track any valid position with actual data (ultimate fallback)
                if has_data:
                    if any_valid_position is None or record_date_obj > any_valid_date or (record_date_obj == any_valid_date and current_id > any_valid_id):
                        any_valid_position = positions
                        any_valid_date = record_date_obj
                        any_valid_id = current_id
            except Exception as e:
                continue
    
    # If we found yesterday's position, return it (even if empty, it's the correct date)
    if latest_positions is not None and latest_positions != {}:
        return latest_positions
    
    # If yesterday's position exists but is empty, check if we should use fallback
    # (This handles the case where yesterday's record exists but positions is empty)
    if latest_positions == {}:
        # Yesterday's record exists but is empty, try fallback
        if most_recent_positions and most_recent_positions != {}:
            print(f"⚠️  Yesterday's position ({yesterday_date}) is empty, using most recent position from {most_recent_date_obj.strftime('%Y-%m-%d') if most_recent_date_obj else 'unknown'}")
            return most_recent_positions
        elif any_valid_position:
            print(f"⚠️  Yesterday's position ({yesterday_date}) is empty, using valid position from {any_valid_date.strftime('%Y-%m-%d') if any_valid_date else 'unknown'}")
            return any_valid_position
    
    # Otherwise, return the most recent position before today (fallback)
    if most_recent_positions and most_recent_positions != {}:
        print(f"⚠️  No position found for yesterday ({yesterday_date}), using most recent position from {most_recent_date_obj.strftime('%Y-%m-%d') if most_recent_date_obj else 'unknown'}")
        return most_recent_positions
    
    # Ultimate fallback: use any valid position with actual data
    if any_valid_position:
        print(f"⚠️  No position found for yesterday ({yesterday_date}), using valid position from {any_valid_date.strftime('%Y-%m-%d') if any_valid_date else 'unknown'}")
        return any_valid_position
    
    # If no positions found at all, return empty dict
    print(f"⚠️  No position records found before {today_date}")
    return {}

def get_latest_position(today_date: str, modelname: str) -> Dict[str, float]:
    """
    获取最新持仓。
    优先从环境变量 DATA_PATH 获取路径，否则使用旧路径结构。
    优先选择当天 (today_date) 中 id 最大的记录（且positions不为空）；
    若当天无有效记录，则回退到上一个交易日，选择该日中 id 最大的记录。
    如果都找不到，则查找任何有实际数据的记录作为回退。

    Args:
        today_date: 日期字符串，格式 YYYY-MM-DD，代表今天日期。
        modelname: 模型名称，用于构建文件路径。

    Returns:
        (positions, max_id):
          - positions: {symbol: weight} 的字典；若未找到任何记录，则为空字典。
          - max_id: 选中记录的最大 id；若未找到任何记录，则为 -1。
    """
    base_dir = Path(__file__).resolve().parents[1]
    
    # Try new path structure first (from DATA_PATH in runtime_env.json or environment variable)
    from tools.general_tools import get_config_value
    data_path = get_config_value("DATA_PATH") or os.getenv("DATA_PATH")
    if data_path:
        position_file = Path(data_path) / "position" / "position.jsonl"
    else:
        # Fallback to old structure
        position_file = base_dir / "data" / "agent_data" / modelname / "position" / "position.jsonl"

    if not position_file.exists():
        return {}, -1
    
    today_date_obj = datetime.strptime(today_date, "%Y-%m-%d")
    prev_date = get_yesterday_date(today_date)
    
    # Track positions from different sources
    max_id_today = -1
    latest_positions_today: Dict[str, float] = {}
    
    max_id_prev = -1
    latest_positions_prev: Dict[str, float] = {}
    
    # Ultimate fallback: any valid position with actual data
    any_valid_position = None
    any_valid_date = None
    any_valid_id = -1
    
    with position_file.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                doc = json.loads(line)
                record_date = doc.get("date")
                if not record_date:
                    continue
                    
                record_date_obj = datetime.strptime(record_date, "%Y-%m-%d")
                current_id = doc.get("id", -1)
                positions = doc.get("positions", {})
                
                # Check if positions has actual data
                has_data = positions and (positions.get("CASH", 0) > 0 or any(v > 0 for k, v in positions.items() if k != "CASH"))
                
                # 先尝试读取当天记录（优先选择有数据的）
                if record_date == today_date:
                    if current_id > max_id_today:
                        max_id_today = current_id
                        latest_positions_today = positions
                
                # 当天没有记录，则回退到上一个交易日
                if record_date == prev_date:
                    if current_id > max_id_prev:
                        max_id_prev = current_id
                        latest_positions_prev = positions
                
                # Track any valid position with actual data (ultimate fallback)
                if has_data:
                    if any_valid_position is None or record_date_obj > any_valid_date or (record_date_obj == any_valid_date and current_id > any_valid_id):
                        any_valid_position = positions
                        any_valid_date = record_date_obj
                        any_valid_id = current_id
            except Exception:
                continue
    
    # Return today's position if it has data
    if latest_positions_today and (latest_positions_today.get("CASH", 0) > 0 or any(v > 0 for k, v in latest_positions_today.items() if k != "CASH")):
        return latest_positions_today, max_id_today
    
    # Return yesterday's position if it has data
    if latest_positions_prev and (latest_positions_prev.get("CASH", 0) > 0 or any(v > 0 for k, v in latest_positions_prev.items() if k != "CASH")):
        print(f"⚠️  Today's position ({today_date}) is empty, using yesterday's position from {prev_date}")
        return latest_positions_prev, max_id_prev
    
    # Ultimate fallback: use any valid position
    if any_valid_position:
        print(f"⚠️  No valid position found for {today_date} or {prev_date}, using valid position from {any_valid_date.strftime('%Y-%m-%d') if any_valid_date else 'unknown'}")
        return any_valid_position, any_valid_id
    
    # If today's position exists but is empty, return it anyway (for consistency)
    if max_id_today >= 0:
        return latest_positions_today, max_id_today
    
    # If yesterday's position exists but is empty, return it anyway
    if max_id_prev >= 0:
        return latest_positions_prev, max_id_prev

    return {}, -1

def add_no_trade_record(today_date: str, modelname: str):
    """
    添加不交易记录。从 ../data/agent_data/{modelname}/position/position.jsonl 中前一日最后一条持仓，并更新在今日的position.jsonl文件中。
    Args:
        today_date: 日期字符串，格式 YYYY-MM-DD，代表今天日期。
        modelname: 模型名称，用于构建文件路径。

    Returns:
        None
    """
    save_item = {}
    current_position, current_action_id = get_latest_position(today_date, modelname)
    print(current_position, current_action_id)
    save_item["date"] = today_date
    save_item["id"] = current_action_id+1
    save_item["this_action"] = {"action":"no_trade","symbol":"","amount":0}
    
    save_item["positions"] = current_position
    
    # Try new path structure first (from DATA_PATH in runtime_env.json or environment variable)
    from tools.general_tools import get_config_value
    data_path = get_config_value("DATA_PATH") or os.getenv("DATA_PATH")
    if data_path:
        position_file = Path(data_path) / "position" / "position.jsonl"
    else:
        # Fallback to old structure
        base_dir = Path(__file__).resolve().parents[1]
        position_file = base_dir / "data" / "agent_data" / modelname / "position" / "position.jsonl"
    
    # Ensure directory exists
    position_file.parent.mkdir(parents=True, exist_ok=True)
    
    with position_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(save_item, ensure_ascii=False) + "\n")
    return 

if __name__ == "__main__":
    today_date = get_config_value("TODAY_DATE")
    signature = get_config_value("SIGNATURE")
    if signature is None:
        raise ValueError("SIGNATURE environment variable is not set")
    print(today_date, signature)
    yesterday_date = get_yesterday_date(today_date)
    # print(yesterday_date)
    today_buy_price = get_open_prices(today_date, all_nasdaq_100_symbols)
    # print(today_buy_price)
    yesterday_buy_prices, yesterday_sell_prices = get_yesterday_open_and_close_price(today_date, all_nasdaq_100_symbols)
    # print(yesterday_buy_prices)
    # print(yesterday_sell_prices)
    today_init_position = get_today_init_position(today_date, signature)
    # print(today_init_position)
    latest_position, latest_action_id = get_latest_position(today_date, signature)
    print(latest_position, latest_action_id)
    yesterday_profit = get_yesterday_profit(today_date, yesterday_buy_prices, yesterday_sell_prices, today_init_position)
    # print(yesterday_profit)
    add_no_trade_record(today_date, signature)
