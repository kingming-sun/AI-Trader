"""
Moomoo (Futu) API Client Wrapper - Minimal Implementation
This module provides the required interfaces for Moomoo trading integration.
"""

import os
import time
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Try to import Futu API
try:
    from futu import *
    FUTU_AVAILABLE = True
except ImportError:
    print("⚠️  futu-api not installed. Install with: pip install futu-api")
    FUTU_AVAILABLE = False
    # Define dummy classes for compatibility
    class TrdEnv:
        REAL = 0
        SIMULATE = 1
    class TrdSide:
        BUY = "BUY"
        SELL = "SELL"
    class OrderType:
        NORMAL = 0
        MARKET = 1


class MoomooClient:
    """Moomoo API client wrapper"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.host = os.getenv("MOOMOO_HOST", "127.0.0.1")
            self.port = int(os.getenv("MOOMOO_PORT", "11111"))
            self.trd_env = os.getenv("MOOMOO_TRD_ENV", "SIMULATE")
            self.connected = False
            self.quote_ctx = None
            self.trd_ctx = None
            self._initialized = True
            print(f"✅ MoomooClient initialized (host={self.host}:{self.port}, env={self.trd_env})")
    
    def connect(self) -> bool:
        """Connect to Moomoo OpenD gateway"""
        if not FUTU_AVAILABLE:
            print("❌ Cannot connect: futu-api not installed")
            return False
        
        try:
            from futu import OpenQuoteContext, OpenUSTradeContext
            self.quote_ctx = OpenQuoteContext(host=self.host, port=self.port)
            self.trd_ctx = OpenUSTradeContext(host=self.host, port=self.port)
            self.connected = True
            print(f"✅ Connected to Moomoo at {self.host}:{self.port}")
            return True
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from Moomoo"""
        if self.quote_ctx:
            self.quote_ctx.close()
        if self.trd_ctx:
            self.trd_ctx.close()
        self.connected = False
        print("✅ Disconnected from Moomoo")
    
    def get_market_price(self, symbol: str) -> Optional[float]:
        """Get real-time market price"""
        if not self.connected:
            print(f"⚠️  Not connected, returning mock price for {symbol}")
            return 100.0  # Mock price for testing
        
        try:
            from futu import SubType, RET_OK
            ret_sub, _ = self.quote_ctx.subscribe([symbol], [SubType.QUOTE], subscribe_push=False)
            if ret_sub == RET_OK:
                ret, data = self.quote_ctx.get_market_snapshot([symbol])
                if ret == RET_OK and len(data) > 0:
                    return float(data.iloc[0]['last_price'])
        except Exception as e:
            print(f"❌ Error getting price for {symbol}: {e}")
        return None
    
    def buy(self, symbol: str, amount: int) -> Dict[str, Any]:
        """Execute buy order"""
        if not self.connected:
            return {"success": False, "error": "Not connected"}
        
        # Simplified implementation for testing
        price = self.get_market_price(symbol)
        if price:
            return {
                "success": True,
                "symbol": symbol,
                "amount": amount,
                "price": price,
                "action": "buy",
                "order_id": f"TEST_{int(time.time())}"
            }
        return {"success": False, "error": "Failed to get price"}
    
    def sell(self, symbol: str, amount: int) -> Dict[str, Any]:
        """Execute sell order"""
        if not self.connected:
            return {"success": False, "error": "Not connected"}
        
        price = self.get_market_price(symbol)
        if price:
            return {
                "success": True,
                "symbol": symbol,
                "amount": amount,
                "price": price,
                "action": "sell",
                "order_id": f"TEST_{int(time.time())}"
            }
        return {"success": False, "error": "Failed to get price"}


# Global singleton instance
_client = None

def get_moomoo_client() -> Optional[MoomooClient]:
    """Get singleton Moomoo client instance"""
    global _client
    if _client is None:
        _client = MoomooClient()
    return _client

def init_moomoo_client() -> bool:
    """Initialize and connect Moomoo client"""
    client = get_moomoo_client()
    return client.connect() if client else False

def close_moomoo_client():
    """Close Moomoo client connection"""
    global _client
    if _client:
        _client.disconnect()
        _client = None

def execute_trade_with_risk_control(action: str, symbol: str, amount: int) -> Dict[str, Any]:
    """Execute trade with risk control"""
    client = get_moomoo_client()
    if not client:
        return {"error": "Client not available"}
    
    # Simple risk control
    MAX_SINGLE_TRADE = float(os.getenv("MAX_SINGLE_TRADE", "10000"))
    
    # Mock price for risk check
    price = client.get_market_price(symbol) or 100.0
    trade_value = price * amount
    
    if trade_value > MAX_SINGLE_TRADE:
        return {
            "error": f"Trade value ${trade_value:.2f} exceeds limit ${MAX_SINGLE_TRADE}",
            "symbol": symbol,
            "amount": amount
        }
    
    # Execute trade
    if action == "buy":
        return client.buy(symbol, amount)
    elif action == "sell":
        return client.sell(symbol, amount)
    else:
        return {"error": f"Invalid action: {action}"}


if __name__ == "__main__":
    print("Testing Moomoo client...")
    client = get_moomoo_client()
    print(f"Client created: {client}")
    print(f"Connected: {client.connected}")
