#!/usr/bin/env python3
"""
Result File Generator
Generates asset_evolution.json, portfolio.json, and trades.json from position.jsonl
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add project root directory to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from tools.price_tools import get_open_prices, get_yesterday_open_and_close_price, _fetch_price_from_alpha_vantage
import time

def get_close_prices(date: str, symbols: List[str]) -> Dict[str, Optional[float]]:
    """Get closing prices for symbols on a specific date from Alpha Vantage API"""
    results: Dict[str, Optional[float]] = {}
    
    # Fetch prices from Alpha Vantage API for each symbol
    for symbol in symbols:
        price_data = _fetch_price_from_alpha_vantage(symbol, date)
        if price_data and price_data.get("close"):
            results[f'{symbol}_price'] = price_data["close"]
        else:
            results[f'{symbol}_price'] = None
        
        # Add delay to avoid rate limiting (150 calls per minute for premium tier)
        # 60000ms / 150 = 400ms, using 450ms for safety margin
        time.sleep(0.45)  # 450ms delay between requests
    
    return results


def load_position_data(log_path: str) -> List[Dict[str, Any]]:
    """Load position data from position.jsonl file"""
    position_file = Path(log_path) / "position" / "position.jsonl"
    
    if not position_file.exists():
        print(f"⚠️  Position file not found: {position_file}")
        return []
    
    positions = []
    with open(position_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    positions.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"⚠️  Error parsing position data: {e}")
    
    return positions


def calculate_portfolio_value(position: Dict[str, Any], prices: Dict[str, float] = None) -> float:
    """Calculate total portfolio value from position data"""
    total_value = position.get("CASH", 0)
    
    # Add stock values
    for symbol, shares in position.items():
        if symbol != "CASH" and shares > 0:
            # For simplicity, use a placeholder price if not provided
            # In real implementation, should fetch actual prices
            price = prices.get(symbol, 100) if prices else 100
            total_value += shares * price
    
    return total_value


def generate_asset_evolution(positions: List[Dict[str, Any]], initial_cash: float) -> List[Dict[str, Any]]:
    """Generate asset evolution data from position history"""
    asset_evolution = []
    
    if not positions:
        # Create initial record if no positions
        now = datetime.now()
        asset_evolution.append({
            "date": now.strftime("%Y-%m-%d"),
            "datetime": now.strftime("%Y-%m-%d %H:%M:%S"),
            "total_value": initial_cash,
            "cash": initial_cash,
            "stock_value": 0,
            "return_rate": 0
        })
        return asset_evolution
    
    # Track the last valid position to handle empty positions
    last_valid_cash = initial_cash
    last_valid_stock_value = 0
    
    # Track same-day transaction count to generate time
    date_counter = {}  # {date: count}
    
    for i, pos_data in enumerate(positions):
        date = pos_data.get("date", datetime.now().strftime("%Y-%m-%d"))
        # Support both "position" and "positions" field names
        position = pos_data.get("positions", pos_data.get("position", {}))
        
        # Generate time based on same-day transaction order
        # First transaction of the day: 09:30, second: 10:00, third: 10:30, etc.
        if date not in date_counter:
            date_counter[date] = 0
        else:
            date_counter[date] += 1
        
        # Calculate time: start at 09:30, add 30 minutes for each transaction
        hour = 9
        minute = 30 + date_counter[date] * 30
        # Handle hour overflow
        hour += minute // 60
        minute = minute % 60
        # Cap at market close time (16:00)
        if hour >= 16:
            hour = 15
            minute = 59
        
        datetime_str = f"{date} {hour:02d}:{minute:02d}:00"
        
        # Check if position has actual data
        has_data = position and (position.get("CASH", 0) > 0 or any(v > 0 for k, v in position.items() if k != "CASH"))
        
        if has_data:
            cash = position.get("CASH", last_valid_cash)
            last_valid_cash = cash
            
            # Calculate stock value using actual closing prices
            stock_value = 0
            symbols_with_shares = [symbol for symbol, shares in position.items() 
                                  if symbol != "CASH" and shares > 0]
            
            if symbols_with_shares:
                # Get closing prices for all symbols with holdings
                try:
                    prices = get_close_prices(date, symbols_with_shares)
                    # Fallback to open prices if close prices not available
                    if not prices or all(v is None for v in prices.values()):
                        prices = get_open_prices(date, symbols_with_shares)
                except Exception as e:
                    print(f"⚠️  Warning: Could not get prices for {date}: {e}")
                    prices = {}
                
                for symbol, shares in position.items():
                    if symbol != "CASH" and shares > 0:
                        price_key = f'{symbol}_price'
                        price = prices.get(price_key)
                        if price is not None:
                            stock_value += shares * price
                        else:
                            # If price not available, skip this symbol (or use last known value)
                            print(f"⚠️  Warning: Price not available for {symbol} on {date}, skipping from value calculation")
            last_valid_stock_value = stock_value
        else:
            # Use last valid values if current position is empty
            cash = last_valid_cash
            stock_value = last_valid_stock_value
        
        total_value = cash + stock_value
        return_rate = ((total_value - initial_cash) / initial_cash) * 100
        
        asset_evolution.append({
            "date": date,
            "datetime": datetime_str,
            "total_value": total_value,
            "cash": cash,
            "stock_value": stock_value,
            "return_rate": return_rate
        })
    
    return asset_evolution


def calculate_avg_cost(positions: List[Dict[str, Any]], symbol: str, current_shares: int) -> Optional[float]:
    """Calculate average cost price for a symbol from trade history using weighted average method"""
    # Track position history: (shares, avg_cost)
    # When buying: add to position with new average cost
    # When selling: reduce shares but keep same average cost
    position_shares = 0
    position_cost = 0.0  # Total cost basis
    
    for pos_data in positions:
        this_action = pos_data.get("this_action")
        if not this_action:
            continue
            
        action = this_action.get("action")
        action_symbol = this_action.get("symbol")
        
        if action_symbol != symbol:
            continue
            
        trade_date = pos_data.get("date")
        if not trade_date:
            continue
        
        try:
            prices = get_open_prices(trade_date, [symbol])
            trade_price = prices.get(f'{symbol}_price')
            
            if trade_price is None:
                continue
                
            amount = this_action.get("amount", 0)
            
            if action == "buy":
                # Calculate new average cost: (old_total_cost + new_cost) / (old_shares + new_shares)
                new_cost = trade_price * amount
                if position_shares == 0:
                    # First purchase
                    position_cost = new_cost
                    position_shares = amount
                else:
                    # Weighted average
                    position_cost = position_cost + new_cost
                    position_shares = position_shares + amount
            elif action == "sell":
                # Selling reduces shares but doesn't change average cost
                # We assume FIFO or average cost method where selling doesn't affect remaining cost basis
                position_shares = max(0, position_shares - amount)
                # Adjust cost basis proportionally
                if position_shares > 0:
                    # Keep the same average cost per share
                    position_cost = (position_cost / (position_shares + amount)) * position_shares
                else:
                    position_cost = 0.0
        except Exception as e:
            # If price lookup fails, skip this trade
            print(f"⚠️  Warning: Could not get price for {symbol} on {trade_date}: {e}")
            continue
    
    if position_shares > 0:
        avg_cost = position_cost / position_shares
        return avg_cost
    return None


def generate_portfolio(positions: List[Dict[str, Any]], initial_cash: float = 10000) -> Dict[str, Any]:
    """Generate portfolio data from latest position with actual prices"""
    if not positions:
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "holdings": [],
            "cash": initial_cash,
            "total_value": initial_cash,
            "stock_ratio": 0,
            "cash_ratio": 100
        }
    
    latest_position = positions[-1]
    date = latest_position.get("date", datetime.now().strftime("%Y-%m-%d"))
    # Support both "position" and "positions" field names
    position = latest_position.get("positions", latest_position.get("position", {}))
    
    holdings = []
    # Use initial_cash if CASH is 0 or missing
    cash = position.get("CASH", initial_cash)
    if cash == 0:
        cash = initial_cash
    total_value = cash
    
    # Get all symbols with holdings
    symbols_with_shares = [symbol for symbol, shares in position.items() 
                          if symbol != "CASH" and shares > 0]
    
    if symbols_with_shares:
        # Get current prices (closing prices for the latest date)
        try:
            # Get closing prices for the latest position date
            current_prices = get_close_prices(date, symbols_with_shares)
            
            # If we can't get closing prices, try opening prices as fallback
            if not current_prices or all(v is None for v in current_prices.values()):
                current_prices = get_open_prices(date, symbols_with_shares)
        except Exception as e:
            print(f"⚠️  Warning: Could not get current prices: {e}")
            current_prices = {}
    
    for symbol, shares in position.items():
        if symbol != "CASH" and shares > 0:
            # Calculate average cost from trade history
            avg_cost = calculate_avg_cost(positions, symbol, shares)
            
            # Get current price
            price_key = f'{symbol}_price'
            current_price = current_prices.get(price_key) if symbols_with_shares else None
            
            # Fallback to average cost if current price not available
            if current_price is None:
                current_price = avg_cost
            
            # Fallback to placeholder if both are None
            if current_price is None:
                current_price = 100.0
                print(f"⚠️  Warning: Using placeholder price 100 for {symbol}")
            
            if avg_cost is None:
                avg_cost = current_price  # Use current price as cost if we can't calculate
            
            # Calculate values
            market_value = shares * current_price
            total_cost = shares * avg_cost
            profit_loss = market_value - total_cost
            profit_loss_rate = (profit_loss / total_cost * 100) if total_cost > 0 else 0.0
            
            total_value += market_value
            
            holdings.append({
                "symbol": symbol,
                "shares": shares,
                "avg_cost": round(avg_cost, 2),
                "current_price": round(current_price, 2),
                "market_value": round(market_value, 2),
                "profit_loss": round(profit_loss, 2),
                "profit_loss_rate": round(profit_loss_rate, 2)
            })
    
    return {
        "date": date,
        "holdings": holdings,
        "cash": cash,
        "total_value": round(total_value, 2),
        "stock_ratio": round((total_value - cash) / total_value * 100, 2) if total_value > 0 else 0,
        "cash_ratio": round(cash / total_value * 100, 2) if total_value > 0 else 0
    }


def extract_trades_from_positions(positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract trade records by comparing position changes"""
    trades = []
    
    if len(positions) < 2:
        return trades
    
    for i in range(1, len(positions)):
        # Support both "position" and "positions" field names
        prev_pos = positions[i-1].get("positions", positions[i-1].get("position", {}))
        curr_pos = positions[i].get("positions", positions[i].get("position", {}))
        date = positions[i].get("date", datetime.now().strftime("%Y-%m-%d"))
        
        # Check for changes in each symbol
        all_symbols = set(prev_pos.keys()) | set(curr_pos.keys())
        
        for symbol in all_symbols:
            if symbol == "CASH":
                continue
                
            prev_shares = prev_pos.get(symbol, 0)
            curr_shares = curr_pos.get(symbol, 0)
            
            if curr_shares != prev_shares:
                shares_diff = curr_shares - prev_shares
                action = "BUY" if shares_diff > 0 else "SELL"
                
                trades.append({
                    "date": date,
                    "time": "09:30:00",  # Placeholder time
                    "symbol": symbol,
                    "action": action,
                    "shares": abs(shares_diff),
                    "price": 100,  # Placeholder price
                    "amount": abs(shares_diff) * 100,
                    "status": "SUCCESS"
                })
    
    return trades


