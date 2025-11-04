from pathlib import Path
import json
from datetime import datetime, date
from typing import Dict, Any
from fastmcp import FastMCP
import os
import requests
import time
from dotenv import load_dotenv
load_dotenv()

# Check if real trading mode is enabled
USE_REAL_TRADING = os.getenv("USE_MOOMOO", "false").lower() == "true"
# Alpha Vantage API key for fallback
ALPHA_VANTAGE_KEY = os.getenv("ALPHAADVANTAGE_API_KEY", "")

if USE_REAL_TRADING:
    try:
        from agent_tools.moomoo_client import get_moomoo_client
        print("✅ Real-time price fetching enabled - Moomoo client imported")
    except ImportError as e:
        print(f"⚠️  Failed to import Moomoo client for price fetching: {e}")
        USE_REAL_TRADING = False

mcp = FastMCP("LocalPrices")


def _workspace_data_path(filename: str) -> Path:
    base_dir = Path(__file__).resolve().parents[1]
    return base_dir / "data" / filename


def _validate_date(date_str: str) -> None:
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("date must be in YYYY-MM-DD format") from exc


def _fetch_from_alpha_vantage(symbol: str, date_str: str) -> Dict[str, Any]:
    """Fetch price data from Alpha Vantage API when local data is not available"""
    if not ALPHA_VANTAGE_KEY:
        print("⚠️  Alpha Vantage API key not configured")
        return None
    
    try:
        # Alpha Vantage TIME_SERIES_DAILY endpoint
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": "compact",  # Get recent 100 days of data (faster)
            "apikey": ALPHA_VANTAGE_KEY,
            "datatype": "json"
        }
        
        print(f"📡 Fetching {symbol} from Alpha Vantage...")
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"⚠️  API request failed with status {response.status_code}")
            return None
        
        data = response.json()
        
        # Check for API errors
        if "Error Message" in data:
            print(f"⚠️  API error: {data['Error Message']}")
            return None
        
        if "Note" in data:
            print(f"⚠️  API limit reached: {data['Note']}")
            return None
        
        # Extract time series data
        time_series = data.get("Time Series (Daily)", {})
        
        if date_str in time_series:
            day_data = time_series[date_str]
            print(f"✅ Found data from Alpha Vantage API")
            return {
                "symbol": symbol,
                "date": date_str,
                "ohlcv": {
                    "open": float(day_data.get("1. open", 0)),
                    "high": float(day_data.get("2. high", 0)),
                    "low": float(day_data.get("3. low", 0)),
                    "close": float(day_data.get("4. close", 0)),
                    "volume": int(day_data.get("5. volume", 0))
                },
                "source": "alpha_vantage_api"
            }
        else:
            print(f"⚠️  Date {date_str} not found in API response")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"⚠️  API request failed: {e}")
        return None
    except Exception as e:
        print(f"⚠️  Error fetching from API: {e}")
        return None


