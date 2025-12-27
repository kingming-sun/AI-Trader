import os
import json
from pathlib import Path
import requests
from typing import Dict, List, Any, Optional
from langchain.tools import tool, StructuredTool
from agent_tools.tool_math import add, subtract, multiply, divide
from agent_tools.tool_trade import buy, sell

# Define Alpha Vantage tools locally since we can't use MCP client
class AlphaVantageTools:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://www.alphavantage.co/query"
        # Setup data path for local fallback
        # Path: .../AI-Trader/agent/base_agent/mcp_compat.py -> .../AI-Trader/data
        self.data_path = Path(__file__).parent.parent.parent / "data"

    def _load_local_data(self, symbol: str) -> Optional[Dict]:
        """Try to load data from local JSON file"""
        try:
            file_path = self.data_path / f"daily_prices_{symbol}.json"
            if file_path.exists():
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading local data for {symbol}: {e}")
        return None

    def _request(self, params: Dict) -> Dict:
        # Check for local data first if function is TIME_SERIES_DAILY
        if params.get("function") == "TIME_SERIES_DAILY" and "symbol" in params:
            local_data = self._load_local_data(params["symbol"])
            if local_data:
                # Add a note to indicate local data was used
                if "Meta Data" in local_data:
                    local_data["Meta Data"]["1. Information"] += " (Loaded from Local Cache)"
                return local_data

        # Fallback to API if local data not found or other function
        params["apikey"] = self.api_key
        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            if "Error Message" in data:
                return {"error": data["Error Message"]}
            if "Note" in data:
                return {"error": "API rate limit exceeded"}
            return data
        except Exception as e:
            return {"error": str(e)}

    @tool
    def get_stock_price(symbol: str) -> str:
        """Get real-time stock price and info"""
        # Note: This is a placeholder. The actual implementation needs to bind self.
        # But @tool decorator works on static functions. 
        # We will implement this as a closure or class method wrapper in get_tools.
        pass

class MultiServerMCPClient:
    """
    Compatibility layer for MultiServerMCPClient when langchain_mcp_adapters is not available.
    Loads tools locally instead of connecting to MCP servers.
    """
    def __init__(self, config: Dict[str, Dict[str, Any]]):
        self.config = config
        self.alpha_vantage_key = (
            os.getenv("ALPHAVANTAGE_API_KEY") or 
            os.getenv("ALPHA_VANTAGE_API_KEY") or 
            os.getenv("ALPHAADVANTAGE_API_KEY")
        )

    async def get_tools(self) -> List[Any]:
        tools = []
        
        # 1. Math Tools
        if "math" in self.config:
            tools.extend([
                self._wrap_tool(add, "add", "Add two numbers"),
                self._wrap_tool(subtract, "subtract", "Subtract two numbers"),
                self._wrap_tool(multiply, "multiply", "Multiply two numbers"),
                self._wrap_tool(divide, "divide", "Divide two numbers"),
            ])
            
        # 2. Trade Tools
        if "trade" in self.config:
            tools.extend([
                self._wrap_tool(buy, "buy", "Buy stock"),
                self._wrap_tool(sell, "sell", "Sell stock"),
            ])
            
        # 3. Alpha Vantage Tools (Market Data)
        if "alphavantage" in self.config and self.alpha_vantage_key:
            tools.extend(self._get_av_tools())
            
        return tools

    def _wrap_tool(self, func, name, description):
        """Wrap a function as a LangChain tool"""
        return StructuredTool.from_function(
            func=func,
            name=name,
            description=description
        )

    def _get_av_tools(self):
        """Create local Alpha Vantage tools"""
        av = AlphaVantageTools(self.alpha_vantage_key)
        
        # We define functions that use the 'av' instance
        
        def time_series_daily(symbol: str) -> str:
            """Get daily time series data for a stock"""
            return str(av._request({"function": "TIME_SERIES_DAILY", "symbol": symbol}))

        def rsi(symbol: str) -> str:
            """Get RSI indicator"""
            return str(av._request({"function": "RSI", "symbol": symbol, "interval": "daily", "time_period": 14, "series_type": "close"}))
            
        def macd(symbol: str) -> str:
            """Get MACD indicator"""
            return str(av._request({"function": "MACD", "symbol": symbol, "interval": "daily", "series_type": "close"}))
            
        def global_quote(symbol: str) -> str:
            """Get latest price and volume"""
            return str(av._request({"function": "GLOBAL_QUOTE", "symbol": symbol}))

        return [
            StructuredTool.from_function(time_series_daily, name="TIME_SERIES_DAILY", description="Get daily time series data"),
            StructuredTool.from_function(rsi, name="RSI", description="Get RSI indicator"),
            StructuredTool.from_function(macd, name="MACD", description="Get MACD indicator"),
            StructuredTool.from_function(global_quote, name="GLOBAL_QUOTE", description="Get latest price quote"),
        ]