def generate_result_files(log_path: str, initial_cash: float = 10000):
    """
    Generate all result files from position data
    
    Args:
        log_path: Path to the agent data directory
        initial_cash: Initial cash amount
    """
    log_path = Path(log_path)
    
    # Load position data
    positions = load_position_data(log_path)
    
    # Generate asset evolution
    asset_evolution = generate_asset_evolution(positions, initial_cash)
    asset_file = log_path / "asset_evolution.json"
    with open(asset_file, 'w', encoding='utf-8') as f:
        json.dump(asset_evolution, f, indent=2, ensure_ascii=False)
    print(f"   ✅ Generated: {asset_file}")
    
    # Generate portfolio
    portfolio = generate_portfolio(positions, initial_cash)
    portfolio_file = log_path / "portfolio.json"
    with open(portfolio_file, 'w', encoding='utf-8') as f:
        json.dump(portfolio, f, indent=2, ensure_ascii=False)
    print(f"   ✅ Generated: {portfolio_file}")
    
    # Generate trades
    trades = extract_trades_from_positions(positions)
    trades_file = log_path / "trades.json"
    with open(trades_file, 'w', encoding='utf-8') as f:
        json.dump(trades, f, indent=2, ensure_ascii=False)
    print(f"   ✅ Generated: {trades_file}")
    
    # Also generate a results.json summary
    results = {
        "summary": {
            "initial_cash": initial_cash,
            "final_value": asset_evolution[-1]["total_value"] if asset_evolution else initial_cash,
            "total_return": asset_evolution[-1]["return_rate"] if asset_evolution else 0,
            "total_trades": len(trades),
            "date_range": {
                "start": positions[0]["date"] if positions else "",
                "end": positions[-1]["date"] if positions else ""
            }
        },
        "asset_evolution": asset_evolution,
        "portfolio": portfolio,
        "trades": trades
    }
    results_file = log_path / "results.json"
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"   ✅ Generated: {results_file}")


if __name__ == "__main__":
    # Test with existing data
    test_path = "./data/strategies/strategy_20251104_141923/deepseek-chat-v3.1"
    if Path(test_path).exists():
        print(f"Testing with: {test_path}")
        generate_result_files(test_path)
    else:
        print(f"Test path not found: {test_path}")