@mcp.tool()
def get_price_local(symbol: str, date: str) -> Dict[str, Any]:
    """Read OHLCV data for specified stock and date. Get historical information for specified stock.
    
    In real trading mode, if the requested date is today, returns real-time price from Moomoo.

    Args:
        symbol: Stock symbol, e.g. 'IBM' or '600243.SHH'.
        date: Date in 'YYYY-MM-DD' format.

    Returns:
        Dictionary containing symbol, date and ohlcv data.
    """
    filename = "merged.jsonl"
    try:
        _validate_date(date)
    except ValueError as e:
        return {"error": str(e), "symbol": symbol, "date": date}
    
    # Check if we should fetch real-time price
    if USE_REAL_TRADING:
        today_str = datetime.now().strftime("%Y-%m-%d")
        if date == today_str:
            print(f"📊 Fetching real-time price for {symbol} (today: {date})")
            
            moomoo_client = get_moomoo_client()
            if moomoo_client:
                # Ensure client is connected
                if not moomoo_client.connected:
                    moomoo_client.connect()
                
                # Get real-time price
                real_price = moomoo_client.get_market_price(symbol)
                if real_price:
                    print(f"✅ Real-time price for {symbol}: ${real_price}")
                    # Return in the same format as historical data
                    return {
                        "symbol": symbol,
                        "date": date,
                        "ohlcv": {
                            "open": real_price,  # Use current price for all fields in real-time mode
                            "high": real_price,
                            "low": real_price,
                            "close": real_price,
                            "volume": 0,  # Volume not available in simplified real-time query
                        },
                        "real_time": True  # Flag to indicate this is real-time data
                    }
                else:
                    print(f"⚠️  Failed to get real-time price for {symbol}, falling back to local data")

    data_path = _workspace_data_path(filename)
    if not data_path.exists():
        return {"error": f"Data file not found: {data_path}", "symbol": symbol, "date": date}

    with data_path.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            doc = json.loads(line)
            meta = doc.get("Meta Data", {})
            if meta.get("2. Symbol") != symbol:
                continue
            series = doc.get("Time Series (Daily)", {})
            day = series.get(date)
            if day is None:
                # Try to get from Alpha Vantage API
                print(f"📊 Local data not found for {symbol} on {date}, trying Alpha Vantage API...")
                api_data = _fetch_from_alpha_vantage(symbol, date)
                if api_data:
                    return api_data
                
                # If API also failed, return error with sample dates
                sample_dates = sorted(series.keys(), reverse=True)[:5]
                return {
                    "error": f"Data not found for date {date} in local data or API. Sample available dates: {sample_dates}",
                    "symbol": symbol,
                    "date": date
                }
            return {
                "symbol": symbol,
                "date": date,
                "ohlcv": {
                    "open": day.get("1. buy price"),
                    "high": day.get("2. high"),
                    "low": day.get("3. low"), 
                    "close": day.get("4. sell price"),
                    "volume": day.get("5. volume"),
                },
            }

    # Symbol not found in local data, try API
    print(f"📊 Symbol {symbol} not in local data, trying Alpha Vantage API...")
    api_data = _fetch_from_alpha_vantage(symbol, date)
    if api_data:
        return api_data
    
    return {"error": f"No records found for stock {symbol} in local data or API", "symbol": symbol, "date": date}



def get_price_local_function(symbol: str, date: str, filename: str = "merged.jsonl") -> Dict[str, Any]:
    """Read OHLCV data for specified stock and date from local JSONL data.

    Args:
        symbol: Stock symbol, e.g. 'IBM' or '600243.SHH'.
        date: Date in 'YYYY-MM-DD' format.
        filename: Data filename, defaults to 'merged.jsonl' (located in data/ under project root).

    Returns:
        Dictionary containing symbol, date and ohlcv data.
    """
    try:
        _validate_date(date)
    except ValueError as e:
        return {"error": str(e), "symbol": symbol, "date": date}

    data_path = _workspace_data_path(filename)
    if not data_path.exists():
        return {"error": f"Data file not found: {data_path}", "symbol": symbol, "date": date}

    with data_path.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            doc = json.loads(line)
            meta = doc.get("Meta Data", {})
            if meta.get("2. Symbol") != symbol:
                continue
            series = doc.get("Time Series (Daily)", {})
            day = series.get(date)
            if day is None:
                # Try to get from Alpha Vantage API
                print(f"📊 Local data not found for {symbol} on {date}, trying Alpha Vantage API...")
                api_data = _fetch_from_alpha_vantage(symbol, date)
                if api_data:
                    return api_data
                
                # If API also failed, return error with sample dates
                sample_dates = sorted(series.keys(), reverse=True)[:5]
                return {
                    "error": f"Data not found for date {date} in local data or API. Sample available dates: {sample_dates}",
                    "symbol": symbol,
                    "date": date
                }
            return {
                "symbol": symbol,
                "date": date,
                "ohlcv": {
                    "buy price": day.get("1. buy price"),
                    "high": day.get("2. high"),
                    "low": day.get("3. low"),
                    "sell price": day.get("4. sell price"),
                    "volume": day.get("5. volume"),
                },
            }

    # Symbol not found in local data, try API
    print(f"📊 Symbol {symbol} not in local data, trying Alpha Vantage API...")
    api_data = _fetch_from_alpha_vantage(symbol, date)
    if api_data:
        return api_data
    
    return {"error": f"No records found for stock {symbol} in local data or API", "symbol": symbol, "date": date}

if __name__ == "__main__":
    # print("a test case")
    # print(get_price_local_function("AAPL", "2025-10-16"))
    port = int(os.getenv("GETPRICE_HTTP_PORT", "8003"))
    mcp.run(transport="streamable-http", port=port)

