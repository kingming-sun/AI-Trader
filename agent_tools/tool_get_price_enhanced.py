#!/usr/bin/env python3
"""
Enhanced Price Tool with API Fallback
Combines local data with API data for complete coverage
"""

from pathlib import Path
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional
from fastmcp import FastMCP
import os
import requests
from dotenv import load_dotenv
import time

load_dotenv()

# API Configuration
ALPHA_VANTAGE_KEY = os.getenv("ALPHAADVANTAGE_API_KEY", "")

mcp = FastMCP("EnhancedPrices")


def _workspace_data_path(filename: str) -> Path:
    """Get the path to data file in workspace"""
    base_dir = Path(__file__).resolve().parents[1]
    return base_dir / "data" / filename


def _validate_date(date_str: str) -> None:
    """Validate date format"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("date must be in YYYY-MM-DD format") from exc


def fetch_from_alpha_vantage(symbol: str, date_str: str) -> Optional[Dict[str, Any]]:
    """
    Fetch historical price from Alpha Vantage API
    
    Returns None if data not available or API error
    """
    if not ALPHA_VANTAGE_KEY:
        print("⚠️  Alpha Vantage API key not configured")
        return None
    
    try:
        # Alpha Vantage TIME_SERIES_DAILY endpoint
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "apikey": ALPHA_VANTAGE_KEY,
            "datatype": "json"
        }
        
        print(f"📡 Fetching {symbol} data from Alpha Vantage for {date_str}...")
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
                "source": "alpha_vantage"
            }
        else:
            print(f"⚠️  No data for {date_str} in API response")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"⚠️  API request failed: {e}")
        return None
    except Exception as e:
        print(f"⚠️  Unexpected error fetching from API: {e}")
        return None


def get_from_local_file(symbol: str, date_str: str, filename: str = "merged.jsonl") -> Optional[Dict[str, Any]]:
    """
    Get price from local data file
    
    Returns None if data not found
    """
    data_path = _workspace_data_path(filename)
    if not data_path.exists():
        return None
    
    with data_path.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            doc = json.loads(line)
            meta = doc.get("Meta Data", {})
            if meta.get("2. Symbol") != symbol:
                continue
            series = doc.get("Time Series (Daily)", {})
            day = series.get(date_str)
            if day:
                return {
                    "symbol": symbol,
                    "date": date_str,
                    "ohlcv": {
                        "open": day.get("1. buy price"),
                        "high": day.get("2. high"),
                        "low": day.get("3. low"), 
                        "close": day.get("4. sell price"),
                        "volume": day.get("5. volume"),
                    },
                    "source": "local"
                }
    return None


@mcp.tool()
def get_price_enhanced(symbol: str, date: str, prefer_api: bool = False) -> Dict[str, Any]:
    """
    Get stock price with automatic fallback between local data and API.
    
    Priority order:
    1. Local data file (if not prefer_api)
    2. Alpha Vantage API (if local not found or prefer_api)
    3. Local data file (if API failed and prefer_api)
    
    Args:
        symbol: Stock symbol (e.g., 'AAPL', 'GOOGL')
        date: Date in 'YYYY-MM-DD' format
        prefer_api: If True, try API first before local data
    
    Returns:
        Dictionary with price data and source information
    """
    try:
        _validate_date(date)
    except ValueError as e:
        return {"error": str(e), "symbol": symbol, "date": date}
    
    # Track data sources tried
    sources_tried = []
    
    if prefer_api:
        # 2a. Try API first if preferred
        sources_tried.append("api")
        api_data = fetch_from_alpha_vantage(symbol, date)
        if api_data:
            print(f"✅ Using API data for {symbol} on {date}")
            # Optionally cache this data locally for future use
            return api_data
        
        # 3a. Fall back to local if API failed
        sources_tried.append("local")
        local_data = get_from_local_file(symbol, date)
        if local_data:
            print(f"✅ Using local data for {symbol} on {date} (API fallback)")
            return local_data
    else:
        # 2b. Try local first (default)
        sources_tried.append("local")
        local_data = get_from_local_file(symbol, date)
        if local_data:
            print(f"✅ Using local data for {symbol} on {date}")
            return local_data
        
        # 3b. Fall back to API if local not found
        sources_tried.append("api")
        api_data = fetch_from_alpha_vantage(symbol, date)
        if api_data:
            print(f"✅ Using API data for {symbol} on {date} (local not found)")
            # Optionally cache this data locally for future use
            return api_data
    
    # No data found from any source
    return {
        "error": f"No data found for {symbol} on {date} after trying: {', '.join(sources_tried)}",
        "symbol": symbol,
        "date": date,
        "sources_tried": sources_tried
    }


def cache_api_data_locally(symbol: str, date_str: str, data: Dict[str, Any]) -> None:
    """
    Cache API data to local file for future use
    
    This could be implemented to append to merged.jsonl or a separate cache file
    """
    # TODO: Implement caching logic if needed
    pass


if __name__ == "__main__":
    # Test the enhanced price tool
    test_symbol = "AAPL"
    test_date = "2025-10-25"
    
    print(f"Testing enhanced price tool for {test_symbol} on {test_date}")
    
    # Test with local first
    result = get_price_enhanced(test_symbol, test_date, prefer_api=False)
    print(f"Result (local first): {json.dumps(result, indent=2)}")
    
    # Test with API first
    if ALPHA_VANTAGE_KEY:
        result = get_price_enhanced(test_symbol, test_date, prefer_api=True)
        print(f"Result (API first): {json.dumps(result, indent=2)}")
    else:
        print("⚠️  Alpha Vantage API key not set, skipping API test")