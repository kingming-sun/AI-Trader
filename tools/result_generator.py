#!/usr/bin/env python3
"""
Result File Generator
Generates asset_evolution.json, portfolio.json, and trades.json from position.jsonl
"""

import json
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime


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
        asset_evolution.append({
            "date": datetime.now().strftime("%Y-%m-%d"),
            "total_value": initial_cash,
            "cash": initial_cash,
            "stock_value": 0,
            "return_rate": 0
        })
        return asset_evolution
    
    for i, pos_data in enumerate(positions):
        date = pos_data.get("date", datetime.now().strftime("%Y-%m-%d"))
        position = pos_data.get("position", {})
        cash = position.get("CASH", initial_cash)
        
        # Calculate stock value (simplified - using placeholder prices)
        stock_value = 0
        for symbol, shares in position.items():
            if symbol != "CASH" and shares > 0:
                stock_value += shares * 100  # Placeholder price
        
        total_value = cash + stock_value
        return_rate = ((total_value - initial_cash) / initial_cash) * 100
        
        asset_evolution.append({
            "date": date,
            "total_value": total_value,
            "cash": cash,
            "stock_value": stock_value,
            "return_rate": return_rate
        })
    
    return asset_evolution


def generate_portfolio(positions: List[Dict[str, Any]], initial_cash: float = 10000) -> Dict[str, Any]:
    """Generate portfolio data from latest position"""
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
    position = latest_position.get("position", {})
    
    holdings = []
    # Use initial_cash if CASH is 0 or missing
    cash = position.get("CASH", initial_cash)
    if cash == 0:
        cash = initial_cash
    total_value = cash
    
    for symbol, shares in position.items():
        if symbol != "CASH" and shares > 0:
            # Placeholder values for demonstration
            price = 100
            value = shares * price
            total_value += value
            
            holdings.append({
                "symbol": symbol,
                "shares": shares,
                "avg_cost": price,  # Should track actual cost
                "current_price": price,
                "market_value": value,
                "profit_loss": 0,  # Should calculate actual P&L
                "profit_loss_rate": 0
            })
    
    return {
        "date": date,
        "holdings": holdings,
        "cash": cash,
        "total_value": total_value,
        "stock_ratio": (total_value - cash) / total_value * 100 if total_value > 0 else 0,
        "cash_ratio": cash / total_value * 100 if total_value > 0 else 0
    }


def extract_trades_from_positions(positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract trade records by comparing position changes"""
    trades = []
    
    if len(positions) < 2:
        return trades
    
    for i in range(1, len(positions)):
        prev_pos = positions[i-1].get("position", {})
        curr_pos = positions[i].get("position", {})
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